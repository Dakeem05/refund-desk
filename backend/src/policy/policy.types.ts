import type { RequestClassification } from '../ai/ai.types';
import type { OrderStatus } from '../customers/entities/order.entity';

export type CheckResult = 'PASS' | 'FAIL' | 'REVIEW' | 'INFO';
export type PolicyOutcome = 'APPROVED' | 'DENIED' | 'ESCALATED';

export interface PolicyCheck {
  code: string;
  label: string;
  result: CheckResult;
  detail: string;
  /** Safe to show the customer? Risk / fraud checks are internal only. */
  customerVisible: boolean;
}

export interface PolicyItem {
  id: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  refundedQuantity: number;
  isFinalSale: boolean;
}

export interface PolicyInput {
  order: {
    status: OrderStatus;
    deliveredAt: Date | null;
    items: PolicyItem[];
  };
  customer: {
    isFlagged: boolean;
    recentRefundCount: number;
  };
  selectedItemIds: string[];
  classification: RequestClassification;
  screening: { suspicious: boolean; signals: string[] };
  openRequestReference: string | null;
  now: Date;
}

export interface PolicyDecision {
  outcome: PolicyOutcome;
  decisionCode: string;
  refundAmountCents: number;
  requestedAmountCents: number;
  targetItemIds: string[];
  approvedItemIds: string[];
  checks: PolicyCheck[];
  flags: string[];
}
