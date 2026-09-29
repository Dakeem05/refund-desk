import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ClassificationInput,
  LLM_PROVIDER,
  LlmProvider,
  ReplyInput,
  RequestClassification,
} from './ai.types';
import { HeuristicProvider } from './providers/heuristic.provider';
import { templateReply } from './reply-templates';

export interface ClassificationOutcome {
  classification: RequestClassification;
  provider: string;
  model: string;
  latencyMs: number;
  usage?: { inputTokens?: number; outputTokens?: number };
  /** Set when the configured provider failed and we used the offline classifier instead. */
  fallbackReason?: string;
}

export interface ReplyOutcome {
  text: string;
  source: 'model' | 'template';
  model: string;
  latencyMs: number;
  rejectedReason?: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly fallback = new HeuristicProvider();

  constructor(@Inject(LLM_PROVIDER) private readonly provider: LlmProvider) {}

  get providerInfo() {
    return { provider: this.provider.name, model: this.provider.model };
  }

  async classify(input: ClassificationInput): Promise<ClassificationOutcome> {
    const started = Date.now();
    try {
      const result = await this.provider.classify(input);
      return {
        classification: result.data,
        provider: this.provider.name,
        model: result.model,
        usage: result.usage,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      if (this.provider.name === this.fallback.name) throw error;

      // A provider outage shouldn't take refunds down with it. The offline classifier is
      // conservative, so the worst case is more requests going to a human.
      const reason = describeError(error);
      this.logger.warn(
        `Classification via ${this.provider.name} failed, using fallback: ${reason}`,
      );
      const result = await this.fallback.classify(input);
      return {
        classification: result.data,
        provider: this.fallback.name,
        model: result.model,
        latencyMs: Date.now() - started,
        fallbackReason: reason,
      };
    }
  }

  async draftReply(input: ReplyInput): Promise<ReplyOutcome> {
    const started = Date.now();
    try {
      const result = await this.provider.draftReply(input);
      const problem = findReplyProblem(result.data, input);
      if (problem) {
        this.logger.warn(`Rejected model reply for ${input.reference}: ${problem}`);
        return this.templated(input, started, problem);
      }
      return {
        text: ensureReference(result.data, input.reference),
        source: this.provider.name === this.fallback.name ? 'template' : 'model',
        model: result.model,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      const reason = describeError(error);
      this.logger.warn(`Reply generation failed for ${input.reference}: ${reason}`);
      return this.templated(input, started, `provider error: ${reason}`);
    }
  }

  private templated(input: ReplyInput, started: number, rejectedReason: string): ReplyOutcome {
    return {
      text: templateReply(input),
      source: 'template',
      model: this.fallback.model,
      latencyMs: Date.now() - started,
      rejectedReason,
    };
  }
}

const SAYS_APPROVED =
  /\b(we('ve| have)|has been|is|been) approved\b|\brefund (has been|will be|is being) (issued|processed|sent)\b|\byou('ll| will) (receive|get|see) (a|the|your) refund\b/i;
const SAYS_NOT_APPROVED =
  /\b(unable|not able|can(no|')t|won'?t be able) to (approve|refund|process)\b|\b(denied|declined|rejected)\b/i;
const LEAKS_INTERNALS =
  /\b(ai|a\.i\.|language model|llm|system prompt|instructions|policy engine|fraud|risk team|flagged)\b/i;

/**
 * The model writes the wording, but it doesn't get to change the outcome. If the reply
 * contradicts the decision (or leaks internals), we throw it away and use a template.
 */
export function findReplyProblem(text: string, input: ReplyInput): string | null {
  if (!text || text.length < 20) return 'empty or too short';
  if (text.length > 1200) return 'too long';
  if (/https?:\/\/|www\./i.test(text)) return 'contains a link';
  if (LEAKS_INTERNALS.test(text)) return 'mentions internal details';
  if (input.outcome !== 'APPROVED' && SAYS_APPROVED.test(text)) {
    return `implies approval but decision is ${input.outcome}`;
  }
  if (input.outcome === 'APPROVED' && SAYS_NOT_APPROVED.test(text)) {
    return 'implies refusal but decision is APPROVED';
  }
  // Keep the model from making up a different number
  const amounts = text.match(/\$\s?\d[\d,]*(\.\d{2})?/g) ?? [];
  if (amounts.some((a) => a.replace(/\s/g, '') !== input.refundAmount)) {
    return 'mentions an amount other than the approved one';
  }
  return null;
}

function ensureReference(text: string, reference: string): string {
  return text.includes(reference) ? text : `${text} Your reference is ${reference}.`;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 300);
  return String(error).slice(0, 300);
}
