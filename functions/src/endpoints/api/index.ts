import { Router as createRouter } from 'express';
import {embedHandler} from './embed';

const router = createRouter();


/**
 * Sample request:
 *
  curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/embed \
  -H "Content-Type: application/json" \
  -H "auth_token: some_value" \
  -d '{"text": "hello world"}'
 */
router.post('/embed', embedHandler);


export default router;

