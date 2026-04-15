/**
 * Query Understanding & Decomposition Types
 * Handles query rewriting, classification, decomposition, and expansion
 */

/**
 * Query type classification enum
 */
export enum QueryType {
  SINGLE_FACTUAL = 'single_factual', // "What is X?"
  MULTI_HOP = 'multi_hop', // "Compare X and Y" / "How do X relate to Y?"
  DESCRIPTIVE = 'descriptive', // "Explain X" / "Tell me about X"
  PROCEDURAL = 'procedural', // "How do I..." / "Steps to..."
  ANALYTICAL = 'analytical', // "Why does X happen?" / "What causes X?"
}

/**
 * Query rewriting layer
 */
export interface QueryRewriteRequest {
  originalQuery: string;
  context?: string; // Optional conversation context
  maxTokensForRewrite?: number; // Default: 500
}

export interface QueryRewriteResponse {
  originalQuery: string;
  rewrittenQuery: string;
  rationale: string; // Why was it rewritten this way?
  confidenceScore: number; // 0.0-1.0
}

/**
 * Query classification layer
 */
export interface QueryClassification {
  query: string;
  classification: QueryType;
  confidence: number;
  reasoning: string;
}

/**
 * Query decomposition layer
 */
export interface SubQuery {
  id: string;
  query: string;
  sequenceNumber: number;
  dependency?: string; // ID of sub-query this depends on
  importance: number; // 0.0-1.0, for prioritization
  expectedDocCount: number;
}

export interface DecomposedQuery {
  originalQuery: string;
  subQueries: SubQuery[];
  synthesis: string; // Guidelines for combining results
  complexity: number; // 0.0-1.0
}

/**
 * Query expansion layer
 */
export interface QueryVariant {
  query: string;
  strategy: 'synonym' | 'expansion' | 'specific' | 'general';
  similarity: number; // 0.0-1.0 to original
}

export interface ExpandedQuery {
  originalQuery: string;
  variants: QueryVariant[];
  totalVariants: number;
}

/**
 * Step tracking for transformation visibility
 */
export interface QueryProcessingStep {
  step: 'rewrite' | 'classification' | 'decompose' | 'expand';
  input: string | string[];
  output:
    | string
    | string[]
    | DecomposedQuery['subQueries']
    | QueryVariant[]
    | 'NO_DECOMPOSITION_NEEDED';
  metadata: Record<string, any>;
  durationMs?: number;
}

/**
 * Complete query processing result
 */
export interface QueryProcessingResult {
  originalQuery: string;
  rewrittenQuery: string;
  classification: QueryType;
  decomposed: DecomposedQuery | null;
  expanded: ExpandedQuery | null;
  allQueriesToExecute: string[];
  transformationSteps: QueryProcessingStep[];
  totalProcessingTimeMs: number;
}

/**
 * Enhanced search API types
 */
export interface EnhancedSearchRequest {
  question: string;
  context?: string;
  useExpansion?: boolean; // Default: true
  decomposeLargeQueries?: boolean; // Default: true
  maxExpansions?: number; // Default: 2
  topK?: number; // Default: 10
}

export interface ProcessedQueryInfo {
  query: string;
  source: 'rewritten' | 'decomposed' | 'expanded';
  subQueryId?: string; // If from decomposer
}

export interface EnhancedSearchResponse {
  originalQuery: string;
  transformationSteps: QueryProcessingStep[];
  processedQueries: ProcessedQueryInfo[];
  retrievalResults: RetrievalResult[];
  metadata: {
    totalQueriesExecuted: number;
    totalDocumentsRetrieved: number;
    uniqueDocumentsInResults: number;
    processingTimeMs: {
      rewrite?: number;
      classification?: number;
      decompose?: number;
      expand?: number;
      retrieval?: number;
      deduplication?: number;
      ranking?: number;
      total: number;
    };
  };
}

/**
 * Retrieval result interface (from rag.ts)
 * Included for reference - matches RetrievalResult from rag types
 */
export interface RetrievalResult {
  id: string;
  text: string;
  score: number;
  metadata?: Record<string, any>;
}

/**
 * Query processing options
 */
export interface QueryProcessingOptions {
  useExpansion?: boolean;
  decomposeLargeQueries?: boolean;
  maxExpansions?: number;
  enableLogging?: boolean;
}
