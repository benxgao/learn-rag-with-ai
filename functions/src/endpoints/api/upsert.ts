import { Request, Response } from 'express';
import logger from '../../services/firebase/logger';
import { Document } from '../../services/rag/document-loader';
import { upsertDocuments, UpsertMetrics } from '../../services/rag/upsert';

/**
 * POST /api/upsert
 *
 * Upsert documents into Pinecone index
 *
 * This endpoint accepts documents in JSON format and upsets them to Pinecone.
 * It handles embedding, batching, and tracking metrics.
 *
 * TEST DATA (for testing without file uploads):
 * {
 *   "documents": [
 *     {
 *       "id": "doc-1",
 *       "text": "Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed.",
 *       "metadata": { "source": "ai-intro", "difficulty": "beginner" }
 *     },
 *     {
 *       "id": "doc-2",
 *       "text": "Embeddings are numerical representations of text that capture semantic meaning. They allow us to perform similarity search on documents.",
 *       "metadata": { "source": "embeddings-guide", "difficulty": "intermediate" }
 *     },
 *     {
 *       "id": "doc-3",
 *       "text": "Vector databases like Pinecone optimize storage and retrieval of embeddings at scale. They use advanced indexing techniques like HNSW.",
 *       "metadata": { "source": "vector-db", "difficulty": "intermediate" }
 *     }
 *   ],
 *   "batchSize": 50,
 *   "rateLimitMs": 200
 * }
 *
 * PSEUDO RESPONSE (successful upsert):
 * HTTP 200
 * {
 *   "status": "success",
 *   "message": "Documents upserted successfully",
 *   "metrics": {
 *     "documentsLoaded": 3,
 *     "documentsEmbedded": 3,
 *     "vectorsUpserted": 3,
 *     "failedCount": 0,
 *     "totalTime": 1500,
 *     "embeddingCost": 0.000001,
 *     "storageCost": 0.000075
 *   },
 *   "summary": {
 *     "duration": "1.5s",
 *     "success": true,
 *     "failed": 0
 *   }
 * }
 *
 * ERROR RESPONSE (validation failure):
 * HTTP 400
 * {
 *   "error": "Invalid request",
 *   "details": "documents array required and must contain at least 1 document"
 * }
 *
 * ERROR RESPONSE (upsert failure):
 * HTTP 500
 * {
 *   "error": "Upsert failed",
 *   "details": "Failed to embed document doc-1: Invalid API key"
 * }
 *
 * CURL EXAMPLES:
 *
 * Basic upsert:
 * curl -X POST http://localhost:5000/api/upsert \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "documents": [
 *       {
 *         "id": "doc-1",
 *         "text": "Sample document text",
 *         "metadata": { "source": "test" }
 *       }
 *     ]
 *   }'
 *
 * Upsert with options:
 * curl -X POST http://localhost:5000/api/upsert \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "documents": [...],
 *     "batchSize": 100,
 *     "rateLimitMs": 200,
 *     "dryRun": false
 *   }'
 */
export const upsertHandler = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();

  try {
    const { documents, batchSize, rateLimitMs, dryRun } = req.body;

    // Validate request
    if (!documents || !Array.isArray(documents)) {
      logger.warn('Upsert request missing documents array');
      res.status(400).json({
        error: 'Invalid request',
        details: 'documents array required and must contain at least 1 document'
      });
      return;
    }

    if (documents.length === 0) {
      logger.warn('Upsert request with empty documents array');
      res.status(400).json({
        error: 'Invalid request',
        details: 'documents array must contain at least 1 document'
      });
      return;
    }

    // Validate document structure
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      if (!doc.id || typeof doc.id !== 'string') {
        logger.warn(`Document at index ${i} missing required 'id' field`);
        res.status(400).json({
          error: 'Invalid request',
          details: `Document at index ${i} missing required 'id' field (must be string)`
        });
        return;
      }
      if (!doc.text || typeof doc.text !== 'string') {
        logger.warn(`Document ${doc.id} missing required 'text' field`);
        res.status(400).json({
          error: 'Invalid request',
          details: `Document ${doc.id} missing required 'text' field (must be string)`
        });
        return;
      }
    }

    // Validate options if provided
    if (batchSize && (typeof batchSize !== 'number' || batchSize < 1 || batchSize > 1000)) {
      logger.warn('Invalid batchSize option');
      res.status(400).json({
        error: 'Invalid request',
        details: 'batchSize must be a number between 1 and 1000'
      });
      return;
    }

    if (rateLimitMs && (typeof rateLimitMs !== 'number' || rateLimitMs < 0)) {
      logger.warn('Invalid rateLimitMs option');
      res.status(400).json({
        error: 'Invalid request',
        details: 'rateLimitMs must be a non-negative number'
      });
      return;
    }

    logger.info('Upsert request received', {
      documentCount: documents.length,
      batchSize: batchSize || 100,
      rateLimitMs: rateLimitMs || 100,
      dryRun: dryRun || false
    });

    // Prepare documents with validation
    const docsToUpsert: Document[] = documents.map(doc => ({
      id: String(doc.id),
      text: String(doc.text).trim(),
      metadata: doc.metadata || {}
    }));

    // Call upsert service
    const metrics: UpsertMetrics = await upsertDocuments(docsToUpsert, {
      batchSize: batchSize || 100,
      dryRun: dryRun || false
    });

    const duration = Date.now() - startTime;

    logger.info('Upsert completed successfully', {
      vectorsUpserted: metrics.vectorsUpserted,
      failedCount: metrics.failedCount,
      duration,
    });

    res.json({
      status: 'success',
      message: 'Documents upserted successfully',
      metrics,
      summary: {
        duration: `${(duration / 1000).toFixed(1)}s`,
        success: metrics.failedCount === 0,
        failed: metrics.failedCount
      }
    });

  } catch (error: any) {
    logger.error(`Error in upsertHandler: ${error}`);

    res.status(500).json({
      error: 'Upsert failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * GET /api/upsert/sample
 *
 * Returns sample test data for upsert testing
 *
 * RESPONSE:
 * HTTP 200
 * {
 *   "documents": [
 *     {
 *       "id": "doc-1",
 *       "text": "Machine learning is a subset of artificial intelligence...",
 *       "metadata": { "source": "ai-intro", "difficulty": "beginner" }
 *     },
 *     ...
 *   ],
 *   "instructions": {
 *     "description": "Sample documents for testing upsert endpoint",
 *     "fields": {
 *       "id": "Unique identifier for the document",
 *       "text": "Document content to embed",
 *       "metadata": "Optional metadata object (any key-value pairs)"
 *     },
 *     "usage": "POST these documents to /api/upsert to test the endpoint"
 *   }
 * }
 */
export const sampleUpsertDataHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const sampleData = {
      documents: [
        {
          id: 'doc-1',
          text: 'Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed.',
          metadata: { source: 'ai-intro', difficulty: 'beginner' }
        },
        {
          id: 'doc-2',
          text: 'Embeddings are numerical representations of text that capture semantic meaning. They allow us to perform similarity search on documents.',
          metadata: { source: 'embeddings-guide', difficulty: 'intermediate' }
        },
        {
          id: 'doc-3',
          text: 'Vector databases like Pinecone optimize storage and retrieval of embeddings at scale. They use advanced indexing techniques like HNSW.',
          metadata: { source: 'vector-db', difficulty: 'intermediate' }
        }
      ],
      instructions: {
        description: 'Sample documents for testing upsert endpoint',
        fields: {
          id: 'Unique identifier for the document',
          text: 'Document content to embed',
          metadata: 'Optional metadata object (any key-value pairs)'
        },
        usage: 'POST these documents to /api/upsert to test the endpoint'
      }
    };

    logger.info('Sample upsert data requested');
    res.json(sampleData);

  } catch (error: any) {
    logger.error(`Error in sampleUpsertDataHandler: ${error}`);

    res.status(500).json({
      error: 'Failed to generate sample data',
      details: error instanceof Error ? error.message : String(error)
    });
  }
};
