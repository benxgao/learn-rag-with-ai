import { Request, Response } from 'express';
import logger from '../../services/firebase/logger';
import { embeddingService } from '../../adapters/openai/embedding';
import { validateEmbedRequest } from '../../utils/validation';

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
    // Validate request using schema
    const { text } = validateEmbedRequest(req.body);

    logger.info('Embed request received', {
      textLength: text.length,
      textPreview: text.substring(0, 50)
    });

    // Create embedding with metrics
    const { embedding, tokens, cost } = await embeddingService.createEmbeddingWithMetrics(text);
    const modelInfo = embeddingService.getModelInfo();
    const duration = Date.now() - startTime;

    res.json({
      embedding,
      dimensions: embedding.length,
      tokenCount: tokens,
      estimatedCost: cost,
      model: modelInfo.model,
      duration,
    });

  } catch (error: any) {
    logger.error(`Error in embedHandler: ${error}`);

    // Handle validation errors (Zod)
    if (error.name === 'ZodError') {
      res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
      return;
    }

    // Handle other errors
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
};

