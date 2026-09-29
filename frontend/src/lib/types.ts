export type RefundStatus = 'APPROVED' | 'DENIED' | 'ESCALATED';
export type CheckResult = 'PASS' | 'FAIL' | 'REVIEW' | 'INFO';

export interface VerifiedOrder {
  customerFirstName: string;
  orderNumber: string;
  status: 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  placedAt: string;
  deliveredAt: string | null;
  total: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: string;
    isFinalSale: boolean;
    alreadyRefunded: boolean;
  }>;
}

export interface CustomerRefundResult {
  reference: string;
  status: RefundStatus;
  statusLabel: string;
  reply: string | null;
  refundAmount: string | null;
  reviewedByHuman: boolean;
  createdAt: string;
  updatedAt: string;
  orderNumber?: string;
}

export interface DemoScenario {
  title: string;
  expected: RefundStatus;
  email: string;
  orderNumber: string;
  message: string;
}

export interface PolicyCheck {
  code: string;
  label: string;
  result: CheckResult;
  detail: string;
  customerVisible: boolean;
}

export interface Classification {
  reason: string;
  referencedItemIds: string[];
  mentionsUnknownItems: boolean;
  requestedAmountCents: number | null;
  manipulationAttempt: boolean;
  manipulationNotes: string | null;
  summary: string;
  confidence: number;
}

export interface RefundListItem {
  id: string;
  reference: string;
  createdAt: string;
  customer: { name: string; email: string };
  orderNumber: string;
  status: RefundStatus;
  automatedDecision: RefundStatus;
  decisionCode: string;
  reason: string | null;
  summary: string | null;
  refundAmountCents: number;
  requestedAmountCents: number;
  flags: string[];
  humanReviewed: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface AuditEvent {
  id: string;
  seq: number;
  type: string;
  actor: string;
  summary: string;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export interface RefundDetail {
  id: string;
  reference: string;
  status: RefundStatus;
  automatedDecision: RefundStatus;
  decisionCode: string;
  reason: string | null;
  customerMessage: string;
  refundAmountCents: number;
  requestedAmountCents: number;
  flags: string[];
  classification: Classification | null;
  policyChecks: PolicyCheck[];
  customerReply: string | null;
  aiProvider: string | null;
  aiModel: string | null;
  processingMs: number | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    email: string;
    customerSince: string;
    isFlagged: boolean;
    riskNote: string | null;
    refundsLast90Days: number;
  };
  order: {
    id: string;
    orderNumber: string;
    status: string;
    placedAt: string;
    deliveredAt: string | null;
    totalCents: number;
    items: Array<{
      id: string;
      sku: string;
      name: string;
      category: string;
      unitPriceCents: number;
      quantity: number;
      refundedQuantity: number;
      isFinalSale: boolean;
      requested: boolean;
    }>;
  };
  customerHistory: Array<{
    id: string;
    reference: string;
    orderNumber: string;
    status: RefundStatus;
    refundAmountCents: number;
    createdAt: string;
  }>;
  auditTrail: AuditEvent[];
}

export interface DashboardStats {
  total: number;
  approved: number;
  denied: number;
  awaitingReview: number;
  flagged: number;
  humanResolved: number;
  refundedAmountCents: number;
  automationRate: number;
  avgProcessingMs: number;
  byReason: Array<{ reason: string; count: number }>;
}
