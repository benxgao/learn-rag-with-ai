import { Request, Response, NextFunction } from 'express';
import { appConfig } from '../config';

/**
 * Middleware: auth_token
 * Description: Validates that the request header "auth_token" matches process.env.TEST_ENV
 * Sample IN: headers: { auth_token: "someValue" }
 * Sample OUT: 401 if mismatch, else next()
 */
export const authToken = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.headers['auth_token'];
  const expected = appConfig.app.auth_token;

  if (!expected) {
    res.status(500).json({ error: 'TEST_ENV not configured' });
    return;
  }

  if (token !== expected) {
    res.status(401).json({ error: 'Invalid auth_token' });
    return;
  }

  next();
};
