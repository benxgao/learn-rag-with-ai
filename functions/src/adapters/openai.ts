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
      if (text.length > 8000) {
        throw new Error('Text input too long (max 8000 characters)');
      }

      logger.info('Creating embedding', { textLength: text.length });

      const response = await getOpenAIClient().embeddings.create({
        model: this.model,
        input: text,
        encoding_format: 'float',
      });

      const embedding = response.data[0].embedding;

      logger.info('Embedding created successfully', {
        dimensions: embedding.length,
        model: this.model
      });

      return embedding;
    } catch (error) {
      logger.error(`Error in EmbeddingService.createEmbedding: ${error}`);
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
}

// Export singleton instance
export const openAIAdapter = new OpenAIAdapter();
