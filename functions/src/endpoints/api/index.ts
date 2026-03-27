import { Router as createRouter } from 'express';
import { verifyFirebaseToken } from '../../middlewares/firebase-auth';
import protectedResources from './protected-resources';

const router = createRouter();

router.post('/protected-resources', verifyFirebaseToken, protectedResources);

export default router;
