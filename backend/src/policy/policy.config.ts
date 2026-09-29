/**
 * The numbers behind refund-policy.md.
 *
 * Keep these two in sync - the markdown is what customers (and the model) read,
 * this is what the engine actually enforces.
 */
export const REFUND_POLICY = {
  version: '2026-09',
  standardWindowDays: 30,
  changeOfMindWindowDays: 14,
  humanReviewThresholdCents: 500_00,
  riskyRefundCount: 3,
  riskyRefundLookbackDays: 90,
  minClassifierConfidence: 0.6,
} as const;

export type RefundPolicyConfig = typeof REFUND_POLICY;
