/**
 * Task 06: Chunking Strategies
 * Three implementations: Fixed-size, Sliding Window, Semantic
 * Trade-offs: simplicity vs context preservation vs retrieval quality
 */
// import * as R from 'ramda';
import { ChunkStrategy } from '../types/rag';

// Token estimation: ~4 characters per token (English average)
const CHARS_PER_TOKEN = 4;

/**
 * Interface for chunking results with metadata
 */
export interface ChunkedResult {
  chunks: string[];
  chunkCount: number;
  avgChunkSize: number;
  metadata: {
    strategy: string;
    chunkSize: number;
    overlap?: number;
    estimatedTokens: number;
    estimatedCost: number;
  };
}

/**
 * Strategy 1: Fixed-size chunking
 * Pros: ✅ Simple, fast, deterministic, cheapest
 * Cons: ❌ No context at boundaries, breaks mid-sentence
 *
 * Best for: Initial testing, homogeneous documents
 */
export function fixedSizeChunk(
  text: string,
  chunkSizeTokens: number = 512,
): ChunkedResult {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let charCount = 0;
  const chunkSizeChars = chunkSizeTokens * CHARS_PER_TOKEN;

  for (const word of words) {
    const wordWithSpace = currentChunk.length === 0 ? word : ` ${word}`;
    if (
      charCount + wordWithSpace.length > chunkSizeChars &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [word];
      charCount = word.length;
    } else {
      currentChunk.push(word);
      charCount += wordWithSpace.length;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  const totalChars = text.length;
  const estimatedTokens = Math.ceil(totalChars / CHARS_PER_TOKEN);
  const estimatedCost = chunks.length * 0.000002; // $0.02 per 1M tokens

  return {
    chunks,
    chunkCount: chunks.length,
    avgChunkSize: Math.round(totalChars / chunks.length),
    metadata: {
      strategy: ChunkStrategy.FixedSize,
      chunkSize: chunkSizeTokens,
      estimatedTokens,
      estimatedCost,
    },
  };
}

/**
 * Strategy 2: Sliding window chunking
 * Pros: ✅ Context preserved at boundaries, better retrieval quality
 * Cons: ❌ More chunks = 15-25% higher cost
 *
 * Best for: Text documents, papers, continuous prose
 */
export function slidingWindowChunk(
  text: string,
  chunkSizeTokens: number = 512,
  overlapTokens: number = 100,
): ChunkedResult {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const chunks: string[] = [];
  const chunkSizeChars = chunkSizeTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;
  const stepChars = chunkSizeChars - overlapChars;

  let position = 0;

  while (position < words.length) {
    const endPosition = Math.min(position + chunkSizeTokens * 2, words.length); // Conservative estimate
    const chunk = words.slice(position, endPosition).join(' ');

    // Check actual character size and trim if needed
    if (chunk.length > chunkSizeChars) {
      const trimmedChunk = chunk.substring(0, chunkSizeChars);
      chunks.push(trimmedChunk);
      position += Math.max(1, Math.ceil(stepChars / CHARS_PER_TOKEN));
    } else {
      chunks.push(chunk);
      if (endPosition === words.length) break;
      position += Math.max(1, Math.ceil(stepChars / CHARS_PER_TOKEN));
    }
  }

  const totalChars = text.length;
  const estimatedTokens = Math.ceil(totalChars / CHARS_PER_TOKEN);
  const estimatedCost = chunks.length * 0.000002;

  return {
    chunks,
    chunkCount: chunks.length,
    avgChunkSize: Math.round(totalChars / chunks.length),
    metadata: {
      strategy: ChunkStrategy.SlidingWindow,
      chunkSize: chunkSizeTokens,
      overlap: overlapTokens,
      estimatedTokens,
      estimatedCost,
    },
  };
}

/**
 * Strategy 3: Semantic chunking by headers
 * Pros: ✅ Topically coherent chunks, best retrieval quality
 * Cons: ❌ Requires structured documents with headers
 *
 * Best for: Markdown/structured documents, papers with headers
 */
export function semanticChunk(text: string): ChunkedResult {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let currentChunk = '';

  for (const line of lines) {
    const isHeader = /^#+\s/.test(line.trim());
    const isBreak = line.trim().length === 0 && currentChunk.trim().length > 50;

    if ((isHeader || isBreak) && currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = isHeader ? line : '';
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  const totalChars = text.length;
  const estimatedTokens = Math.ceil(totalChars / CHARS_PER_TOKEN);
  const estimatedCost = chunks.length * 0.000002;

  return {
    chunks,
    chunkCount: chunks.length,
    avgChunkSize: Math.round(totalChars / chunks.length),
    metadata: {
      strategy: ChunkStrategy.Semantic,
      chunkSize: 0, // Variable size
      estimatedTokens,
      estimatedCost,
    },
  };
}

/**
 * Evaluate and compare all three strategies
 * Returns metrics for cost-quality analysis
 */
export function evaluateAllStrategies(
  text: string,
  fixedSize: number = 512,
  slidingSize: number = 512,
  slidingOverlap: number = 100,
) {
  const fixed = fixedSizeChunk(text, fixedSize);
  const sliding = slidingWindowChunk(text, slidingSize, slidingOverlap);
  const semantic = semanticChunk(text);

  return {
    text: {
      length: text.length,
      estimatedTokens: Math.ceil(text.length / CHARS_PER_TOKEN),
    },
    strategies: [fixed, sliding, semantic],
    comparison: {
      chunkCounts: {
        fixed: fixed.chunkCount,
        sliding: sliding.chunkCount,
        semantic: semantic.chunkCount,
      },
      costs: {
        fixed: fixed.metadata.estimatedCost,
        sliding: sliding.metadata.estimatedCost,
        semantic: semantic.metadata.estimatedCost,
      },
      costMultipliers: {
        slidingVsFixed: (sliding.chunkCount / fixed.chunkCount).toFixed(2),
        semanticVsFixed: (semantic.chunkCount / fixed.chunkCount).toFixed(2),
      },
      recommendation:
        semantic.chunkCount < fixed.chunkCount
          ? 'semantic (best quality + cost)'
          : 'sliding-window (good balance)',
    },
  };
}
