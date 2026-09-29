import { AiService, findReplyProblem } from './ai.service';
import { LlmProvider, ReplyInput } from './ai.types';
import { HeuristicProvider } from './providers/heuristic.provider';

const base: ReplyInput = {
  customerFirstName: 'Amara',
  orderNumber: 'WN-10421',
  reference: 'RF-ABC234',
  outcome: 'DENIED',
  decisionCode: 'FINAL_SALE',
  refundAmount: null,
  reasons: ["The dress is marked Final Sale and can't be refunded."],
  customerSummary: 'Dress does not fit.',
};

describe('findReplyProblem', () => {
  it('accepts a reply that matches the decision', () => {
    const reply =
      "Hi Amara, thanks for getting in touch. Unfortunately we can't approve this one, as the dress was a Final Sale item. Your reference is RF-ABC234.";
    expect(findReplyProblem(reply, base)).toBeNull();
  });

  it('rejects a reply that says a denied refund was approved', () => {
    const reply =
      'Hi Amara, good news - your refund has been approved and will be processed shortly.';
    expect(findReplyProblem(reply, base)).toMatch(/implies approval/);
  });

  it('rejects a reply that invents an amount', () => {
    const reply =
      'Hi Amara, we have approved a refund of $500.00 for order WN-10421. Reference RF-ABC234.';
    expect(
      findReplyProblem(reply, { ...base, outcome: 'APPROVED', refundAmount: '$149.00' }),
    ).toMatch(/amount/);
  });

  it('rejects replies that leak internals', () => {
    const reply = 'Hi Amara, our AI flagged your account for review. Reference RF-ABC234.';
    expect(findReplyProblem(reply, { ...base, outcome: 'ESCALATED' })).toMatch(/internal/);
  });
});

describe('AiService', () => {
  const classificationInput = {
    message: 'The speaker arrived broken',
    orderStatus: 'DELIVERED',
    deliveredAt: new Date(),
    items: [{ id: 'a', name: 'Bluetooth Speaker', sku: 'SPK', unitPriceCents: 7900, quantity: 1 }],
  };

  it('falls back to the offline classifier when the provider fails', async () => {
    const broken: LlmProvider = {
      name: 'anthropic',
      model: 'test',
      classify: () => Promise.reject(new Error('503 overloaded')),
      draftReply: () => Promise.reject(new Error('503 overloaded')),
    };
    const service = new AiService(broken);

    const result = await service.classify(classificationInput);
    expect(result.provider).toBe('heuristic');
    expect(result.fallbackReason).toContain('503');
    expect(result.classification.reason).toBe('DAMAGED');

    const reply = await service.draftReply(base);
    expect(reply.source).toBe('template');
    expect(reply.text).toContain('RF-ABC234');
  });

  it('replaces a model reply that contradicts the decision', async () => {
    const liar: LlmProvider = {
      name: 'anthropic',
      model: 'test',
      classify: () => new HeuristicProvider().classify(classificationInput),
      draftReply: async () => ({
        data: 'Great news, your refund has been approved!',
        model: 'test',
      }),
    };
    const reply = await new AiService(liar).draftReply(base);
    expect(reply.source).toBe('template');
    expect(reply.rejectedReason).toMatch(/implies approval/);
    expect(reply.text).toContain('not able to approve');
  });
});
