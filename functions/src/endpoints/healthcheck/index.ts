import { Router as createRouter } from 'express';
import logger from '../../services/firebase/logger';
import { getPineconeClient, checkIndexHealth } from '../../adapters/pinecone';

const router = createRouter();

router.get('/', async (_req, res): Promise<void> => {
  try {
    // Check if environment variables are configured
    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) {
      logger.warn('Healthcheck: Missing Pinecone environment variables');
      res.status(503).json({
        status: 'error',
        pinecone: 'not_configured',
        error: 'Missing Pinecone environment variables',
        missing: [
          !process.env.PINECONE_API_KEY && 'PINECONE_API_KEY',
          !process.env.PINECONE_INDEX_NAME && 'PINECONE_INDEX_NAME'
        ].filter(Boolean)
      });
      return;
    }

    // Test Pinecone connection
    getPineconeClient();
    const health = await checkIndexHealth();

    logger.info('Healthcheck endpoint hit', {
      pinecone: 'connected',
      indexName: process.env.PINECONE_INDEX_NAME,
      ...health
    });

    res.json({
      status: 'ok',
      pinecone: 'connected',
      indexName: process.env.PINECONE_INDEX_NAME,
      ...health
    });
  } catch (error) {
    logger.error('Healthcheck failed:', { error });
    res.status(500).json({
      status: 'error',
      pinecone: 'disconnected',
      error: error instanceof Error ? error.message : 'Failed to connect to Pinecone'
    });
  }
});

export default router;
