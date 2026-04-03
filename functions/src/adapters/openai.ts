import { getOpenAIClient } from '../services/openai';
import logger from '../services/firebase/logger';
import { EmbeddingError } from '../types/errors';

/** Description: OpenAI embedding adapter | Sample: IN "hello world" -> OUT [0.1, 0.2, ...] */
export class OpenAIAdapter {
  private model = 'text-embedding-3-small';
  private dimensions = 1536;

  /** Creates embedding vector from text input */
  async createEmbedding(text: string): Promise<number[]> {
    try {
      // Validate input
      if (!text || text.trim().length === 0) {
        throw new Error('Text input cannot be empty');
      }

      // Rate limit protection: check text length
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

  /** Get embedding model info */
  getModelInfo(): { model: string; dimensions: number } {
    return {
      model: this.model,
      dimensions: this.dimensions,
    };
  }

  /** Estimate tokens in text (rough approximation) */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /** Estimate cost of embedding request (Pricing: $0.02 per 1M input tokens) */
  estimateCost(text: string): number {
    const tokens = this.estimateTokens(text);
    const costPerToken = 0.02 / 1_000_000;
    return tokens * costPerToken;
  }
}

// Export singleton instance
export const openAIAdapter = new OpenAIAdapter();
