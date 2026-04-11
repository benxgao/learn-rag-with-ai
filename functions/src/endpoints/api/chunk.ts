import { Request, Response } from 'express';
import logger from '../../services/firebase/logger';
import {
  fixedSizeChunk,
  slidingWindowChunk,
  semanticChunk,
  evaluateAllStrategies,
} from '../../services/chunking';
import { ChunkStrategy } from '../../types/rag';


/**
 * POST /api/chunk
 *
 * Task 06: Chunk documents using three strategies and compare
 *
 * Request body:
 * {
 *   "text": "Your document text here...",
 *   "strategy": "fixed-size" | "sliding-window" | "semantic" | "compare",
 *   "chunkSize": 512 (optional, default: 512),
 *   "overlap": 100 (optional for sliding-window, default: 100)
 * }
 *
 * Response:
 * {
 *   "status": "success",
 *   "strategy": "fixed-size",
 *   "chunkCount": 3,
 *   "avgChunkSize": 245,
 *   "chunks": ["chunk 1...", "chunk 2...", "chunk 3..."],
 *   "metadata": {
 *     "estimatedTokens": 735,
 *     "estimatedCost": 0.000006
 *   }
 * }
 */
export async function postChunk(req: Request, res: Response) {
  try {
    const {
      text,
      isStrategyCompare = false,
      strategy,
      chunkSize = 512,
      overlap = 100,
    } = req.body;

    // Validation
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'text is required and must be non-empty string',
      });
    }

    if (text.length > 1000) {
      return res.status(400).json({
        status: 'error',
        message: 'text exceeds 100,000 character limit',
      });
    }

    const validStrategies = Object.values(ChunkStrategy);

    if (!validStrategies.includes(strategy)) {
      return res.status(400).json({
        status: 'error',
        message: `strategy must be one of: ${validStrategies.join(', ')}`,
      });
    }

    logger.info(
      `Chunking text (${text.length} chars) with strategy: ${strategy}`,
    );

    let result;

    if (isStrategyCompare) {
      // Compare all strategies and return detailed analysis
      const comparison = evaluateAllStrategies(
        text,
        chunkSize,
        chunkSize,
        overlap,
      );
      return res.status(200).json({
        status: 'success',
        mode: 'comparison',
        textLength: comparison.text.length,
        textEstimatedTokens: comparison.text.estimatedTokens,
        comparison: comparison.comparison,
        strategies: comparison.strategies.map((s) => ({
          strategy: s.metadata.strategy,
          chunkCount: s.chunkCount,
          avgChunkSize: s.avgChunkSize,
          estimatedTokens: s.metadata.estimatedTokens,
          estimatedCost: `$${s.metadata.estimatedCost.toFixed(8)}`,
        })),
      });
    } else {
      if (strategy === ChunkStrategy.FixedSize) {
        result = fixedSizeChunk(text, chunkSize);
      } else if (strategy === ChunkStrategy.SlidingWindow) {
        result = slidingWindowChunk(text, chunkSize, overlap);
      } else if (strategy === ChunkStrategy.Semantic) {
        result = semanticChunk(text);
      } else {
        throw new Error(
          'You have to define a strategy or mark isStrategyCompare as true',
        );
      }

      // Return single strategy result
      return res.status(200).json({
        status: 'success',
        strategy: result?.metadata.strategy,
        chunkCount: result?.chunkCount,
        avgChunkSize: result?.avgChunkSize,
        chunks: result?.chunks,
        metadata: {
          chunkSize: result?.metadata.chunkSize,
          overlap: result?.metadata.overlap,
          estimatedTokens: result?.metadata.estimatedTokens,
          estimatedCost: `${result?.metadata.estimatedCost.toFixed(8)}`,
        },
      });
    }
  } catch (error) {
    logger.error(`Chunk endpoint error: ${error}`);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
