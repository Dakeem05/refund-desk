import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { formatCents } from '../common/utils/money';
import { OrderItem } from '../customers/entities/order-item.entity';
import { AuditEvent, AuditEventType } from './entities/audit-event.entity';
import { RefundRequest, RefundStatus } from './entities/refund-request.entity';
import { RefundProcessingService } from './refund-processing.service';

export interface ResolveCommand {
  decision: RefundStatus.APPROVED | RefundStatus.DENIED;
  note: string;
  customerNote?: string;
  reviewer: string;
}

/** Human-in-the-loop: a support agent picks up an escalated request and makes the call. */
@Injectable()
export class RefundReviewService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly processing: RefundProcessingService,
    private readonly ai: AiService,
  ) {}

  async resolve(id: string, command: ResolveCommand) {
    const request = await this.dataSource.transaction(async (manager) => {
      const request = await manager
        .getRepository(RefundRequest)
        .createQueryBuilder('request')
        .setLock('pessimistic_write')
        .where('request.id = :id', { id })
        .getOne();

      if (!request) throw new NotFoundException('Refund request not found');
      if (request.status !== RefundStatus.ESCALATED) {
        throw new BadRequestException(
          `Only escalated requests can be resolved - this one is already ${request.status.toLowerCase()}.`,
        );
      }

      let refundAmountCents = 0;
      let approvedItemIds: string[] = [];

      if (command.decision === RefundStatus.APPROVED) {
        // Re-check against current data: something may have been refunded since this was escalated
        const items = await manager.find(OrderItem, { where: { orderId: request.orderId } });
        const stillRefundable = items.filter(
          (item) => request.requestedItemIds.includes(item.id) && item.refundableQuantity > 0,
        );
        if (stillRefundable.length === 0) {
          throw new BadRequestException(
            'Nothing left to refund - these items were already refunded.',
          );
        }
        approvedItemIds = stillRefundable.map((item) => item.id);
        refundAmountCents = stillRefundable.reduce(
          (sum, item) => sum + item.unitPriceCents * item.refundableQuantity,
          0,
        );
        await this.processing.markItemsRefunded(manager, approvedItemIds);
      }

      Object.assign(request, {
        status: command.decision,
        refundAmountCents,
        approvedItemIds,
        resolvedBy: command.reviewer,
        resolutionNote: command.note,
        resolvedAt: new Date(),
      });
      await manager.save(request);

      await manager.save(AuditEvent, {
        refundRequestId: request.id,
        type: AuditEventType.HUMAN_REVIEW,
        actor: `agent:${command.reviewer}`,
        summary: `${command.reviewer} ${
          command.decision === RefundStatus.APPROVED
            ? `approved ${formatCents(refundAmountCents)}`
            : 'denied the request'
        }: ${command.note}`,
        data: { decision: command.decision, customerNote: command.customerNote ?? null },
      });

      return request;
    });

    const full = await this.dataSource.getRepository(RefundRequest).findOneOrFail({
      where: { id: request.id },
      relations: { customer: true, order: true },
    });

    const reply = await this.ai.draftReply({
      customerFirstName: full.customer.firstName,
      orderNumber: full.order.orderNumber,
      reference: full.reference,
      outcome: command.decision,
      decisionCode: 'HUMAN_REVIEW',
      refundAmount:
        command.decision === RefundStatus.APPROVED ? formatCents(full.refundAmountCents) : null,
      reasons: command.customerNote ? [command.customerNote] : [],
      customerSummary: full.classification?.summary ?? '',
    });

    await this.dataSource
      .getRepository(RefundRequest)
      .update(full.id, { customerReply: reply.text });
    await this.dataSource.getRepository(AuditEvent).save({
      refundRequestId: full.id,
      type: reply.rejectedReason ? AuditEventType.REPLY_REJECTED : AuditEventType.REPLY_GENERATED,
      actor: reply.source === 'model' ? 'ai' : 'system',
      summary: reply.rejectedReason
        ? `Follow-up reply from model discarded (${reply.rejectedReason}); used template.`
        : 'Follow-up reply to customer written after human review.',
      data: { previousReply: full.customerReply, source: reply.source },
    });

    return full.id;
  }
}
