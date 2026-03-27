import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';

/**
 * In local, service account is loaded via $GOOGLE_APPLICATION_CREDENTIALS
 * Once deployed, Workload Identity Federation is used to authenticate, and cert is not needed.
 */
if (!admin.apps.length) {
  admin.initializeApp({});
}

export const firebaseAdmin = admin;
export const firebaseAuth = getAuth();
