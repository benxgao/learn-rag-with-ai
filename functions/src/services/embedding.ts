import { openAIAdapter } from '../adapters/openai';
import logger from '../services/firebase/logger';

/** Description: Embedding service for text vectorization | Sample: IN "hello world" -> OUT [0.1, 0.2, ...] */
export class EmbeddingService {

  /** Creates embedding vector from text input with validation and error handling */
  async createEmbedding(text: string): Promise<number[]> {
    try {
      // Input validation
      if (!text || typeof text !== 'string') {
        throw new Error('Text must be a non-empty string');
      }

      const trimmedText = text.trim();
      if (trimmedText.length === 0) {
        throw new Error('Text cannot be empty or whitespace only');
      }

      // Rate limit protection: enforce max length
      if (trimmedText.length > 100000) {
        throw new Error(`Text too long (max 100,000 characters). Got ${trimmedText.length}`);
      }

      logger.info('Creating embedding', {
        textLength: trimmedText.length,
        firstChars: trimmedText.substring(0, 50)
      });

      // Create embedding using OpenAI adapter
      const embedding = await openAIAdapter.createEmbedding(trimmedText);

      logger.info('Embedding created successfully', {
        dimensions: embedding.length,
        textLength: trimmedText.length,
        estimatedCost: openAIAdapter.estimateCost(trimmedText)
      });

      return embedding;
    } catch (error) {
      logger.error(`Error in EmbeddingService.createEmbedding: ${error}`);
      throw error; // Re-throw to let caller handle
    }
  }

  /** Get embedding model information */
  getModelInfo(): { model: string; dimensions: number } {
    return openAIAdapter.getModelInfo();
  }

  /** Create embedding with detailed metrics (tokens, cost, duration) */
  async createEmbeddingWithMetrics(
    text: string
  ): Promise<{
    embedding: number[];
    tokens: number;
    cost: number;
    duration: number;
  }> {
    const startTime = Date.now();
    const tokens = openAIAdapter.estimateTokens(text);
    const cost = openAIAdapter.estimateCost(text);

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

  /** Batch create embeddings (processes sequentially with rate limiting) */
  async createEmbeddingsBatch(
    texts: string[],
    delayMs: number = 100
  ): Promise<number[][]> {
    const embeddings: number[][] = [];

    logger.info('Starting batch embedding', { count: texts.length, delayMs });

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      embeddings.push(await this.createEmbedding(text));

      // Rate limiting: space out requests
      if (i < texts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    logger.info('Batch embedding completed', { count: embeddings.length });
    return embeddings;
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();
