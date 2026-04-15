/**
 * Query Classifier Service
 * Categorizes query type to determine processing strategy
 */

import { getOpenAIClient } from '../../adapters/openai';
import { QueryType, QueryClassification } from '../../types';
import logger from '../../services/firebase/logger';

export async function classifyQuery(
  query: string,
): Promise<QueryClassification> {
  const startTime = Date.now();

  try {
    const openaiClient = getOpenAIClient();

    const prompt = `Classify this query into ONE category:
- SINGLE_FACTUAL: Direct factual questions ("What is X?")
- MULTI_HOP: Comparison or multi-part ("Compare X and Y", "How do X and Y relate?")
- DESCRIPTIVE: Explanations ("Explain X", "Tell me about X")
- PROCEDURAL: Step-by-step ("How do I X?", "Steps to X")
- ANALYTICAL: Analysis ("Why Z?", "What causes Z?")

Query: "${query}"

Respond with ONLY: [CATEGORY] [confidence_0_to_1] [one sentence reasoning]`;

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 100,
    });

    const content = response.choices[0].message.content || '';
    const parts = content.trim().split(/\s+/);

    if (parts.length < 2) {
      logger.warn('Classifier produced incomplete response', { query });
      // Default to DESCRIPTIVE
      return {
        query,
        classification: QueryType.DESCRIPTIVE,
        confidence: 0.5,
        reasoning: 'Classification failed, defaulting to DESCRIPTIVE',
      };
    }

    const category = parts[0].toUpperCase();
    const confidence = parseFloat(parts[1]);
    const reasoning = parts.slice(2).join(' ');

    // Validate category is a valid QueryType
    const validCategories = Object.values(QueryType);
    const classification =
      (validCategories.includes(category as QueryType)
        ? (category as QueryType)
        : QueryType.DESCRIPTIVE) || QueryType.DESCRIPTIVE;

    const result: QueryClassification = {
      query,
      classification,
      confidence: isNaN(confidence)
        ? 0.5
        : Math.min(Math.max(confidence, 0), 1),
      reasoning: reasoning || 'Classification completed',
    };

    const duration = Date.now() - startTime;
    logger.info('Query classified successfully', {
      query,
      classification,
      confidence: result.confidence,
      durationMs: duration,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Query classification failed', {
      query,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: duration,
    });

    // Default fallback
    return {
      query,
      classification: QueryType.DESCRIPTIVE,
      confidence: 0.0,
      reasoning: 'Classification failed, defaulting to DESCRIPTIVE',
    };
  }
}
