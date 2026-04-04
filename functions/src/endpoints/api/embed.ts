import { Request, Response } from 'express';
import logger from '../../services/firebase/logger';
import { embeddingService } from '../../services/embedding';

/**
 * Create semantic vector embedding from text
 *
 * Sample:
 * REQ {text: string}
 * RES {embedding: number[], dimensions: 1536, tokenCount: number, estimatedCost: number, model: string, duration: number}
 */
export const embedHandler = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();

  try {
    const { text } = req.body;

    // Validation
    if (!text) {
      res.status(400).json({
        error: 'text field required in request body',
      });
      return;
    }

    if (typeof text !== 'string') {
      res.status(400).json({
        error: 'text must be a string',
      });
      return;
    }

    if (text.length > 100000) {
      res.status(400).json({
        error: 'text exceeds 100,000 character limit',
      });
      return;
    }

    logger.info('Embed request received', {
      textLength: text.length,
      textPreview: text.substring(0, 50)
    });

    // Create embedding
    const embedding = await embeddingService.createEmbedding(text);
    const modelInfo = embeddingService.getModelInfo();
    const duration = Date.now() - startTime;

    // Estimate token count and cost
    const tokenCount = Math.ceil(text.length / 4); // Rough: 1 token ≈ 4 characters
    const estimatedCost = (tokenCount / 1_000_000) * 0.02; // $0.02 per 1M tokens

    res.json({
      embedding,
      dimensions: embedding.length,
      tokenCount,
      estimatedCost,
      model: modelInfo.model,
      duration,
    });

  } catch (error) {
    logger.error(`Error in embedHandler: ${error}`);
    res.status(500).json({
      error: (error as any).message || 'Internal server error'
    });
  }
};
