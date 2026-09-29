import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, MoreThanOrEqual, QueryFailedError } from 'typeorm';
import { AiService, ClassificationOutcome } from '../ai/ai.service';
import { ReplyInput } from '../ai/ai.types';
import { screenCustomerMessage, ScreeningResult } from '../ai/input-screening';
import { formatCents } from '../common/utils/money';
import { generateReference } from '../common/utils/reference';
import { CustomersService } from '../customers/customers.service';
import { OrderItem } from '../customers/entities/order-item.entity';
import { Order } from '../customers/entities/order.entity';
import { REFUND_POLICY } from '../policy/policy.config';
import { PolicyService } from '../policy/policy.service';
import { PolicyDecision } from '../policy/policy.types';
import { AuditEvent, AuditEventType } from './entities/audit-event.entity';
import { RefundRequest, RefundStatus } from './entities/refund-request.entity';
import { toCustomerView } from './refund.mapper';

export interface SubmitRefundCommand {
  email: string;
  orderNumber: string;
  message: string;
  itemIds?: string[];
  idempotencyKey?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The customer-facing pipeline:
 *
 *   screen input -> look up order -> model reads the message -> policy engine decides
 *   (inside a transaction, order row locked) -> model drafts the reply -> reply is checked
 *
 * The model calls happen outside the transaction on purpose - we don't want to hold a row lock
 * while waiting on a network call that can take seconds.
 */
@Injectable()
export class RefundProcessingService {
  private readonly logger = new Logger(RefundProcessingService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly customers: CustomersService,
    private readonly policy: PolicyService,
    private readonly ai: AiService,
  ) {}

  async submit(command: SubmitRefundCommand) {
    const started = Date.now();

    if (command.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(command.idempotencyKey, command.orderNumber);
      if (existing) return toCustomerView(existing);
    }

    const order = await this.customers.findOrderForCustomer(command.email, command.orderNumber);

    const screening = screenCustomerMessage(command.message);
    if (screening.text.length < 10) {
      throw new BadRequestException('Please tell us a little more about what went wrong.');
    }

    const ai = await this.ai.classify({
      message: screening.text,
      orderStatus: order.status,
      deliveredAt: order.deliveredAt,
      items: order.items.map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
      })),
    });

    let request: RefundRequest;
    let decision: PolicyDecision;
    try {
      ({ request, decision } = await this.dataSource.transaction((manager) =>
        this.decideAndPersist(manager, order, command, screening, ai),
      ));
    } catch (error) {
      if (command.idempotencyKey && isUniqueViolation(error)) {
        // Same key submitted twice at the same moment - the other one won, return its result
        const existing = await this.findByIdempotencyKey(
          command.idempotencyKey,
          command.orderNumber,
        );
        if (existing) return toCustomerView(existing);
      }
      throw error;
    }

    const reply = await this.ai.draftReply(this.buildReplyInput(order, request, decision));

    request.customerReply = reply.text;
    request.processingMs = Date.now() - started;
    await this.dataSource.transaction(async (manager) => {
      await manager.update(RefundRequest, request.id, {
        customerReply: reply.text,
        processingMs: request.processingMs,
      });
      await manager.save(AuditEvent, {
        refundRequestId: request.id,
        type: reply.rejectedReason ? AuditEventType.REPLY_REJECTED : AuditEventType.REPLY_GENERATED,
        actor: reply.source === 'model' ? 'ai' : 'system',
        summary: reply.rejectedReason
          ? `Model reply discarded (${reply.rejectedReason}); sent the standard template instead.`
          : `Customer reply written by ${reply.source === 'model' ? reply.model : 'template'}.`,
        data: { latencyMs: reply.latencyMs, source: reply.source },
      });
    });

    this.logger.log(
      `${request.reference} ${order.orderNumber} -> ${request.status} (${request.decisionCode}) in ${request.processingMs}ms`,
    );

    return toCustomerView(request);
  }

  private async decideAndPersist(
    manager: EntityManager,
    order: Order,
    command: SubmitRefundCommand,
    screening: ScreeningResult,
    ai: ClassificationOutcome,
  ) {
    // Serialise decisions per order so two quick submissions can't both refund the same item
    await manager
      .getRepository(Order)
      .createQueryBuilder('o')
      .setLock('pessimistic_write')
      .where('o.id = :id', { id: order.id })
      .getOneOrFail();

    const items = await manager.find(OrderItem, { where: { orderId: order.id } });
    const openRequest = await manager.findOne(RefundRequest, {
      where: { orderId: order.id, status: RefundStatus.ESCALATED },
      order: { createdAt: 'DESC' },
    });
    const lookbackStart = new Date(Date.now() - REFUND_POLICY.riskyRefundLookbackDays * DAY_MS);
    const recentRefundCount = await manager.count(RefundRequest, {
      where: {
        customerId: order.customerId,
        status: RefundStatus.APPROVED,
        createdAt: MoreThanOrEqual(lookbackStart),
      },
    });

    const decision = this.policy.evaluate({
      order: { status: order.status, deliveredAt: order.deliveredAt, items },
      customer: { isFlagged: order.customer.isFlagged, recentRefundCount },
      selectedItemIds: command.itemIds ?? [],
      classification: ai.classification,
      screening: { suspicious: screening.suspicious, signals: screening.signals },
      openRequestReference: openRequest?.reference ?? null,
      now: new Date(),
    });

    const status = decision.outcome as RefundStatus;
    const flags = [...decision.flags];
    if (ai.fallbackReason) flags.push('AI_FALLBACK');

    const request = manager.create(RefundRequest, {
      reference: generateReference(),
      idempotencyKey: command.idempotencyKey ?? null,
      customerId: order.customerId,
      orderId: order.id,
      customerMessage: screening.text,
      requestedItemIds: decision.targetItemIds,
      approvedItemIds: decision.approvedItemIds,
      reason: ai.classification.reason,
      automatedDecision: status,
      status,
      decisionCode: decision.decisionCode,
      refundAmountCents: decision.refundAmountCents,
      requestedAmountCents: decision.requestedAmountCents,
      flags,
      classification: ai.classification,
      policyChecks: decision.checks,
      aiProvider: ai.provider,
      aiModel: ai.model,
    });
    await manager.save(request);

    if (status === RefundStatus.APPROVED) {
      await this.markItemsRefunded(manager, decision.approvedItemIds);
    }

    await manager.save(AuditEvent, [
      {
        refundRequestId: request.id,
        type: AuditEventType.REQUEST_RECEIVED,
        actor: 'customer',
        summary: `Refund request received for order ${order.orderNumber}.`,
        data: { selectedItemIds: command.itemIds ?? [], messageLength: screening.text.length },
      },
      {
        refundRequestId: request.id,
        type: AuditEventType.INPUT_SCREENED,
        actor: 'system',
        summary: screening.suspicious
          ? `Message flagged by input screening: ${screening.signals.join(', ')}.`
          : screening.signals.length
            ? `Message cleaned (${screening.signals.join(', ')}).`
            : 'Message passed input screening.',
        data: { ...screening, text: undefined },
      },
      ...(ai.fallbackReason
        ? [
            {
              refundRequestId: request.id,
              type: AuditEventType.AI_FALLBACK,
              actor: 'system',
              summary: 'Primary AI provider failed; used the offline classifier.',
              data: { error: ai.fallbackReason },
            },
          ]
        : []),
      {
        refundRequestId: request.id,
        type: AuditEventType.AI_CLASSIFICATION,
        actor: 'ai',
        summary: `Classified as ${ai.classification.reason} (confidence ${ai.classification.confidence.toFixed(2)}): ${ai.classification.summary}`,
        data: {
          provider: ai.provider,
          model: ai.model,
          latencyMs: ai.latencyMs,
          usage: ai.usage ?? null,
          classification: ai.classification,
        },
      },
      {
        refundRequestId: request.id,
        type: AuditEventType.POLICY_EVALUATED,
        actor: 'system',
        summary: summariseChecks(decision),
        data: { policyVersion: REFUND_POLICY.version, checks: decision.checks },
      },
      {
        refundRequestId: request.id,
        type: AuditEventType.DECISION_MADE,
        actor: 'system',
        summary: `${decision.outcome} (${decision.decisionCode})${
          decision.refundAmountCents ? ` - ${formatCents(decision.refundAmountCents)}` : ''
        }.`,
        data: { flags },
      },
    ]);

    return { request, decision };
  }

  async markItemsRefunded(manager: EntityManager, itemIds: string[]) {
    if (itemIds.length === 0) return;
    await manager.update(OrderItem, { id: In(itemIds) }, { refundedQuantity: () => 'quantity' });
  }

  private buildReplyInput(
    order: Order,
    request: RefundRequest,
    decision: PolicyDecision,
  ): ReplyInput {
    const visible = decision.checks.filter((check) => check.customerVisible);
    let reasons: string[] = [];
    if (decision.outcome === 'DENIED') {
      // The failing rule first, then any context (e.g. "some items were already refunded")
      reasons = [
        ...visible.filter((c) => c.result === 'FAIL'),
        ...visible.filter((c) => c.result === 'INFO'),
      ].map((c) => c.detail);
    } else if (decision.outcome === 'APPROVED') {
      reasons = visible.filter((c) => c.result === 'INFO').map((c) => c.detail);
    }

    return {
      customerFirstName: order.customer.firstName,
      orderNumber: order.orderNumber,
      reference: request.reference,
      outcome: decision.outcome,
      decisionCode: decision.decisionCode,
      refundAmount:
        decision.outcome === 'APPROVED' ? formatCents(decision.refundAmountCents) : null,
      reasons,
      customerSummary: request.classification?.summary ?? '',
    };
  }

  private async findByIdempotencyKey(key: string, orderNumber: string) {
    const existing = await this.dataSource.getRepository(RefundRequest).findOne({
      where: { idempotencyKey: key },
      relations: { order: true },
    });
    if (existing && existing.order.orderNumber !== orderNumber) {
      throw new ConflictException('This idempotency key was already used for a different request.');
    }
    return existing;
  }
}

function summariseChecks(decision: PolicyDecision): string {
  const count = (result: string) => decision.checks.filter((c) => c.result === result).length;
  return `${decision.checks.length} checks: ${count('PASS')} passed, ${count('FAIL')} failed, ${count(
    'REVIEW',
  )} need review.`;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505'
  );
}
