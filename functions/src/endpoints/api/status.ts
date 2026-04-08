import { Request, Response } from 'express';
import logger from '../../services/firebase/logger';
import {
  getPineconeClient,
  getPineconeIndexName,
  getOrCreatePineconeIndex
} from '../../adapters/pinecone';


/**
 * Get detailed Pinecone index information
 *
 * Sample request:
 * curl -X GET http://localhost:5001/YOUR_PROJECT/us-central1/pinecone/info \
 * -H "auth_token: some_value"
 */
export const getIndexInfoHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const pc = getPineconeClient();
    const indexName = getPineconeIndexName();

    // Get all indexes and find the current one
    const indexes = await pc.listIndexes();
    const currentIndex = indexes.indexes?.find(i => i.name === indexName);

    if (!currentIndex) {
      res.status(404).json({ error: 'Index not found' });
      return;
    }

    // Get index stats
    const index = pc.index({ name: indexName });
    const stats = await index.describeIndexStats();

    const info = {
      indexName: currentIndex.name,
      dimension: currentIndex.dimension,
      metric: currentIndex.metric,
      status: currentIndex.status,
      host: currentIndex.host,
      totalVectors: stats.totalRecordCount ?? 0,
      namespaces: Object.keys(stats.namespaces || {}),
      namespaceDetails: stats.namespaces || {},
      timestamp: new Date().toISOString()
    };

    res.json({ success: true, data: info });
  } catch (error) {
    logger.error(`Error getting index info: ${error}`);
    res.status(500).json({ error: 'Failed to get index info' });
  }
};

/**
 * List all Pinecone indexes
 *
 * Sample request:
 * curl -X GET http://localhost:5001/YOUR_PROJECT/us-central1/pinecone/indexes \
 * -H "auth_token: some_value"
 */
export const listIndexesHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const pc = getPineconeClient();
    const indexes = await pc.listIndexes();

    const indexList = indexes.indexes?.map(index => ({
      name: index.name,
      dimension: index.dimension,
      metric: index.metric,
      status: index.status,
      host: index.host
    })) || [];

    res.json({
      success: true,
      data: {
        totalIndexes: indexList.length,
        indexes: indexList,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`Error listing indexes: ${error}`);
    res.status(500).json({ error: 'Failed to list indexes' });
  }
};

/**
 * Ensure Pinecone index exists (create if not exists)
 *
 * Sample request:
 * curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/pinecone/ensure \
 * -H "auth_token: some_value"
 */
export const ensureIndexHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const index = await getOrCreatePineconeIndex();

    res.json({
      success: true,
      data: {
        indexName: index.name,
        dimension: index.dimension,
        metric: index.metric,
        status: index.status?.state,
        message: index.status?.state === 'Ready' ? 'Index ready' : 'Index created/updated',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`Error ensuring index exists: ${error}`);
    res.status(500).json({ error: 'Failed to ensure index exists' });
  }
};

/**
 * Quick Pinecone connection test
 *
 * Sample request:
 * curl -X GET http://localhost:5001/YOUR_PROJECT/us-central1/pinecone/health \
 * -H "auth_token: some_value"
 */
export const healthCheckHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const pc = getPineconeClient();
    const indexes = await pc.listIndexes();

    res.json({
      success: true,
      data: {
        connected: true,
        totalIndexes: indexes.indexes?.length || 0,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`Error checking Pinecone health: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Pinecone connection failed',
      data: {
        connected: false,
        timestamp: new Date().toISOString()
      }
    });
  }
};
