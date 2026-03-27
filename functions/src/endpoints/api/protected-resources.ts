// import { inspect } from 'util';
import { Response } from 'express';
import logger from '../../services/firebase/logger';
import { CustomRequest } from '../../types';

const handler = async (req: any | CustomRequest, res: Response) => {
  try {
    logger.info(
      `req.firebase_jwt_token: ${JSON.stringify(req.firebase_jwt_token)}`,
    );

    res.status(200).json({
      success: true,
    });
  } catch (error) {
    logger.error('Error in strapi endpoint:', error as any);
    res
      .status(
        error instanceof Error && error.message === 'Unauthorized' ? 401 : 500,
      )
      .json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
  }
};

export default handler;
