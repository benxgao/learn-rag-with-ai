/**
 * Query Decomposer Service
 * Breaks multi-hop queries into independent sub-queries
 */

import { getOpenAIClient } from '../../adapters/openai';
import {
  QueryType,
  QueryClassification,
  DecomposedQuery,
  SubQuery,
} from '../../types';
import logger from '../../services/firebase/logger';

export async function decomposeQuery(
  query: string,
  classification: QueryClassification,
): Promise<DecomposedQuery> {
  const startTime = Date.now();

  try {
    // No decomposition needed for single-part queries
    if (
      classification.classification === QueryType.SINGLE_FACTUAL ||
      classification.classification === QueryType.DESCRIPTIVE
    ) {
      const noDecompResult: DecomposedQuery = {
        originalQuery: query,
        subQueries: [
          {
            id: '0',
            query: query,
            sequenceNumber: 0,
            importance: 1.0,
            expectedDocCount: 5,
          },
        ],
        synthesis: 'Direct answer - no decomposition needed',
        complexity: 0.1,
      };

      logger.info('Query does not require decomposition', {
        query,
        classification: classification.classification,
      });

      return noDecompResult;
    }

    const openaiClient = getOpenAIClient();

    const prompt = `Break this query into 2-4 independent, atomic sub-queries.
Each sub-query should be retrievable independently.

Original: "${query}"

Format your response as:
QUERY_1: <sub-query 1>
QUERY_2: <sub-query 2>
[optional QUERY_3, QUERY_4]

SYNTHESIS: How to combine results
COMPLEXITY: [0.1-1.0]

Example for "Compare Python and JavaScript for web development":
QUERY_1: What are the advantages of Python for web development?
QUERY_2: What are the advantages of JavaScript for web development?
QUERY_3: Comparison matrix between Python and JavaScript frameworks
SYNTHESIS: Present advantages separately, then comparative analysis
COMPLEXITY: 0.6`;

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 600,
    });

    const content = response.choices[0].message.content || '';
    const lines = content.split('\n').filter((l) => l.trim());

    const subQueries: SubQuery[] = [];
    let synthesis = '';
    let complexity = 0.5;

    let sequenceNum = 0;
    for (const line of lines) {
      if (line.startsWith('QUERY_')) {
        const match = line.match(/QUERY_\d+:\s*(.+)/);
        if (match) {
          const queryText = match[1].trim();
          subQueries.push({
            id: `${sequenceNum}`,
            query: queryText,
            sequenceNumber: sequenceNum,
            importance: Math.max(0, 1.0 - sequenceNum * 0.15),
            expectedDocCount: 5,
          });
          sequenceNum++;
        }
      } else if (line.startsWith('SYNTHESIS:')) {
        synthesis = line.split(':').slice(1).join(':').trim();
      } else if (line.startsWith('COMPLEXITY:')) {
        const complexityStr = line.split(':').slice(1).join(':').trim();
        const parsed = parseFloat(complexityStr);
        if (!isNaN(parsed)) {
          complexity = Math.min(Math.max(parsed, 0), 1);
        }
      }
    }

    // Ensure at least one sub-query
    if (subQueries.length === 0) {
      logger.warn('Decomposer produced no sub-queries, using original query', {
        query,
      });
      subQueries.push({
        id: '0',
        query: query,
        sequenceNumber: 0,
        importance: 1.0,
        expectedDocCount: 5,
      });
      synthesis = 'Decomposition failed, using original query';
      complexity = 0.1;
    }

    const result: DecomposedQuery = {
      originalQuery: query,
      subQueries,
      synthesis,
      complexity,
    };

    const duration = Date.now() - startTime;
    logger.info('Query decomposed successfully', {
      query,
      subQueryCount: subQueries.length,
      complexity,
      durationMs: duration,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Query decomposition failed', {
      query,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: duration,
    });

    // Graceful fallback: return original query as single sub-query
    return {
      originalQuery: query,
      subQueries: [
        {
          id: '0',
          query: query,
          sequenceNumber: 0,
          importance: 1.0,
          expectedDocCount: 5,
        },
      ],
      synthesis: 'Decomposition failed, using original query',
      complexity: 0.1,
    };
  }
}
