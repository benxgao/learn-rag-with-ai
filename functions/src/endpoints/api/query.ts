/**
 * Query Processing & Enhanced Search Endpoint
 * Combines query understanding with semantic search
 */

import { Router, Request, Response } from 'express';
import { processQuery } from '../../services/query';
import { querySimilar } from '../../services/rag/retrieval';
import {
  EnhancedSearchRequest,
  EnhancedSearchResponse,
  ProcessedQueryInfo,
  RetrievalResult,
} from '../../types';
import logger from '../../services/firebase/logger';

const router = Router();

/**
 * Deduplicates retrieval results by document ID
 * Keeps track of which queries retrieved each document
 */
function deduplicateResults(
  results: (RetrievalResult & { sourceQuery?: string })[],
): (RetrievalResult & { sourceQueries: string[] })[] {
  const deduped: Map<string, RetrievalResult & { sourceQueries: string[] }> = new Map();

  for (const result of results) {
    if (deduped.has(result.id)) {
      const existing = deduped.get(result.id)!;
      if (!existing.sourceQueries.includes(result.sourceQuery || '')) {
        existing.sourceQueries.push(result.sourceQuery || '');
      }
      // Update score if newer is higher
      if (result.score > existing.score) {
        existing.score = result.score;
      }
    } else {
      deduped.set(result.id, {
        ...result,
        sourceQueries: result.sourceQuery ? [result.sourceQuery] : [],
      });
    }
  }

  return Array.from(deduped.values());
}

/**
 * Ranks results by consistency (documents retrieved by multiple queries ranked higher)
 */
function rankResultsByConsistency(
  results: (RetrievalResult & { sourceQueries: string[] })[],
  _queriesExecuted: string[],
): (RetrievalResult & { sourceQueries: string[] })[] {
  // Sort by:
  // 1. Number of queries that retrieved this document (descending)
  // 2. Score (descending)
  return results.sort((a, b) => {
    const aQueryCount = a.sourceQueries.length;
    const bQueryCount = b.sourceQueries.length;

    if (aQueryCount !== bQueryCount) {
      return bQueryCount - aQueryCount;
    }

    return b.score - a.score;
  });
}

/**
 * POST /api/query/enhanced-search
 *
 * Enhanced semantic search with query understanding
 *
 * Request body:
 * {
 *   "question": "Tell me about that programming thing",
 *   "context": "optional conversation context",
 *   "useExpansion": true,
 *   "decomposeLargeQueries": true,
 *   "maxExpansions": 2,
 *   "topK": 10
 * }
 *
 * Response (200 OK):
 * {
 *   "originalQuery": "Tell me about that programming thing",
 *   "transformationSteps": [
 *     {
 *       "step": "rewrite",
 *       "input": "Tell me about that programming thing",
 *       "output": "What are the fundamentals of programming?",
 *       "metadata": { "rationale": "...", "confidenceScore": 0.88 },
 *       "durationMs": 425
 *     },
 *     ...
 *   ],
 *   "processedQueries": [
 *     { "query": "What are the fundamentals of programming?", "source": "rewritten" },
 *     { "query": "Programming basics", "source": "expanded" }
 *   ],
 *   "retrievalResults": [...],
 *   "metadata": {
 *     "totalQueriesExecuted": 3,
 *     "totalDocumentsRetrieved": 15,
 *     "uniqueDocumentsInResults": 10,
 *     "processingTimeMs": { ... }
 *   }
 * }
 */
router.post('/enhanced-search', async (req: Request, res: Response): Promise<void> => {
  const globalStartTime = Date.now();

  try {
    const {
      question,
      useExpansion = true,
      decomposeLargeQueries = true,
      maxExpansions = 2,
      topK = 10,
    } = req.body as EnhancedSearchRequest;

    // ===== Validation =====
    if (!question || typeof question !== 'string') {
      logger.warn('Enhanced search request missing question field');
      res.status(400).json({
        error: 'question field required in request body (must be non-empty string)',
      });
      return;
    }

    if (question.trim().length === 0) {
      logger.warn('Enhanced search: empty question');
      res.status(400).json({
        error: 'question cannot be empty',
      });
      return;
    }

    if (question.length > 1000) {
      logger.warn('Enhanced search: question too long', { length: question.length });
      res.status(400).json({
        error: 'question too long (max 1000 characters)',
      });
      return;
    }

    logger.info('Enhanced search request received', {
      questionLength: question.length,
      question: question.substring(0, 50),
      useExpansion,
      decomposeLargeQueries,
    });

    // ===== Step 1: Query Processing =====
    const processQueryStartTime = Date.now();
    const processingResult = await processQuery(question, {
      useExpansion,
      decomposeLargeQueries,
      maxExpansions,
      enableLogging: true,
    });
    const processingTimeMs = Date.now() - processQueryStartTime;

    logger.info('Query processing completed', {
      totalQueries: processingResult.allQueriesToExecute.length,
      processingTimeMs,
    });

    // ===== Step 2: Execute Retrieval for Each Query =====
    const retrievalStartTime = Date.now();
    const allResults: (RetrievalResult & { sourceQuery?: string })[] = [];

    for (const processedQuery of processingResult.allQueriesToExecute) {
      try {
        const results = await querySimilar(processedQuery, topK);

        // Tag results with source query for tracking
        const taggedResults = results.map((r) => ({
          ...r,
          sourceQuery: processedQuery,
        }));

        allResults.push(...taggedResults);
      } catch (error) {
        logger.error('Retrieval failed for query', {
          query: processedQuery,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue with next query instead of failing completely
      }
    }

    const retrievalTimeMs = Date.now() - retrievalStartTime;

    logger.info('Retrieval completed', {
      queriesExecuted: processingResult.allQueriesToExecute.length,
      totalResultsRetrieved: allResults.length,
      retrievalTimeMs,
    });

    // ===== Step 3: Deduplication =====
    const deduplicateStartTime = Date.now();
    const deduplicated = deduplicateResults(allResults);
    const deduplicationTimeMs = Date.now() - deduplicateStartTime;

    logger.info('Deduplication completed', {
      beforeDedup: allResults.length,
      afterDedup: deduplicated.length,
      deduplicationTimeMs,
    });

    // ===== Step 4: Ranking =====
    const rankingStartTime = Date.now();
    const ranked = rankResultsByConsistency(
      deduplicated,
      processingResult.allQueriesToExecute,
    );
    const rankingTimeMs = Date.now() - rankingStartTime;

    // Take top K results
    const finalResults = ranked.slice(0, topK) as (RetrievalResult & { sourceQueries: string[] })[];

    logger.info('Ranking completed', {
      beforeRanking: deduplicated.length,
      afterRanking: finalResults.length,
      rankingTimeMs,
    });

    // ===== Step 5: Build Response =====
    const processedQueries: ProcessedQueryInfo[] = processingResult.allQueriesToExecute.map(
      (query, index) => {
        // Determine source
        // eslint-disable-next-line no-useless-assignment
        let source: 'rewritten' | 'decomposed' | 'expanded' = 'rewritten';
        let subQueryId: string | undefined;

        if (index === 0) {
          source = 'rewritten';
        } else if (
          processingResult.decomposed &&
          processingResult.decomposed.subQueries.length > 1 &&
          index < processingResult.decomposed.subQueries.length
        ) {
          source = 'decomposed';
          subQueryId = processingResult.decomposed.subQueries[index - 1].id;
        } else {
          source = 'expanded';
        }

        return {
          query,
          source,
          subQueryId,
        };
      },
    );

    const totalTimeMs = Date.now() - globalStartTime;

    const response: EnhancedSearchResponse = {
      originalQuery: processingResult.originalQuery,
      transformationSteps: processingResult.transformationSteps,
      processedQueries,
      retrievalResults: finalResults as any as RetrievalResult[],
      metadata: {
        totalQueriesExecuted: processingResult.allQueriesToExecute.length,
        totalDocumentsRetrieved: allResults.length,
        uniqueDocumentsInResults: deduplicated.length,
        processingTimeMs: {
          rewrite:
            processingResult.transformationSteps.find((s) => s.step === 'rewrite')
              ?.durationMs || 0,
          classification:
            processingResult.transformationSteps.find((s) => s.step === 'classification')
              ?.durationMs || 0,
          decompose:
            processingResult.transformationSteps.find((s) => s.step === 'decompose')
              ?.durationMs || 0,
          expand:
            processingResult.transformationSteps.find((s) => s.step === 'expand')
              ?.durationMs || 0,
          retrieval: retrievalTimeMs,
          deduplication: deduplicationTimeMs,
          ranking: rankingTimeMs,
          total: totalTimeMs,
        },
      },
    };

    logger.info('Enhanced search response ready', {
      resultsCount: finalResults.length,
      totalTimeMs,
    });

    res.json(response);
  } catch (error) {
    const totalTimeMs = Date.now() - globalStartTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    logger.error('Enhanced search endpoint error', {
      error: errorMsg,
      totalTimeMs,
    });

    res.status(500).json({
      error: `Enhanced search failed: ${errorMsg}`,
    });
  }
});

export default router;
