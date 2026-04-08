import { getPineconeClient } from './client';
import { appConfig } from '../../config';

const INDEX_NAME = appConfig.pinecone.indexName;

/**
 * Get typed index client for upsert/query operations
 * Lazy initializes the index connection
 *
 * @returns Index instance for operations
 */
export function getPineconeIndexClient() {
  return getPineconeClient().index({
    host: appConfig.pinecone.hostUrl,
  });
}

/**
 * Get the configured index name
 *
 * @returns Current index name
 */
export function getPineconeIndexName(): string {
  return INDEX_NAME;
}
