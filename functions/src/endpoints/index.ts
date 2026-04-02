import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import healthcheck from './healthcheck';
import auth from './auth';
import api from './api';
import { authToken } from '../middlewares/auth_token';

const app = express();

app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Compression middleware
app.use(compression());

app.use(cors());

app.use(express.json());

app.use('/healthcheck', healthcheck);

app.use('/auth', auth);

app.use('/api', authToken, api);

export default app;
