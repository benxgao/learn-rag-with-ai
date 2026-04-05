/**
 * Vector metadata structure
 * Used for semantic search context and document attribution
 */
export interface VectorMetadata {
  /** Original text content */
  text: string;
  /** Reference to source document */
  documentId: string;
  /** Position of chunk within document */
  chunkIndex: number;
  /** Source URL or file path (optional) */
  source?: string;
  /** Creation timestamp (optional) */
  timestamp?: number;
  /** Additional custom metadata */
  [key: string]: any;
}

/**
 * Vector data structure for upsert operations
 * Ready for bulk insert/update to Pinecone
 */
export interface UpsertVector {
  /** Unique vector identifier */
  id: string;
  /** Vector embeddings (1536-d for OpenAI) */
  values: number[];
  /** Associated metadata (optional) */
  metadata?: VectorMetadata;
}

/**
 * Query vector structure for search operations
 */
export interface QueryVector {
  /** Query embeddings */
  values: number[];
  /** Top K results to return (default: 10) */
  topK?: number;
  /** Namespace filter (optional) */
  namespace?: string;
  /** Include metadata in results */
  includeMetadata?: boolean;
  /** Include values in results */
  includeValues?: boolean;
}

/**
 * Query result structure
 */
export interface QueryResult {
  /** Unique vector ID */
  id: string;
  /** Similarity score (0-1 for cosine) */
  score: number;
  /** Associated metadata */
  metadata?: VectorMetadata;
  /** Vector values (if requested) */
  values?: number[];
}

/**
 * Index configuration
 */
export interface IndexConfig {
  /** Index name */
  name: string;
  /** Vector dimension (e.g., 1536 for OpenAI) */
  dimension: number;
  /** Distance metric: 'cosine', 'euclidean', or 'dotproduct' */
  metric: 'cosine' | 'euclidean' | 'dotproduct';
}
