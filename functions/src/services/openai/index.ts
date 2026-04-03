import OpenAI from 'openai';
import { appConfig } from '../../config';
import logger from '../firebase/logger';

/**
 * Singleton OpenAI client
 *
 * Why singleton?
 * - Connection pooling: Reuses HTTP connections
 * - Rate limit awareness: Single point for tracking limits
 * - Cost tracking: Centralized token counting
 * - Thread-safe: One client per process
 */
let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    const apiKey = appConfig.openai.apiKey;

    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY environment variable not set. ' +
        'Add to .env file: OPENAI_API_KEY=sk-...'
      );
    }

    if (!apiKey.startsWith('sk-')) {
      throw new Error(
        'OPENAI_API_KEY looks invalid. ' +
        'Should start with "sk-". Check your .env file.'
      );
    }

    client = new OpenAI({
      apiKey,
      timeout: 30000, // 30 second timeout
      maxRetries: 2,  // Retry on transient failures
    });

    logger.info('✓ OpenAI client initialized');
  }

  return client;
}

/**
 * Reset client (useful for testing)
 */
export function resetOpenAIClient(): void {
  client = null;
}
