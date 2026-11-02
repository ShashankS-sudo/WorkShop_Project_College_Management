// AI Service - Provider Factory and Facade - Unifix
import { getConfig } from '@unifix/shared-config';
import { IAIProvider } from './aiTypes';
import { MockAIProvider } from './mockProvider';
import { OpenAICompatibleProvider } from './openaiCompatibleProvider';
import logger from '../logger';

let aiProviderInstance: IAIProvider | null = null;

export function getAIProvider(): IAIProvider {
  if (aiProviderInstance) {
    return aiProviderInstance;
  }

  const config = getConfig();
  const providerType = (config.ai?.provider || 'mock').toLowerCase();

  if (providerType === 'openai' || providerType === 'ollama' || providerType === 'custom') {
    if (config.ai?.baseUrl) {
      logger.info(`Initializing OpenAI-compatible AI provider at ${config.ai.baseUrl} (model: ${config.ai.model || 'default'})`);
      aiProviderInstance = new OpenAICompatibleProvider({
        baseUrl: config.ai.baseUrl,
        apiKey: config.ai.apiKey,
        model: config.ai.model || 'qwen-2.5-coder',
        timeoutMs: config.ai.timeoutMs || 30000,
        maxRetries: config.ai.maxRetries || 1,
      });
      return aiProviderInstance;
    }
  }

  logger.info('Initializing development Mock AI provider');
  aiProviderInstance = new MockAIProvider();
  return aiProviderInstance;
}
