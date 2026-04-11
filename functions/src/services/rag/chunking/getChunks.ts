import * as R from 'ramda';

// Token estimation: ~4 characters per token (English average)
export const CHARS_PER_TOKEN = 4;

interface ChunkState {
  chunks: string[];
  current: string[];
  charCount: number;
}

/**
 * Generates fixed-size text chunks based on token limits
 *
 * Sample inputs/outputs:
 * IN: "hello world test" -> OUT: ["hello world test"]
 * IN: "hello world test", 2 -> OUT: ["hello world", "test"] (2 tokens ~ 8 chars)
 * IN: "The quick brown fox jumps over the lazy dog", 5 -> OUT: ["The quick brown", "fox jumps over", "the lazy dog"] (5 tokens ~ 20 chars each)
 * IN: "" -> OUT: []
 * IN: "   hello   world   ", 10 -> OUT: ["hello world"] (extra spaces removed)
 * IN: "a".repeat(1000), 50 -> OUT: Multiple chunks, each ≤ 200 chars (50 tokens × 4 chars/token)
 *
 * @param text - Input text to chunk
 * @param chunkSizeTokens - Maximum tokens per chunk (default: 512, ~2048 characters)
 * @returns Array of text chunks, each within token limit
 */
export const generateChunksInModeFixedSize = (
  text: string,
  chunkSizeTokens: number = 512,
): string[] => {
  const chunkSizeChars = chunkSizeTokens * CHARS_PER_TOKEN;
  const words = R.pipe(
    R.split(/\s+/),
    R.filter((word: string) => word.length > 0)
  )(text);

  const reducer = (state: ChunkState, word: string): ChunkState => {
    const wordWithSpace = R.isEmpty(state.current) ? word : ` ${word}`;
    const newCharCount = state.charCount + wordWithSpace.length;

    return newCharCount > chunkSizeChars && !R.isEmpty(state.current)
      ? {
        chunks: R.append(R.join(' ', state.current), state.chunks),
        current: [word],
        charCount: word.length
      }
      : {
        chunks: state.chunks,
        current: R.append(word, state.current),
        charCount: newCharCount
      };
  };

  const initialState: ChunkState = { chunks: [], current: [], charCount: 0 };
  const result = R.reduce(reducer, initialState, words);

  return R.isEmpty(result.current)
    ? result.chunks
    : R.append(R.join(' ', result.current), result.chunks);
};

/**
 * Generates overlapping text chunks using sliding window approach
 *
 * Sample inputs/outputs:
 * IN: "hello world test sample" -> OUT: ["hello world test sample"] (short text, single chunk)
 * IN: "hello world test sample", 3, 1 -> OUT: ["hello world test", "test sample"] (3 tokens, 1 overlap)
 * IN: "The quick brown fox jumps", 4, 2 -> OUT: ["The quick brown fox", "brown fox jumps"] (4 tokens, 2 overlap)
 * IN: "", 10, 5 -> OUT: []
 * IN: "word ".repeat(20), 5, 2 -> OUT: Overlapping chunks with ~2 word overlap between adjacent chunks
 * IN: "a".repeat(500), 10, 3 -> OUT: Overlapping chunks, each ≤ 40 chars (10 tokens × 4 chars/token)
 *
 * @param text - Input text to chunk
 * @param chunkSizeTokens - Maximum tokens per chunk (default: 512)
 * @param overlapTokens - Overlap between adjacent chunks (default: 100)
 * @returns Array of overlapping text chunks
 */
export const generateChunksInModeSlidingWindow = (
  text: string,
  chunkSizeTokens: number = 512,
  overlapTokens: number = 100,
): string[] => {
  const words = R.pipe(
    R.split(/\s+/),
    R.filter((word: string) => word.length > 0)
  )(text);

  const chunkSizeChars = chunkSizeTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;
  const stepChars = chunkSizeChars - overlapChars;
  const stepWords = Math.max(1, Math.ceil(stepChars / CHARS_PER_TOKEN));

  if (R.isEmpty(words)) {
    return [];
  }

  const createChunks = (position: number, chunks: string[]): string[] => {
    if (position >= words.length) {
      return chunks;
    }

    const endPosition = Math.min(position + chunkSizeTokens * 2, words.length);
    const chunk = R.join(' ', R.slice(position, endPosition, words));

    if (chunk.length > chunkSizeChars) {
      const trimmedChunk = R.take(chunkSizeChars, chunk);
      return createChunks(position + stepWords, R.append(trimmedChunk, chunks));
    } else {
      const newChunks = R.append(chunk, chunks);
      return endPosition === words.length
        ? newChunks
        : createChunks(position + stepWords, newChunks);
    }
  };

  return createChunks(0, []);
};

/**
 * Generates semantic text chunks based on markdown headers and paragraph breaks
 *
 * Sample inputs/outputs:
 * IN: "# Header 1\nContent here\n## Header 2\nMore content" -> OUT: ["# Header 1\nContent here", "## Header 2\nMore content"]
 * IN: "First paragraph with enough characters to trigger split.\n\nSecond paragraph here." -> OUT: ["First paragraph with enough characters to trigger split.", "Second paragraph here."]
 * IN: "Short\n\nText" -> OUT: ["Short\n\nText"] (doesn't split short chunks on blank lines)
 * IN: "" -> OUT: []
 * IN: "Just a single line of text." -> OUT: ["Just a single line of text."]
 * IN: "# Main Header\nSome content here\n\n# Another Header\nMore content" -> OUT: ["# Main Header\nSome content here", "# Another Header\nMore content"]
 * IN: "Line 1\nLine 2\n\nLine 3\nLine 4" (with >50 chars before break) -> OUT: ["Line 1\nLine 2", "Line 3\nLine 4"]
 *
 * @param text - Input text to chunk semantically
 * @returns Array of semantically separated text chunks
 */
export const generateChunksInModeSemantic = (text: string): string[] => {
  if (R.isEmpty(text)) {
    return [];
  }

  const lines = R.split('\n', text);

  interface SemanticState {
    chunks: string[];
    currentChunk: string;
  }

  const reducer = (state: SemanticState, line: string): SemanticState => {
    const trimmedLine = R.trim(line);
    const isHeader = R.test(/^#+\s/, trimmedLine);
    const isBreak = R.isEmpty(trimmedLine) && R.gt(R.length(R.trim(state.currentChunk)), 50);

    const shouldSplit = (isHeader || isBreak) && R.gt(R.length(R.trim(state.currentChunk)), 0);

    if (shouldSplit) {
      const nextChunk = isHeader ? trimmedLine : '';
      return {
        chunks: R.append(R.trim(state.currentChunk), state.chunks),
        currentChunk: nextChunk
      };
    } else {
      return {
        chunks: state.chunks,
        currentChunk: R.isEmpty(state.currentChunk) ? line : R.join('\n', [state.currentChunk, line])
      };
    }
  };

  const initialState: SemanticState = { chunks: [], currentChunk: '' };
  const result = R.reduce(reducer, initialState, lines);

  return R.isEmpty(result.currentChunk)
    ? result.chunks
    : R.append(R.trim(result.currentChunk), result.chunks);
};
