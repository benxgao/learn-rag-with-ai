import OpenAI from 'openai';
import { appConfig } from '../../config';

/**
 * Creates and returns a singleton OpenAI client instance
 * Uses lazy initialization to ensure environment variables are loaded
 */
let openaiInstance: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: appConfig.openai.apiKey,
    });
  }
  return openaiInstance;
}

/**
 * Reset the OpenAI client instance (useful for testing)
 */
export function resetOpenAIClient(): void {
  openaiInstance = null;
}
