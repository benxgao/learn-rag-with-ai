import { Pinecone } from '@pinecone-database/pinecone';
import logger from '../../services/firebase/logger';
import { appConfig } from '../../config';

let client: Pinecone | null = null;

/**
 * Get or initialize Pinecone client singleton
 * Reuses connection for performance and cost efficiency
 *
 * @returns Pinecone client instance
 * @throws Error if PINECONE_API_KEY is missing or invalid
 */
export function getPineconeClient(): Pinecone {
  if (client) return client;

  const key = appConfig.pinecone.apiKey;
  if (!key || key.length < 20) {
    throw new Error('Missing or invalid PINECONE_API_KEY (must start with pcsk_)');
  }

  client = new Pinecone({
    apiKey: key,
  });

  logger.info('✓ Pinecone client initialized', {
    apiKeyPrefix: key.substring(0, 8) + '...'
  });

  return client;
}

/**
 * Reset Pinecone client (for testing purposes)
 * Clears the singleton instance
 */
export function resetPineconeClient(): void {
  client = null;
}
