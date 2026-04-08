import { getPineconeClient } from './client';
import logger from '../../services/firebase/logger';
import { appConfig } from '../../config';
import { IndexConfig, IndexMetric } from './types';

const CFG: IndexConfig = {
  name: appConfig.pinecone.indexName,
  dimension: appConfig.openai.dimension,
  metric: IndexMetric.cosine,
};

/**
 * Get or create a Pinecone index
 * - Checks if index exists
 * - Creates if not found
 * - Waits for ready state (max 60 seconds)
 *
 * @returns Index metadata
 * @throws Error if index creation times out
 */
export async function getOrCreatePineconeIndex() {
  try {
    const pc = getPineconeClient();
    const { name } = CFG;

    logger.info('Checking for Pinecone index', { indexName: name });

    // 1. List existing indexes
    const indexes = await pc.listIndexes();
    const existing = indexes.indexes?.find((i) => i.name === name);

    if (existing) {
      logger.info('✓ Pinecone index already exists', {
        name: existing.name,
        dimension: existing.dimension,
        metric: existing.metric,
        status: existing.status?.state,
      });
      return existing;
    }

    logger.info('Index not found, creating...', { indexName: name });

    // 2. Create index
    await pc.createIndex({
      name,
      dimension: CFG.dimension,
      metric: CFG.metric,
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1',
        },
      },
    });

    logger.info('✓ Index creation initiated', { indexName: name });

    // 3. Wait for ready state (poll 30 times with 2s intervals = 60s max)
    for (let i = 0; i < 30; i++) {
      const indexes = await pc.listIndexes();
      const idx = indexes.indexes?.find((i) => i.name === name);

      if (idx?.status?.state === 'Ready') {
        logger.info('✓ Index is ready', {
          name: idx.name,
          dimension: idx.dimension,
          metric: idx.metric,
          status: idx.status.state,
        });
        return idx;
      }

      logger.info(`Waiting for index to be ready... (${i + 1}/30)`, {
        indexName: name,
        currentStatus: idx?.status?.state,
      });

      await new Promise((r) => setTimeout(r, 2000));
    }

    throw new Error(`Index creation timeout after 60 seconds: ${name}`);
  } catch (error) {
    logger.error('Error creating/getting index', { error });
    throw error;
  }
}

/**
 * Check Pinecone index health and vector count
 *
 * @param name - Index name (uses default if not provided)
 * @returns Health status and vector count
 */
export async function checkPineconeIndexHealth(
  name?: string,
): Promise<{ pinecone: { healthy: boolean; totalVectors: number } }> {
  try {
    const indexName = name ?? CFG.name;
    const pc = getPineconeClient();
    const index = pc.index({ name: indexName });

    const stats = await index.describeIndexStats();

    const health = {
      pinecone: {
        indexName,
        healthy: true,
        totalVectors: stats.totalRecordCount ?? 0,
      },
    };

    logger.info('✓ Index health check passed', {
      indexName,
      ...health,
      dimension: stats.dimension,
      namespaces: Object.keys(stats.namespaces || {}),
    });

    return health;
  } catch (error) {
    logger.error('Error checking index health', { error });
    throw error;
  }
}
