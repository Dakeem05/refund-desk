import { formatCents } from '../common/utils/money';
import { RefundRequest, RefundStatus } from './entities/refund-request.entity';

const STATUS_LABEL: Record<RefundStatus, string> = {
  [RefundStatus.APPROVED]: 'Approved',
  [RefundStatus.DENIED]: 'Not approved',
  [RefundStatus.ESCALATED]: 'With our support team',
};

/** What a customer is allowed to see about their own request. No checks, flags or scores. */
export function toCustomerView(request: RefundRequest) {
  return {
    reference: request.reference,
    status: request.status,
    statusLabel: STATUS_LABEL[request.status],
    reply: request.customerReply,
    refundAmount:
      request.status === RefundStatus.APPROVED ? formatCents(request.refundAmountCents) : null,
    reviewedByHuman: request.resolvedAt !== null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

export type CustomerRefundView = ReturnType<typeof toCustomerView>;
