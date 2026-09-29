import { EntityManager } from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { OrderItem } from '../../customers/entities/order-item.entity';
import { Order } from '../../customers/entities/order.entity';
import { AuditEvent, AuditEventType } from '../../refunds/entities/audit-event.entity';
import { RefundRequest, RefundStatus } from '../../refunds/entities/refund-request.entity';
import { generateReference } from '../../common/utils/reference';
import { SEED_CUSTOMERS } from './data';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

/** Returns false if there's already data - we never overwrite. */
export async function seedDatabase(manager: EntityManager): Promise<boolean> {
  if ((await manager.count(Customer)) > 0) return false;

  for (const seed of SEED_CUSTOMERS) {
    const customer = await manager.save(
      manager.create(Customer, {
        fullName: seed.fullName,
        email: seed.email,
        phone: seed.phone,
        customerSince: daysAgo(seed.customerSinceDaysAgo),
        isFlagged: seed.isFlagged ?? false,
        riskNote: seed.riskNote ?? null,
      }),
    );

    const orders = new Map<string, Order>();
    for (const seedOrder of seed.orders) {
      const items = seedOrder.items.map((item) =>
        manager.create(OrderItem, {
          sku: item.sku,
          name: item.name,
          category: item.category,
          unitPriceCents: Math.round(item.price * 100),
          quantity: item.quantity ?? 1,
          isFinalSale: item.finalSale ?? false,
          refundedQuantity: item.refunded ? (item.quantity ?? 1) : 0,
        }),
      );

      const order = await manager.save(
        manager.create(Order, {
          orderNumber: seedOrder.orderNumber,
          customerId: customer.id,
          status: seedOrder.status,
          placedAt: daysAgo(seedOrder.placedDaysAgo),
          deliveredAt:
            seedOrder.deliveredDaysAgo === null ? null : daysAgo(seedOrder.deliveredDaysAgo),
          totalCents: items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0),
          currency: 'USD',
          items,
        }),
      );
      orders.set(order.orderNumber, order);
    }

    // Historical requests, so the dashboard and the "frequent refunder" rule have something to work with
    for (const past of seed.pastRefunds ?? []) {
      const order = orders.get(past.orderNumber)!;
      const items = order.items.filter((i) => past.itemSkus.includes(i.sku));
      const amount = items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);
      const approved = past.status === RefundStatus.APPROVED;
      const createdAt = daysAgo(past.daysAgo);

      const request = await manager.save(
        manager.create(RefundRequest, {
          reference: generateReference(),
          customerId: customer.id,
          orderId: order.id,
          customerMessage: past.message,
          requestedItemIds: items.map((i) => i.id),
          approvedItemIds: approved ? items.map((i) => i.id) : [],
          reason: past.reason,
          automatedDecision: past.status,
          status: past.status,
          decisionCode: approved ? 'ELIGIBLE' : 'OUTSIDE_WINDOW',
          refundAmountCents: approved ? amount : 0,
          requestedAmountCents: amount,
          flags: [],
          classification: null,
          policyChecks: [],
          customerReply: null,
          aiProvider: 'import',
          aiModel: null,
          createdAt,
          updatedAt: createdAt,
        }),
      );

      await manager.insert(AuditEvent, {
        refundRequestId: request.id,
        type: AuditEventType.DECISION_MADE,
        actor: 'system',
        summary: `Imported from previous helpdesk (${past.status.toLowerCase()}).`,
        data: null,
        createdAt,
      });
    }
  }

  return true;
}
