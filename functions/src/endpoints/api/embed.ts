import { Request, Response } from 'express';
import logger from '../../services/firebase/logger';
import { embeddingService } from '../../services/embedding';

/** Sample: REQ {text: string} | RES {success: boolean, embedding: number[], dimensions: 1536, estimatedCost: number} */
export const embedHandler = async (req: Request, res: Response): Promise<void> => {
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

    res.json({
      success: true,
      text: text.substring(0, 100), // Echo back (truncated)
      embedding,
      dimensions: embedding.length,
      model: modelInfo.model,
      estimatedCost: (embedding.length / 4 / 1_000_000) * 0.02, // Rough estimate
    });

  } catch (error) {
    logger.error(`Error in embedHandler: ${error}`);
    res.status(500).json({
      error: (error as any).message || 'Internal server error'
    });
  }
};
