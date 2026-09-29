import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.validation';
import { AiService } from './ai.service';
import { LLM_PROVIDER, LlmProvider } from './ai.types';
import { AnthropicProvider } from './providers/anthropic.provider';
import { HeuristicProvider } from './providers/heuristic.provider';
import { OpenAiProvider } from './providers/openai.provider';

function createProvider(config: ConfigService<Env, true>): LlmProvider {
  const logger = new Logger('AiModule');
  const choice = config.get('AI_PROVIDER', { infer: true });
  const timeout = config.get('AI_TIMEOUT_MS', { infer: true });
  const anthropicKey = config.get('ANTHROPIC_API_KEY', { infer: true });
  const openaiKey = config.get('OPENAI_API_KEY', { infer: true });

  const wantsAnthropic = choice === 'anthropic' || (choice === 'auto' && anthropicKey);
  const wantsOpenAi = choice === 'openai' || (choice === 'auto' && !anthropicKey && openaiKey);

  if (wantsAnthropic) {
    if (!anthropicKey) throw new Error('AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set');
    const model = config.get('ANTHROPIC_MODEL', { infer: true });
    logger.log(`Using Anthropic (${model})`);
    return new AnthropicProvider(anthropicKey, model, timeout);
  }

  if (wantsOpenAi) {
    if (!openaiKey) throw new Error('AI_PROVIDER=openai but OPENAI_API_KEY is not set');
    const model = config.get('OPENAI_MODEL', { infer: true });
    logger.log(`Using OpenAI (${model})`);
    return new OpenAiProvider(openaiKey, model, timeout);
  }

  logger.warn('No LLM API key configured - running with the offline keyword classifier');
  return new HeuristicProvider();
}

@Module({
  providers: [
    { provide: LLM_PROVIDER, useFactory: createProvider, inject: [ConfigService] },
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}
