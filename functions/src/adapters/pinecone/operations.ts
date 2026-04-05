import { getPineconeClient } from './client';
import { appConfig } from '../../config';

const INDEX_NAME = appConfig.pinecone.indexName ?? 'rag-documents';

/**
 * Get typed index client for upsert/query operations
 * Lazy initializes the index connection
 *
 * @returns Index instance for operations
 */
export function getIndexClient() {
  return getPineconeClient().index(INDEX_NAME);
}

/**
 * Get the configured index name
 *
 * @returns Current index name
 */
export function getIndexName(): string {
  return INDEX_NAME;
}
