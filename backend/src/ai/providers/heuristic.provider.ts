import { RefundReason } from '../../refunds/entities/refund-request.entity';
import {
  ClassificationInput,
  LlmProvider,
  ProviderResult,
  ReplyInput,
  RequestClassification,
} from '../ai.types';
import { templateReply } from '../reply-templates';

// Checked in order - first match wins. "Sent me the wrong one and it's broken" is a wrong item.
const REASON_KEYWORDS: Array<[RefundReason, RegExp]> = [
  [
    RefundReason.NOT_RECEIVED,
    /\b(never (arrived|came|got it|received)|not (arrived|received)|did ?n[o']t (arrive|receive|get)|have ?n[o']t (received|got)|haven't (received|got)|missing (parcel|package|order)|where is my (order|package|parcel)|lost in (the )?(post|mail|transit))\b/i,
  ],
  [
    RefundReason.WRONG_ITEM,
    /\b(wrong (item|size|colou?r|product|model|one)|instead of|not what i ordered|different (item|product|size|colou?r|model)|sent me (a|the) (different|wrong))\b/i,
  ],
  [
    RefundReason.DAMAGED,
    /\b(broken|broke|damaged|crack(ed)?|defective|faulty|does ?n[o']t (work|turn on|charge)|stopped working|dead on arrival|torn|ripped|scratched|shattered|leak(ing|s)?|dent(ed)?|smashed)\b/i,
  ],
  [
    RefundReason.NOT_AS_DESCRIBED,
    /\b(not as described|nothing like|different from the (picture|photo|description|listing)|misleading|fake|counterfeit|poor quality|cheap material)\b/i,
  ],
  [
    RefundReason.CHANGED_MIND,
    /\b(changed my mind|do ?n[o']t (want|need|like|love)|no longer (want|need)|found (it )?cheaper|not for me|does ?n[o']t (fit|suit)|too (small|big|large|tight|loose)|return it|unopened|never used)\b/i,
  ],
];

/**
 * Keyword-based stand-in used when no API key is configured, or when the real provider fails.
 * It's intentionally conservative - anything it isn't sure about gets low confidence, which
 * the policy engine turns into a human review rather than a guess.
 */
export class HeuristicProvider implements LlmProvider {
  readonly name = 'heuristic';
  readonly model = 'keyword-rules-v1';

  async classify(input: ClassificationInput): Promise<ProviderResult<RequestClassification>> {
    const message = input.message;
    const match = REASON_KEYWORDS.find(([, pattern]) => pattern.test(message));
    const reason = match?.[0] ?? RefundReason.OTHER;

    // An item counts as mentioned if its "head" noun shows up (the last word - Lamp, Sleeve, Shoes)
    // or several of its words do. Stops "laptop screen" from matching the "Laptop Sleeve".
    const messageWords = new Set(significantWords(message));
    const referencedItemIds = input.items
      .filter((item) => {
        const words = significantWords(item.name.replace(/\(.*?\)/g, ''));
        const head = words[words.length - 1];
        const hits = words.filter((word) => messageWords.has(word)).length;
        return (head !== undefined && messageWords.has(head)) || hits >= 2;
      })
      .map((item) => item.id);

    const amount = message.match(/\$\s?(\d[\d,]*(?:\.\d{1,2})?)/);
    const requestedAmountCents = amount
      ? Math.round(parseFloat(amount[1].replace(/,/g, '')) * 100)
      : null;

    const firstSentence = message.split(/(?<=[.!?])\s/)[0]?.trim() || message;

    return {
      data: {
        reason,
        referencedItemIds,
        mentionsUnknownItems: false,
        requestedAmountCents,
        manipulationAttempt: false,
        manipulationNotes: null,
        summary: firstSentence.length > 160 ? `${firstSentence.slice(0, 157)}...` : firstSentence,
        confidence: match ? 0.75 : 0.4,
      },
      model: this.model,
    };
  }

  async draftReply(input: ReplyInput): Promise<ProviderResult<string>> {
    return { data: templateReply(input), model: this.model };
  }
}

function significantWords(text: string): string[] {
  const stop = new Set([
    'with',
    'and',
    'the',
    'for',
    'pack',
    'set',
    'size',
    'clearance',
    'but',
    'was',
    'are',
    'not',
    'can',
    'you',
    'please',
    'refund',
  ]);
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !stop.has(word) && !/\d/.test(word))
    .map((word) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word));
}
