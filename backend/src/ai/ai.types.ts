import { z } from 'zod';
import { RefundReason } from '../refunds/entities/refund-request.entity';

/**
 * Shape the model has to return when it reads a customer's message.
 * Everything coming back from a provider is parsed with this before we trust it.
 */
export const classificationSchema = z.object({
  reason: z.nativeEnum(RefundReason),
  referencedItemIds: z.array(z.string()).max(50).default([]),
  mentionsUnknownItems: z.boolean().default(false),
  requestedAmountCents: z.number().int().nonnegative().nullable().default(null),
  manipulationAttempt: z.boolean().default(false),
  manipulationNotes: z.string().max(500).nullable().default(null),
  summary: z.string().min(1).max(400),
  confidence: z.number().min(0).max(1),
});

export type RequestClassification = z.infer<typeof classificationSchema>;

export interface ClassificationInput {
  message: string;
  items: Array<{ id: string; name: string; sku: string; unitPriceCents: number; quantity: number }>;
  orderStatus: string;
  deliveredAt: Date | null;
}

export interface ReplyInput {
  customerFirstName: string;
  orderNumber: string;
  reference: string;
  outcome: 'APPROVED' | 'DENIED' | 'ESCALATED';
  decisionCode: string;
  refundAmount: string | null;
  /** Plain-language reasons the customer is allowed to see. */
  reasons: string[];
  customerSummary: string;
}

export interface ProviderResult<T> {
  data: T;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  classify(input: ClassificationInput): Promise<ProviderResult<RequestClassification>>;
  draftReply(input: ReplyInput): Promise<ProviderResult<string>>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
