import OpenAI from 'openai';
import { appConfig } from '../../config';
import logger from '../../services/firebase/logger';
import { EmbeddingError } from '../../types/errors';

/**
 * Singleton OpenAI client
 */
let client: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
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
      timeout: 30000,
      maxRetries: 2,
    });

    logger.info('✓ OpenAI client initialized');
  }

  return client;
}

export function resetOpenAIClient(): void {
  client = null;
}

/**
 * OpenAI Embedding Adapter
 * Handles direct communication with OpenAI embedding API
 */
export class OpenAIAdapter {
  private model = 'text-embedding-3-small';
  private dimensions = 1536;

  async createEmbedding(text: string): Promise<number[]> {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Text input cannot be empty');
      }

      if (text.length > 100000) {
        throw new Error(`Text input too long (max 100,000 characters). Got ${text.length}`);
      }

      logger.info('Creating embedding', { textLength: text.length, model: this.model });

      const response = await getOpenAIClient().embeddings.create({
        model: this.model,
        input: text.trim(),
        encoding_format: 'float',
      });

      const embedding = response.data[0].embedding;

      if (!embedding || embedding.length === 0) {
        throw new Error('Empty embedding returned from API');
      }

      if (embedding.length !== this.dimensions) {
        throw new Error(
          `Invalid embedding dimensions: ${embedding.length}. ` +
          `Expected ${this.dimensions}.`
        );
      }

      logger.info('Embedding created successfully', {
        dimensions: embedding.length,
        model: this.model
      });

      return embedding;
    } catch (error) {
      logger.error(`Error in OpenAIAdapter.createEmbedding: ${error}`);
      throw new EmbeddingError(`Failed to create embedding: ${(error as any).message}`, error);
    }
  }

  getModelInfo(): { model: string; dimensions: number } {
    return {
      model: this.model,
      dimensions: this.dimensions,
    };
  }
}

export const openAIAdapter = new OpenAIAdapter();
export { getOpenAIClient };
