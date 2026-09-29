import { OrderStatus } from '../customers/entities/order.entity';
import { RefundReason } from '../refunds/entities/refund-request.entity';
import { formatCents } from '../common/utils/money';
import { REFUND_POLICY, RefundPolicyConfig } from './policy.config';
import {
  CheckResult,
  PolicyCheck,
  PolicyDecision,
  PolicyInput,
  PolicyItem,
  PolicyOutcome,
} from './policy.types';

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_PHRASE: Record<OrderStatus, string> = {
  [OrderStatus.PROCESSING]: 'being prepared',
  [OrderStatus.SHIPPED]: 'on its way',
  [OrderStatus.DELIVERED]: 'delivered',
  [OrderStatus.CANCELLED]: 'cancelled',
};

// Reasons where the customer is saying they physically have the item and something is wrong with it
const ITEM_IN_HAND_REASONS = [
  RefundReason.DAMAGED,
  RefundReason.WRONG_ITEM,
  RefundReason.NOT_AS_DESCRIBED,
];

/**
 * Deterministic refund rules.
 *
 * This is deliberately plain code with no I/O and no model calls. The LLM helps us
 * understand *what* the customer is asking for; this class alone decides whether
 * they get it. That way a clever prompt can never talk its way into a refund.
 */
export class PolicyEngine {
  constructor(private readonly policy: RefundPolicyConfig = REFUND_POLICY) {}

  evaluate(input: PolicyInput): PolicyDecision {
    const checks: PolicyCheck[] = [];
    const add = (
      code: string,
      label: string,
      result: CheckResult,
      detail: string,
      customerVisible = true,
    ) => checks.push({ code, label, result, detail, customerVisible });

    const { order, classification } = input;
    const reason = classification.reason;

    // 1. Work out which items this request is actually about
    const targets = this.resolveTargetItems(input);
    if (targets.unknownSelected.length > 0 || classification.mentionsUnknownItems) {
      add(
        'DETAILS_MISMATCH',
        'Request matches order',
        'REVIEW',
        'The request refers to items that are not on this order.',
        false,
      );
    }
    if (targets.items.length === 0) {
      add(
        'ITEMS_UNCLEAR',
        'Items identified',
        'REVIEW',
        "We couldn't tell which items on the order this request is for.",
      );
    } else {
      add(
        'ITEMS_IDENTIFIED',
        'Items identified',
        'PASS',
        `Request covers: ${targets.items.map((i) => i.name).join(', ')}.`,
      );
    }

    const requestedAmountCents =
      classification.requestedAmountCents ?? this.sumRefundable(targets.items);

    // 2. Order state
    this.checkOrderStatus(order.status, reason, add);

    // 3. Duplicates / already refunded
    if (input.openRequestReference) {
      add(
        'DUPLICATE_REQUEST',
        'No open request for this order',
        'FAIL',
        `Request ${input.openRequestReference} for this order is already being reviewed.`,
      );
    }

    let eligible = targets.items.filter((item) => item.quantity - item.refundedQuantity > 0);
    if (targets.items.length > 0 && eligible.length === 0) {
      add(
        'ALREADY_REFUNDED',
        'Items not already refunded',
        'FAIL',
        'The items on this request have already been refunded.',
      );
    } else if (eligible.length < targets.items.length) {
      add(
        'PARTIALLY_REFUNDED',
        'Items not already refunded',
        'INFO',
        'Some of these items have already been refunded, so they are not included again.',
      );
    }

    // 4. Final sale
    const finalSale = eligible.filter((item) => item.isFinalSale);
    if (finalSale.length > 0) {
      const names = finalSale.map((i) => i.name).join(', ');
      if (reason === RefundReason.WRONG_ITEM) {
        add(
          'FINAL_SALE_WRONG_ITEM',
          'Final sale items',
          'REVIEW',
          `${names} is final sale, but a wrong-item report needs a person to look at it.`,
        );
      } else {
        eligible = eligible.filter((item) => !item.isFinalSale);
        add(
          'FINAL_SALE',
          'Final sale items',
          eligible.length === 0 ? 'FAIL' : 'INFO',
          eligible.length === 0
            ? `${names} is marked Final Sale and can't be refunded.`
            : `${names} is marked Final Sale and was excluded from this refund.`,
        );
      }
    }

    // 5. Reason
    this.checkReason(reason, order.status, add);

    // 6. Time window
    this.checkWindow(input, add);

    // 7. Amounts
    const eligibleAmount = this.sumRefundable(eligible);
    if (eligibleAmount > this.policy.humanReviewThresholdCents) {
      add(
        'HIGH_VALUE',
        'Refund amount',
        'REVIEW',
        `${formatCents(eligibleAmount)} is above the ${formatCents(
          this.policy.humanReviewThresholdCents,
        )} automatic approval limit.`,
      );
    } else if (eligible.length > 0) {
      add('AMOUNT_WITHIN_LIMIT', 'Refund amount', 'PASS', `${formatCents(eligibleAmount)}.`);
    }

    if (
      classification.requestedAmountCents !== null &&
      classification.requestedAmountCents > this.sumRefundable(targets.items)
    ) {
      add(
        'AMOUNT_MISMATCH',
        'Requested amount matches order',
        'REVIEW',
        `Customer asked for ${formatCents(
          classification.requestedAmountCents,
        )}, more than the items are worth.`,
        false,
      );
    }

    // 8. Customer risk - internal only, we don't tell people they've been flagged
    if (input.customer.isFlagged) {
      add(
        'ACCOUNT_FLAGGED',
        'Account standing',
        'REVIEW',
        'Account is flagged by risk team.',
        false,
      );
    }
    if (input.customer.recentRefundCount >= this.policy.riskyRefundCount) {
      add(
        'FREQUENT_REFUNDS',
        'Refund history',
        'REVIEW',
        `${input.customer.recentRefundCount} refunds in the last ${this.policy.riskyRefundLookbackDays} days.`,
        false,
      );
    }

    // 9. Manipulation / model confidence
    const manipulation = input.screening.suspicious || classification.manipulationAttempt;
    if (manipulation) {
      const why = [
        ...input.screening.signals,
        classification.manipulationNotes ? `model: ${classification.manipulationNotes}` : null,
      ].filter(Boolean);
      add(
        'MANIPULATION_SUSPECTED',
        'Message integrity',
        'REVIEW',
        `Message appears to try to influence the decision (${why.join('; ') || 'flagged'}).`,
        false,
      );
    }
    if (classification.confidence < this.policy.minClassifierConfidence) {
      add(
        'LOW_CONFIDENCE',
        'Request understood',
        'REVIEW',
        `Classifier confidence ${classification.confidence.toFixed(2)} is below ${this.policy.minClassifierConfidence}.`,
        false,
      );
    }

    const { outcome, decisionCode } = this.decide(checks, manipulation);

    return {
      outcome,
      decisionCode,
      // For escalations this is the amount we'd propose to the reviewer - nothing if a rule already failed
      refundAmountCents: checks.some((c) => c.result === 'FAIL') ? 0 : eligibleAmount,
      requestedAmountCents,
      targetItemIds: targets.items.map((i) => i.id),
      approvedItemIds: outcome === 'APPROVED' ? eligible.map((i) => i.id) : [],
      checks,
      flags: checks.filter((c) => c.result === 'REVIEW').map((c) => c.code),
    };
  }

  /**
   * Security findings always go to a human, even if the request would have been denied anyway,
   * so someone actually sees the attempt. After that a hard FAIL beats a REVIEW - there's no point
   * making an agent look at a request that's clearly outside policy.
   */
  private decide(
    checks: PolicyCheck[],
    manipulation: boolean,
  ): { outcome: PolicyOutcome; decisionCode: string } {
    if (manipulation) return { outcome: 'ESCALATED', decisionCode: 'MANIPULATION_SUSPECTED' };

    const failed = checks.find((c) => c.result === 'FAIL');
    if (failed) return { outcome: 'DENIED', decisionCode: failed.code };

    const review = checks.find((c) => c.result === 'REVIEW');
    if (review) return { outcome: 'ESCALATED', decisionCode: review.code };

    return { outcome: 'APPROVED', decisionCode: 'ELIGIBLE' };
  }

  private resolveTargetItems(input: PolicyInput) {
    const byId = new Map(input.order.items.map((item) => [item.id, item]));
    const unknownSelected = input.selectedItemIds.filter((id) => !byId.has(id));

    // Explicit selection in the UI wins over whatever the model inferred
    let ids = input.selectedItemIds.filter((id) => byId.has(id));
    if (ids.length === 0) {
      ids = input.classification.referencedItemIds.filter((id) => byId.has(id));
    }
    if (ids.length === 0 && input.order.items.length === 1) {
      ids = [input.order.items[0].id];
    }

    const unique = [...new Set(ids)];
    return { items: unique.map((id) => byId.get(id)!), unknownSelected };
  }

  private checkOrderStatus(
    status: OrderStatus,
    reason: RefundReason,
    add: (code: string, label: string, result: CheckResult, detail: string) => void,
  ) {
    const label = 'Order delivered';
    switch (status) {
      case OrderStatus.DELIVERED:
        add('ORDER_DELIVERED', label, 'PASS', 'Order was delivered.');
        return;
      case OrderStatus.CANCELLED:
        add(
          'ORDER_CANCELLED',
          label,
          'FAIL',
          'This order was cancelled, so there is nothing to refund.',
        );
        return;
      default:
        // Customer says they have a broken/wrong item but our records say it hasn't arrived.
        // Could be a lagging carrier update, could be something else - either way a person should look.
        if (ITEM_IN_HAND_REASONS.includes(reason)) {
          add(
            'STATUS_CONFLICT',
            label,
            'REVIEW',
            `Customer describes the item, but our records show the order is still ${STATUS_PHRASE[status]}.`,
          );
        } else {
          add(
            'NOT_YET_DELIVERED',
            label,
            'FAIL',
            `Your order is still ${STATUS_PHRASE[status]}, so it can't be refunded yet. Once it's delivered you're welcome to try again, or contact us to cancel it.`,
          );
        }
    }
  }

  private checkReason(
    reason: RefundReason,
    status: OrderStatus,
    add: (code: string, label: string, result: CheckResult, detail: string) => void,
  ) {
    const label = 'Refund reason';
    switch (reason) {
      case RefundReason.OTHER:
        add(
          'REASON_UNCLEAR',
          label,
          'REVIEW',
          "The reason for the refund isn't one we can assess automatically.",
        );
        break;
      case RefundReason.NOT_RECEIVED:
        if (status === OrderStatus.DELIVERED) {
          add(
            'NOT_RECEIVED_INVESTIGATION',
            label,
            'REVIEW',
            'Order is marked delivered but the customer says it never arrived - needs a carrier check.',
          );
        }
        break;
      default:
        add('REASON_ELIGIBLE', label, 'PASS', `${reasonLabel(reason)} is a covered reason.`);
    }
  }

  private checkWindow(
    input: PolicyInput,
    add: (code: string, label: string, result: CheckResult, detail: string) => void,
  ) {
    const { deliveredAt } = input.order;
    if (!deliveredAt) return;

    const reason = input.classification.reason;
    const windowDays =
      reason === RefundReason.CHANGED_MIND
        ? this.policy.changeOfMindWindowDays
        : this.policy.standardWindowDays;
    const daysSince = Math.floor((input.now.getTime() - deliveredAt.getTime()) / DAY_MS);

    if (daysSince > windowDays) {
      add(
        'OUTSIDE_WINDOW',
        'Within refund window',
        'FAIL',
        `Delivered ${daysSince} days ago; ${reasonLabel(reason).toLowerCase()} requests must be made within ${windowDays} days.`,
      );
    } else {
      add(
        'WITHIN_WINDOW',
        'Within refund window',
        'PASS',
        `Delivered ${daysSince} day${daysSince === 1 ? '' : 's'} ago (limit ${windowDays}).`,
      );
    }
  }

  private sumRefundable(items: PolicyItem[]): number {
    return items.reduce(
      (total, item) =>
        total + item.unitPriceCents * Math.max(item.quantity - item.refundedQuantity, 0),
      0,
    );
  }
}

export function reasonLabel(reason: RefundReason): string {
  const labels: Record<RefundReason, string> = {
    [RefundReason.DAMAGED]: 'Damaged or defective item',
    [RefundReason.WRONG_ITEM]: 'Wrong item received',
    [RefundReason.NOT_AS_DESCRIBED]: 'Item not as described',
    [RefundReason.NOT_RECEIVED]: 'Order not received',
    [RefundReason.CHANGED_MIND]: 'Change of mind',
    [RefundReason.OTHER]: 'Other',
  };
  return labels[reason];
}
