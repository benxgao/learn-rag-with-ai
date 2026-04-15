/**
 * Query Processing Orchestrator
 * Combines all query processing layers and tracks transformations
 */

import {
  QueryProcessingResult,
  QueryProcessingStep,
  QueryProcessingOptions,
  QueryType,
} from '../../types';
import { rewriteQuery } from './rewriter';
import { classifyQuery } from './classifier';
import { decomposeQuery } from './decomposer';
import { expandQuery } from './expander';
import logger from '../firebase/logger';

export async function processQuery(
  originalQuery: string,
  options: QueryProcessingOptions = {},
): Promise<QueryProcessingResult> {
  const globalStartTime = Date.now();
  const transformationSteps: QueryProcessingStep[] = [];

  try {
    const {
      useExpansion = true,
      decomposeLargeQueries = true,
      maxExpansions = 2,
      enableLogging = true,
    } = options;

    // Step 1: Rewrite Query
    const rewriteStartTime = Date.now();
    const rewriteResponse = await rewriteQuery({
      originalQuery,
      maxTokensForRewrite: 500,
    });
    const rewriteDuration = Date.now() - rewriteStartTime;

    transformationSteps.push({
      step: 'rewrite',
      input: originalQuery,
      output: rewriteResponse.rewrittenQuery,
      metadata: {
        rationale: rewriteResponse.rationale,
        confidenceScore: rewriteResponse.confidenceScore,
      },
      durationMs: rewriteDuration,
    });

    if (enableLogging) {
      logger.info('Step 1 (Rewrite) completed', {
        original: originalQuery,
        rewritten: rewriteResponse.rewrittenQuery,
        durationMs: rewriteDuration,
      });
    }

    // Step 2: Classify Query
    const classifyStartTime = Date.now();
    const classification = await classifyQuery(rewriteResponse.rewrittenQuery);
    const classifyDuration = Date.now() - classifyStartTime;

    transformationSteps.push({
      step: 'classification',
      input: rewriteResponse.rewrittenQuery,
      output: classification.classification,
      metadata: {
        confidence: classification.confidence,
        reasoning: classification.reasoning,
      },
      durationMs: classifyDuration,
    });

    if (enableLogging) {
      logger.info('Step 2 (Classification) completed', {
        query: rewriteResponse.rewrittenQuery,
        classification: classification.classification,
        confidence: classification.confidence,
        durationMs: classifyDuration,
      });
    }

    // Step 3: Decompose Query (if applicable)
    let decomposed = null;
    let decomposeDuration = 0;

    if (
      decomposeLargeQueries &&
      classification.classification !== QueryType.SINGLE_FACTUAL
    ) {
      const decomposeStartTime = Date.now();
      decomposed = await decomposeQuery(
        rewriteResponse.rewrittenQuery,
        classification,
      );
      decomposeDuration = Date.now() - decomposeStartTime;

      const isNoDecomposition =
        decomposed.subQueries.length === 1 &&
        decomposed.subQueries[0].query === rewriteResponse.rewrittenQuery;

      transformationSteps.push({
        step: 'decompose',
        input: rewriteResponse.rewrittenQuery,
        output: isNoDecomposition
          ? 'NO_DECOMPOSITION_NEEDED'
          : decomposed.subQueries,
        metadata: {
          complexity: decomposed.complexity,
          synthesis: decomposed.synthesis,
          subQueryCount: decomposed.subQueries.length,
          wasDecomposed: !isNoDecomposition,
        },
        durationMs: decomposeDuration,
      });

      if (enableLogging) {
        logger.info('Step 3 (Decompose) completed', {
          query: rewriteResponse.rewrittenQuery,
          complexity: decomposed.complexity,
          subQueryCount: decomposed.subQueries.length,
          durationMs: decomposeDuration,
        });
      }
    } else {
      // No decomposition for single-factual queries
      decomposed = {
        originalQuery: rewriteResponse.rewrittenQuery,
        subQueries: [
          {
            id: '0',
            query: rewriteResponse.rewrittenQuery,
            sequenceNumber: 0,
            importance: 1.0,
            expectedDocCount: 5,
          },
        ],
        synthesis: 'No decomposition needed',
        complexity: 0.1,
      };

      transformationSteps.push({
        step: 'decompose',
        input: rewriteResponse.rewrittenQuery,
        output: 'NO_DECOMPOSITION_NEEDED',
        metadata: {
          reason: 'Single-part query or decomposition disabled',
          complexity: 0.1,
        },
        durationMs: 0,
      });
    }

    // Step 4: Expand Query (if applicable)
    let expanded = null;
    let expandDuration = 0;
    const allQueriesToExecute: string[] = [];

    // Add rewritten/decomposed queries first
    if (decomposed.subQueries.length === 1) {
      allQueriesToExecute.push(decomposed.subQueries[0].query);
    } else {
      allQueriesToExecute.push(...decomposed.subQueries.map((sq) => sq.query));
    }

    // Apply expansion if enabled and only for single-query case
    if (useExpansion && allQueriesToExecute.length === 1) {
      const expandStartTime = Date.now();
      expanded = await expandQuery(allQueriesToExecute[0], maxExpansions);
      expandDuration = Date.now() - expandStartTime;

      if (expanded.variants.length > 0) {
        allQueriesToExecute.push(...expanded.variants.map((v) => v.query));
      }

      transformationSteps.push({
        step: 'expand',
        input: allQueriesToExecute[0],
        output: expanded.variants.length > 0 ? expanded.variants : [],
        metadata: {
          variantCount: expanded.totalVariants,
          totalQueriesAfterExpansion: allQueriesToExecute.length,
        },
        durationMs: expandDuration,
      });

      if (enableLogging) {
        logger.info('Step 4 (Expand) completed', {
          query: allQueriesToExecute[0],
          variantCount: expanded.totalVariants,
          totalQueries: allQueriesToExecute.length,
          durationMs: expandDuration,
        });
      }
    } else {
      // No expansion
      transformationSteps.push({
        step: 'expand',
        input: allQueriesToExecute[0] || rewriteResponse.rewrittenQuery,
        output: [],
        metadata: {
          reason: useExpansion
            ? 'Multi-query case, expansion skipped'
            : 'Expansion disabled',
          variantCount: 0,
        },
        durationMs: 0,
      });
    }

    const totalProcessingTimeMs = Date.now() - globalStartTime;

    const result: QueryProcessingResult = {
      originalQuery,
      rewrittenQuery: rewriteResponse.rewrittenQuery,
      classification: classification.classification,
      decomposed,
      expanded: expanded || {
        originalQuery: rewriteResponse.rewrittenQuery,
        variants: [],
        totalVariants: 0,
      },
      allQueriesToExecute,
      transformationSteps,
      totalProcessingTimeMs,
    };

    logger.info('Query processing completed', {
      originalQuery,
      totalQueries: allQueriesToExecute.length,
      totalTimeMs: totalProcessingTimeMs,
    });

    return result;
  } catch (error) {
    const totalProcessingTimeMs = Date.now() - globalStartTime;

    logger.error('Query processing failed', {
      originalQuery,
      error: error instanceof Error ? error.message : 'Unknown error',
      totalTimeMs: totalProcessingTimeMs,
    });

    // Return minimal result with original query
    return {
      originalQuery,
      rewrittenQuery: originalQuery,
      classification: QueryType.DESCRIPTIVE,
      decomposed: null,
      expanded: null,
      allQueriesToExecute: [originalQuery],
      transformationSteps,
      totalProcessingTimeMs,
    };
  }
}
