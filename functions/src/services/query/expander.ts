/**
 * Query Expander Service
 * Generates semantic variants and synonyms for more comprehensive retrieval
 */

import { getOpenAIClient } from '../../adapters/openai';
import { ExpandedQuery, QueryVariant } from '../../types';
import logger from '../../services/firebase/logger';

export async function expandQuery(
  query: string,
  maxVariants: number = 2,
): Promise<ExpandedQuery> {
  const startTime = Date.now();

  try {
    const openaiClient = getOpenAIClient();

    const prompt = `Generate ${maxVariants} semantic variants of this query
using different strategies (synonyms, related concepts, broader/narrower scope).

Original: "${query}"

For each variant, specify the strategy used (synonym/expansion/specific/general).

Format:
VARIANT_1: [query variant] | [strategy]
VARIANT_2: [query variant] | [strategy]
${maxVariants > 2 ? 'VARIANT_3: [query variant] | [strategy]' : ''}

Example for "machine learning models":
VARIANT_1: ML algorithms | synonym
VARIANT_2: Neural network architectures | expansion
VARIANT_3: Deep learning techniques | specific`;

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 400,
    });

    const content = response.choices[0].message.content || '';
    const variants: QueryVariant[] = [];

    const lines = content
      .split('\n')
      .filter((l) => l.trim() && l.includes('VARIANT_'));

    lines.forEach((line, idx) => {
      const match = line.match(/VARIANT_\d+:\s*(.+?)\s*\|\s*(.+)/);
      if (match) {
        const variantQuery = match[1].trim();
        const strategy = match[2]
          .trim()
          .toLowerCase() as QueryVariant['strategy'];

        // Validate strategy
        const validStrategies = ['synonym', 'expansion', 'specific', 'general'];
        const normalizedStrategy = validStrategies.includes(strategy)
          ? (strategy as QueryVariant['strategy'])
          : 'synonym';

        variants.push({
          query: variantQuery,
          strategy: normalizedStrategy,
          similarity: Math.max(0.7, 0.9 - idx * 0.1), // Decreasing similarity with variants
        });
      }
    });

    // Ensure we have at least some variants, or none if expansion not applicable
    const result: ExpandedQuery = {
      originalQuery: query,
      variants,
      totalVariants: variants.length,
    };

    const duration = Date.now() - startTime;
    logger.info('Query expanded successfully', {
      query,
      variantCount: variants.length,
      durationMs: duration,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Query expansion failed', {
      query,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: duration,
    });

    // Graceful fallback: return no variants
    return {
      originalQuery: query,
      variants: [],
      totalVariants: 0,
    };
  }
}
