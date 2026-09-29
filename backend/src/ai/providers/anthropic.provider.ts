import Anthropic from '@anthropic-ai/sdk';
import {
  classificationSchema,
  ClassificationInput,
  LlmProvider,
  ProviderResult,
  ReplyInput,
  RequestClassification,
} from '../ai.types';
import {
  buildClassifierUserPrompt,
  buildReplyUserPrompt,
  CLASSIFICATION_TOOL,
  CLASSIFIER_SYSTEM_PROMPT,
  REPLY_SYSTEM_PROMPT,
} from '../prompts/prompts';

export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
    timeoutMs: number,
  ) {
    this.client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 1 });
  }

  async classify(input: ClassificationInput): Promise<ProviderResult<RequestClassification>> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 800,
      temperature: 0,
      system: CLASSIFIER_SYSTEM_PROMPT,
      tools: [CLASSIFICATION_TOOL],
      // Forcing the tool means we always get structured output back, never free text
      tool_choice: { type: 'tool', name: CLASSIFICATION_TOOL.name },
      messages: [{ role: 'user', content: buildClassifierUserPrompt(input) }],
    });

    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('Anthropic response did not include a tool call');
    }

    return {
      data: classificationSchema.parse(toolUse.input),
      model: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  async draftReply(input: ReplyInput): Promise<ProviderResult<string>> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 400,
      temperature: 0.4,
      system: REPLY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildReplyUserPrompt(input) }],
    });

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim();

    return {
      data: text,
      model: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
