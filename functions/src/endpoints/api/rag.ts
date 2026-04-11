import { Router, Request, Response } from 'express';
import { ask, RAGResult } from '../../services/rag/rag';
import logger from '../../services/firebase/logger';

const router = Router();

/**
 * POST /api/rag/ask
 *
 * Ask a question and get an answer grounded in the knowledge base
 *
 * Request body:
 * {
 *   "question": "What is machine learning?"
 * }
 *
 * Response (200 OK):
 * {
 *   "question": "What is machine learning?",
 *   "answer": "Based on the provided documents, machine learning is...",
 *   "sources": [
 *     {
 *       "id": "doc-1",
 *       "text": "Machine learning is a subset of artificial intelligence...",
 *       "score": 0.92
 *     },
 *     {
 *       "id": "doc-2",
 *       "text": "ML systems learn patterns from data...",
 *       "score": 0.85
 *     }
 *   ],
 *   "tokensUsed": 145,
 *   "duration": 1250
 * }
 *
 * Response (400 Bad Request):
 * {
 *   "error": "question field required in request body"
 * }
 *
 * Response (500 Internal Server Error):
 * {
 *   "error": "RAG pipeline failed: <details>"
 * }
 */
router.post('/ask', async (req: Request, res: Response) => {
  try {
    const { question } = req.body;

    // Validation: question field required
    if (!question) {
      logger.warn('RAG request missing question field');
      return res.status(400).json({
        error: 'question field required in request body',
      });
    }

    // Validation: question must be a string
    if (typeof question !== 'string') {
      logger.warn('RAG request: question not a string', { type: typeof question });
      return res.status(400).json({
        error: 'question must be a string',
      });
    }

    // Validation: question must not be empty
    if (question.trim().length === 0) {
      logger.warn('RAG request: empty question');
      return res.status(400).json({
        error: 'question cannot be empty',
      });
    }

    // Validation: question length limit
    if (question.length > 1000) {
      logger.warn('RAG request: question too long', { length: question.length });
      return res.status(400).json({
        error: 'question too long (max 1000 characters)',
      });
    }

    logger.info('RAG request received', {
      questionLength: question.length,
      question: question.substring(0, 50),
    });

    // Execute RAG pipeline
    const result: RAGResult = await ask(question);

    logger.info('RAG response ready', {
      duration: result.duration,
      tokensUsed: result.tokensUsed,
      sourceCount: result.sources.length,
    });

    return res.json(result);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`RAG endpoint error: ${errorMsg}`, { error });

    return res.status(500).json({
      error: `RAG pipeline failed: ${errorMsg}`,
    });
  }
});

export default router;
