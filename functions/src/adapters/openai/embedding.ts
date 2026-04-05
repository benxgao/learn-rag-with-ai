import { openAIAdapter } from './index';
import logger from '../../services/firebase/logger';

/**
 * Embedding Service
 * Handles text vectorization with metrics and batch processing
 * Uses OpenAI's embedding model
 */
export class EmbeddingService {
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private estimateCost(text: string): number {
    const tokens = this.estimateTokens(text);
    const costPerToken = 0.02 / 1_000_000;
    return tokens * costPerToken;
  }

  async createEmbedding(text: string): Promise<number[]> {
    try {
      if (!text || typeof text !== 'string') {
        throw new Error('Text must be a non-empty string');
      }

      const trimmedText = text.trim();
      if (trimmedText.length === 0) {
        throw new Error('Text cannot be empty or whitespace only');
      }

      if (trimmedText.length > 100000) {
        throw new Error(`Text too long (max 100,000 characters). Got ${trimmedText.length}`);
      }

      logger.info('Creating embedding', {
        textLength: trimmedText.length,
        firstChars: trimmedText.substring(0, 50)
      });

      const embedding = await openAIAdapter.createEmbedding(trimmedText);

      logger.info('Embedding created successfully', {
        dimensions: embedding.length,
        textLength: trimmedText.length,
        estimatedCost: this.estimateCost(trimmedText)
      });

      return embedding;
    } catch (error) {
      logger.error(`Error in EmbeddingService.createEmbedding: ${error}`);
      throw error;
    }
  }

  getModelInfo(): { model: string; dimensions: number } {
    return openAIAdapter.getModelInfo();
  }

  async createEmbeddingWithMetrics(
    text: string
  ): Promise<{
    embedding: number[];
    tokens: number;
    cost: number;
    duration: number;
  }> {
    const startTime = Date.now();
    const tokens = this.estimateTokens(text);
    const cost = this.estimateCost(text);

    logger.info('📝 Embedding text with metrics', {
      textPreview: text.substring(0, 50),
      tokens,
      estimatedCost: cost
    });

    const embedding = await this.createEmbedding(text);
    const duration = Date.now() - startTime;

    logger.info('✓ Embedding created with metrics', { duration, tokens, cost });

    return { embedding, tokens, cost, duration };
  }

  async createEmbeddingsBatch(
    texts: string[],
    delayMs: number = 100
  ): Promise<number[][]> {
    const embeddings: number[][] = [];

    logger.info('Starting batch embedding', { count: texts.length, delayMs });

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      embeddings.push(await this.createEmbedding(text));

      if (i < texts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    logger.info('Batch embedding completed', { count: embeddings.length });
    return embeddings;
  }
}

export const embeddingService = new EmbeddingService();
