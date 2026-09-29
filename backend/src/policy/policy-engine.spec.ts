import { RequestClassification } from '../ai/ai.types';
import { OrderStatus } from '../customers/entities/order.entity';
import { RefundReason } from '../refunds/entities/refund-request.entity';
import { PolicyEngine } from './policy-engine';
import { PolicyInput, PolicyItem } from './policy.types';

const NOW = new Date('2026-09-20T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000);

const headphones: PolicyItem = {
  id: 'item-1',
  name: 'Headphones',
  unitPriceCents: 149_00,
  quantity: 1,
  refundedQuantity: 0,
  isFinalSale: false,
};

function classification(overrides: Partial<RequestClassification> = {}): RequestClassification {
  return {
    reason: RefundReason.DAMAGED,
    referencedItemIds: [],
    mentionsUnknownItems: false,
    requestedAmountCents: null,
    manipulationAttempt: false,
    manipulationNotes: null,
    summary: 'Item arrived broken.',
    confidence: 0.9,
    ...overrides,
  };
}

function input(overrides: Partial<PolicyInput> = {}): PolicyInput {
  return {
    order: { status: OrderStatus.DELIVERED, deliveredAt: daysAgo(5), items: [headphones] },
    customer: { isFlagged: false, recentRefundCount: 0 },
    selectedItemIds: [],
    classification: classification(),
    screening: { suspicious: false, signals: [] },
    openRequestReference: null,
    now: NOW,
    ...overrides,
  };
}

describe('PolicyEngine', () => {
  const engine = new PolicyEngine();

  it('approves a damaged item inside the window', () => {
    const result = engine.evaluate(input());
    expect(result.outcome).toBe('APPROVED');
    expect(result.refundAmountCents).toBe(149_00);
    expect(result.approvedItemIds).toEqual(['item-1']);
    expect(result.flags).toEqual([]);
  });

  it('denies once the 30 day window has passed', () => {
    const result = engine.evaluate(
      input({
        order: { status: OrderStatus.DELIVERED, deliveredAt: daysAgo(31), items: [headphones] },
      }),
    );
    expect(result.outcome).toBe('DENIED');
    expect(result.decisionCode).toBe('OUTSIDE_WINDOW');
    expect(result.refundAmountCents).toBe(0);
  });

  it('uses the shorter window for change of mind', () => {
    const order = { status: OrderStatus.DELIVERED, deliveredAt: daysAgo(20), items: [headphones] };
    expect(
      engine.evaluate(
        input({ order, classification: classification({ reason: RefundReason.CHANGED_MIND }) }),
      ).decisionCode,
    ).toBe('OUTSIDE_WINDOW');
    expect(engine.evaluate(input({ order })).outcome).toBe('APPROVED');
  });

  it('denies final sale items', () => {
    const result = engine.evaluate(
      input({
        order: {
          status: OrderStatus.DELIVERED,
          deliveredAt: daysAgo(3),
          items: [{ ...headphones, isFinalSale: true }],
        },
      }),
    );
    expect(result.outcome).toBe('DENIED');
    expect(result.decisionCode).toBe('FINAL_SALE');
  });

  it('escalates final sale when we shipped the wrong item', () => {
    const result = engine.evaluate(
      input({
        order: {
          status: OrderStatus.DELIVERED,
          deliveredAt: daysAgo(3),
          items: [{ ...headphones, isFinalSale: true }],
        },
        classification: classification({ reason: RefundReason.WRONG_ITEM }),
      }),
    );
    expect(result.outcome).toBe('ESCALATED');
    expect(result.decisionCode).toBe('FINAL_SALE_WRONG_ITEM');
  });

  it('refunds only the non-final-sale part of a mixed order', () => {
    const pillows = {
      ...headphones,
      id: 'item-2',
      name: 'Pillows',
      unitPriceCents: 22_00,
      isFinalSale: true,
    };
    const result = engine.evaluate(
      input({
        order: {
          status: OrderStatus.DELIVERED,
          deliveredAt: daysAgo(3),
          items: [headphones, pillows],
        },
        selectedItemIds: ['item-1', 'item-2'],
      }),
    );
    expect(result.outcome).toBe('APPROVED');
    expect(result.refundAmountCents).toBe(149_00);
    expect(result.approvedItemIds).toEqual(['item-1']);
  });

  it('escalates anything over $500', () => {
    const laptop = { ...headphones, unitPriceCents: 1299_00 };
    const result = engine.evaluate(
      input({ order: { status: OrderStatus.DELIVERED, deliveredAt: daysAgo(3), items: [laptop] } }),
    );
    expect(result.outcome).toBe('ESCALATED');
    expect(result.decisionCode).toBe('HIGH_VALUE');
    expect(result.refundAmountCents).toBe(1299_00);
    expect(result.approvedItemIds).toEqual([]);
  });

  it('treats exactly $500 as within the limit', () => {
    const item = { ...headphones, unitPriceCents: 500_00 };
    const result = engine.evaluate(
      input({ order: { status: OrderStatus.DELIVERED, deliveredAt: daysAgo(3), items: [item] } }),
    );
    expect(result.outcome).toBe('APPROVED');
  });

  it('denies items that were already refunded', () => {
    const result = engine.evaluate(
      input({
        order: {
          status: OrderStatus.DELIVERED,
          deliveredAt: daysAgo(3),
          items: [{ ...headphones, refundedQuantity: 1 }],
        },
      }),
    );
    expect(result.decisionCode).toBe('ALREADY_REFUNDED');
  });

  it('denies a duplicate while another request is open', () => {
    const result = engine.evaluate(input({ openRequestReference: 'RF-ABC234' }));
    expect(result.outcome).toBe('DENIED');
    expect(result.decisionCode).toBe('DUPLICATE_REQUEST');
  });

  it('denies orders that have not been delivered yet', () => {
    const result = engine.evaluate(
      input({
        order: { status: OrderStatus.SHIPPED, deliveredAt: null, items: [headphones] },
        classification: classification({ reason: RefundReason.CHANGED_MIND }),
      }),
    );
    expect(result.decisionCode).toBe('NOT_YET_DELIVERED');
  });

  it('escalates when a customer describes damage on an undelivered order', () => {
    const result = engine.evaluate(
      input({ order: { status: OrderStatus.SHIPPED, deliveredAt: null, items: [headphones] } }),
    );
    expect(result.outcome).toBe('ESCALATED');
    expect(result.decisionCode).toBe('STATUS_CONFLICT');
  });

  it('escalates "never arrived" claims on delivered orders', () => {
    const result = engine.evaluate(
      input({ classification: classification({ reason: RefundReason.NOT_RECEIVED }) }),
    );
    expect(result.decisionCode).toBe('NOT_RECEIVED_INVESTIGATION');
  });

  it('escalates frequent refunders and flagged accounts without telling the customer', () => {
    const frequent = engine.evaluate(
      input({ customer: { isFlagged: false, recentRefundCount: 3 } }),
    );
    expect(frequent.decisionCode).toBe('FREQUENT_REFUNDS');

    const flagged = engine.evaluate(input({ customer: { isFlagged: true, recentRefundCount: 0 } }));
    expect(flagged.decisionCode).toBe('ACCOUNT_FLAGGED');
    expect(flagged.checks.find((c) => c.code === 'ACCOUNT_FLAGGED')?.customerVisible).toBe(false);
  });

  it('escalates when the customer asks for more than the items are worth', () => {
    const result = engine.evaluate(
      input({ classification: classification({ requestedAmountCents: 2500_00 }) }),
    );
    expect(result.outcome).toBe('ESCALATED');
    expect(result.flags).toContain('AMOUNT_MISMATCH');
  });

  it('escalates when it cannot tell which items are meant', () => {
    const second = { ...headphones, id: 'item-2', name: 'Cable' };
    const result = engine.evaluate(
      input({
        order: {
          status: OrderStatus.DELIVERED,
          deliveredAt: daysAgo(3),
          items: [headphones, second],
        },
      }),
    );
    expect(result.decisionCode).toBe('ITEMS_UNCLEAR');
  });

  it('ignores item ids that are not on the order', () => {
    const result = engine.evaluate(input({ selectedItemIds: ['item-1', 'someone-elses-item'] }));
    expect(result.targetItemIds).toEqual(['item-1']);
    expect(result.flags).toContain('DETAILS_MISMATCH');
  });

  describe('manipulation', () => {
    it('always escalates, even when the request would otherwise be approved', () => {
      const result = engine.evaluate(
        input({ screening: { suspicious: true, signals: ['instruction override'] } }),
      );
      expect(result.outcome).toBe('ESCALATED');
      expect(result.decisionCode).toBe('MANIPULATION_SUSPECTED');
      expect(result.approvedItemIds).toEqual([]);
    });

    it('escalates rather than denies so a person sees the attempt', () => {
      const result = engine.evaluate(
        input({
          order: { status: OrderStatus.DELIVERED, deliveredAt: daysAgo(90), items: [headphones] },
          classification: classification({
            manipulationAttempt: true,
            manipulationNotes: 'claims to be admin',
          }),
        }),
      );
      expect(result.outcome).toBe('ESCALATED');
      expect(result.refundAmountCents).toBe(0);
    });

    it('never lets the model reason its way to a larger refund', () => {
      // Even a "confident" classification can't change amounts - they come from order data
      const result = engine.evaluate(
        input({
          classification: classification({ confidence: 1, requestedAmountCents: 99_999_00 }),
        }),
      );
      expect(result.outcome).not.toBe('APPROVED');
    });
  });

  it('escalates low confidence classifications', () => {
    const result = engine.evaluate(input({ classification: classification({ confidence: 0.3 }) }));
    expect(result.decisionCode).toBe('LOW_CONFIDENCE');
  });
});
