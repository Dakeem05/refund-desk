import OpenAI from 'openai';
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

export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    readonly model: string,
    timeoutMs: number,
  ) {
    this.client = new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 1 });
  }

  async classify(input: ClassificationInput): Promise<ProviderResult<RequestClassification>> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: 'system', content: CLASSIFIER_SYSTEM_PROMPT },
        { role: 'user', content: buildClassifierUserPrompt(input) },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: CLASSIFICATION_TOOL.name,
            description: CLASSIFICATION_TOOL.description,
            parameters: CLASSIFICATION_TOOL.input_schema,
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: CLASSIFICATION_TOOL.name } },
    });

    const call = response.choices[0]?.message.tool_calls?.[0];
    if (!call || call.type !== 'function') {
      throw new Error('OpenAI response did not include a tool call');
    }

    return {
      data: classificationSchema.parse(JSON.parse(call.function.arguments)),
      model: response.model,
      usage: {
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
      },
    };
  }

  async draftReply(input: ReplyInput): Promise<ProviderResult<string>> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.4,
      max_tokens: 400,
      messages: [
        { role: 'system', content: REPLY_SYSTEM_PROMPT },
        { role: 'user', content: buildReplyUserPrompt(input) },
      ],
    });

    return {
      data: response.choices[0]?.message.content?.trim() ?? '',
      model: response.model,
      usage: {
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
      },
    };
  }
}
