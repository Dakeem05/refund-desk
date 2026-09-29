import { ReplyInput } from './ai.types';

/** Deterministic replies. Used by the offline provider and whenever a model reply fails our checks. */
export function templateReply(input: ReplyInput): string {
  const hi = `Hi ${input.customerFirstName},`;
  const ref = `Your reference is ${input.reference}.`;

  switch (input.outcome) {
    case 'APPROVED':
      return `${hi} thanks for letting us know, and sorry about the trouble with order ${input.orderNumber}. We've approved a refund of ${input.refundAmount}, which will go back to your original payment method within 5-10 business days. ${ref}`;
    case 'DENIED': {
      const why = input.reasons.length
        ? ` ${input.reasons.join(' ')}`
        : " It doesn't meet the conditions in our refund policy.";
      return `${hi} thanks for reaching out about order ${input.orderNumber}. Unfortunately we're not able to approve this refund.${why} ${ref} If you think we've got something wrong, just reply and a member of our team will take another look.`;
    }
    case 'ESCALATED':
      return `${hi} thanks for the details about order ${input.orderNumber}. Your request needs a quick review from a member of our support team, and we'll get back to you within 1-2 business days. ${ref}`;
  }
}
