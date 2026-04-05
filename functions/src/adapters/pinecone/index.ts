/**
 * Pinecone Adapter Module
 *
 * Provides unified access to Pinecone functionality:
 * - Client management (singleton pattern)
 * - Index lifecycle (create, check health, delete)
 * - Index operations (upsert, query)
 * - Type definitions
 */

// Client management
export { getPineconeClient, resetPineconeClient } from './client';

// Index lifecycle
export { getOrCreateIndex, checkIndexHealth, deleteIndex } from './lifecycle';

// Index operations
export { getIndexClient, getIndexName } from './operations';

// Type definitions
export type {
  VectorMetadata,
  UpsertVector,
  QueryVector,
  QueryResult,
  IndexConfig
} from './types';
