/**
 * Query Rewriter Service
 * Transforms user queries into semantic-optimized form while preserving intent
 */

import { getOpenAIClient } from '../../adapters/openai';
import { QueryRewriteRequest, QueryRewriteResponse } from '../../types';
import logger from '../../services/firebase/logger';

export async function rewriteQuery(
  request: QueryRewriteRequest,
): Promise<QueryRewriteResponse> {
  const startTime = Date.now();

  try {
    const openaiClient = getOpenAIClient();

    const systemPrompt = `You are a query optimization expert.
Your task is to rewrite user queries to be more specific, clear, and semantically rich
for vector database retrieval.

Rules:
- Keep the original intent
- Be specific rather than vague
- Remove filler words
- Use technical terms if applicable
- Optimize for semantic search (not keyword search)

Return a single rewritten query and brief rationale.`;

    const userPrompt = `Rewrite this query for semantic search optimization:
Original: "${request.originalQuery}"
${request.context ? `Context: "${request.context}"` : ''}

Provide:
1. Rewritten query (on first line)
2. Brief rationale (one sentence)`;

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // Low temperature: focused, deterministic
      max_tokens: request.maxTokensForRewrite || 500,
    });

    const content = response.choices[0].message.content || '';
    const lines = content.split('\n').filter((l) => l.trim());

    if (lines.length < 1) {
      logger.warn('Rewriter produced empty response', {
        originalQuery: request.originalQuery,
      });
      // Fallback: return original query
      return {
        originalQuery: request.originalQuery,
        rewrittenQuery: request.originalQuery,
        rationale: 'No rewrite generated',
        confidenceScore: 0.0,
      };
    }

    const rewritten = lines[0].trim();
    const rationale = lines[1]?.trim() || '';

    const result: QueryRewriteResponse = {
      originalQuery: request.originalQuery,
      rewrittenQuery: rewritten,
      rationale: rationale,
      confidenceScore: 0.85, // Could be derived from response logprobs in future
    };

    const duration = Date.now() - startTime;
    logger.info('Query rewritten successfully', {
      originalQuery: request.originalQuery,
      rewrittenQuery: rewritten,
      durationMs: duration,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Query rewriting failed', {
      originalQuery: request.originalQuery,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: duration,
    });

    // Graceful fallback: return original query
    return {
      originalQuery: request.originalQuery,
      rewrittenQuery: request.originalQuery,
      rationale: 'Rewriting failed, using original query',
      confidenceScore: 0.0,
    };
  }
}
