import { Pinecone, Index } from '@pinecone-database/pinecone';
import logger from '../services/firebase/logger';
import { appConfig } from '../config';

let pineconeClient: Pinecone | null = null;
let indexClient: Index | null = null;

/** Description: Initialize Pinecone client and get index instance */
export async function getIndex(): Promise<Index> {
  try {
    const { apiKey, indexName } = appConfig.pinecone;
    if (!apiKey || !indexName) {
      throw new Error('Missing required Pinecone environment variables: PINECONE_API_KEY or PINECONE_INDEX_NAME');
    }

    if (!pineconeClient) {
      pineconeClient = new Pinecone({ apiKey });
    }

    if (!indexClient) {
      indexClient = pineconeClient.index(indexName);

      try {
        /**
         *  Sample:
            stats = {
              dimension: 512,
              totalRecordCount: 1500,
              namespaces:{
                'default':{
                  recordCount: 1500
                }
              },
              indexFullness,
              totalRecordCount
            }
         */
        const stats = await indexClient.describeIndexStats();

        logger.info('Pinecone index connected', {
          indexName,
          dimensions: stats.dimension,
          totalVectorCount: stats.totalRecordCount,
          namespaces: Object.keys(stats.namespaces || {})
        });
      } catch (statsError) {
        logger.warn('Could not retrieve Pinecone index stats', { error: statsError });
      }
    }

    return indexClient;
  } catch (error) {
    logger.error('Error initializing Pinecone client:', { error });
    throw error;
  }
}
