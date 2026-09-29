import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { REFUND_POLICY } from '../policy/policy.config';
import { AuditEvent } from './entities/audit-event.entity';
import { RefundRequest, RefundStatus } from './entities/refund-request.entity';
import { toCustomerView } from './refund.mapper';

export interface ListFilters {
  status?: RefundStatus;
  flagged?: boolean;
  search?: string;
  page: number;
  pageSize: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class RefundQueryService {
  constructor(
    @InjectRepository(RefundRequest) private readonly requests: Repository<RefundRequest>,
    @InjectRepository(AuditEvent) private readonly audit: Repository<AuditEvent>,
  ) {}

  async list(filters: ListFilters) {
    const qb = this.requests
      .createQueryBuilder('request')
      .innerJoinAndSelect('request.customer', 'customer')
      .innerJoinAndSelect('request.order', 'o')
      .orderBy('request.createdAt', 'DESC')
      .skip((filters.page - 1) * filters.pageSize)
      .take(filters.pageSize);

    if (filters.status) qb.andWhere('request.status = :status', { status: filters.status });
    if (filters.flagged) qb.andWhere('cardinality(request.flags) > 0');
    if (filters.search) {
      qb.andWhere(
        '(request.reference ILIKE :q OR o.orderNumber ILIKE :q OR customer.email ILIKE :q OR customer.fullName ILIKE :q)',
        { q: `%${filters.search.replace(/[%_]/g, '')}%` },
      );
    }

    const [rows, total] = await qb.getManyAndCount();

    return {
      data: rows.map((r) => ({
        id: r.id,
        reference: r.reference,
        createdAt: r.createdAt,
        customer: { name: r.customer.fullName, email: r.customer.email },
        orderNumber: r.order.orderNumber,
        status: r.status,
        automatedDecision: r.automatedDecision,
        decisionCode: r.decisionCode,
        reason: r.reason,
        summary: r.classification?.summary ?? null,
        refundAmountCents: r.refundAmountCents,
        requestedAmountCents: r.requestedAmountCents,
        flags: r.flags,
        humanReviewed: r.resolvedAt !== null,
      })),
      meta: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / filters.pageSize), 1),
      },
    };
  }

  async detail(id: string) {
    const request = await this.requests.findOne({
      where: { id },
      relations: { customer: true, order: { items: true } },
    });
    if (!request) throw new NotFoundException('Refund request not found');

    const [auditTrail, recentApproved, history] = await Promise.all([
      this.audit.find({ where: { refundRequestId: id }, order: { seq: 'ASC' } }),
      this.requests.count({
        where: {
          customerId: request.customerId,
          status: RefundStatus.APPROVED,
          createdAt: MoreThanOrEqual(
            new Date(Date.now() - REFUND_POLICY.riskyRefundLookbackDays * DAY_MS),
          ),
        },
      }),
      this.requests.find({
        where: { customerId: request.customerId },
        relations: { order: true },
        order: { createdAt: 'DESC' },
        take: 10,
      }),
    ]);

    const { customer, order, ...rest } = request;
    return {
      ...rest,
      customer: {
        id: customer.id,
        name: customer.fullName,
        email: customer.email,
        customerSince: customer.customerSince,
        isFlagged: customer.isFlagged,
        riskNote: customer.riskNote,
        refundsLast90Days: recentApproved,
      },
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        placedAt: order.placedAt,
        deliveredAt: order.deliveredAt,
        totalCents: order.totalCents,
        items: order.items.map((item) => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          category: item.category,
          unitPriceCents: item.unitPriceCents,
          quantity: item.quantity,
          refundedQuantity: item.refundedQuantity,
          isFinalSale: item.isFinalSale,
          requested: request.requestedItemIds.includes(item.id),
        })),
      },
      customerHistory: history
        .filter((h) => h.id !== request.id)
        .map((h) => ({
          id: h.id,
          reference: h.reference,
          orderNumber: h.order.orderNumber,
          status: h.status,
          refundAmountCents: h.refundAmountCents,
          createdAt: h.createdAt,
        })),
      auditTrail,
    };
  }

  async stats() {
    const byStatus = await this.requests
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('COALESCE(SUM(r.refund_amount_cents), 0)::int', 'amountCents')
      .groupBy('r.status')
      .getRawMany<{ status: RefundStatus; count: number; amountCents: number }>();

    const byReason = await this.requests
      .createQueryBuilder('r')
      .select("COALESCE(r.reason::text, 'UNKNOWN')", 'reason')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('r.reason')
      .orderBy('count', 'DESC')
      .getRawMany<{ reason: string; count: number }>();

    const totals = await this.requests
      .createQueryBuilder('r')
      .select('COUNT(*)::int', 'total')
      .addSelect('COUNT(*) FILTER (WHERE cardinality(r.flags) > 0)::int', 'flagged')
      .addSelect("COUNT(*) FILTER (WHERE r.automated_decision <> 'ESCALATED')::int", 'automated')
      .addSelect('COUNT(*) FILTER (WHERE r.resolved_at IS NOT NULL)::int', 'humanResolved')
      .addSelect('COALESCE(AVG(r.processing_ms), 0)::int', 'avgProcessingMs')
      .getRawOne<{
        total: number;
        flagged: number;
        automated: number;
        humanResolved: number;
        avgProcessingMs: number;
      }>();

    const count = (status: RefundStatus) => byStatus.find((s) => s.status === status)?.count ?? 0;
    const total = totals?.total ?? 0;

    return {
      total,
      approved: count(RefundStatus.APPROVED),
      denied: count(RefundStatus.DENIED),
      awaitingReview: count(RefundStatus.ESCALATED),
      flagged: totals?.flagged ?? 0,
      humanResolved: totals?.humanResolved ?? 0,
      refundedAmountCents:
        byStatus.find((s) => s.status === RefundStatus.APPROVED)?.amountCents ?? 0,
      automationRate: total ? Math.round(((totals?.automated ?? 0) / total) * 100) : 0,
      avgProcessingMs: totals?.avgProcessingMs ?? 0,
      byReason,
    };
  }

  /** Customer checks on their own request. Email must match, same as the order lookup. */
  async findForCustomer(reference: string, email: string) {
    const request = await this.requests
      .createQueryBuilder('request')
      .innerJoinAndSelect('request.customer', 'customer')
      .innerJoinAndSelect('request.order', 'o')
      .where('request.reference = :reference', { reference })
      .andWhere('LOWER(customer.email) = LOWER(:email)', { email })
      .getOne();

    if (!request) throw new NotFoundException("We couldn't find a request with that reference.");
    return { ...toCustomerView(request), orderNumber: request.order.orderNumber };
  }
}
