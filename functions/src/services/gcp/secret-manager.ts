import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import logger from '../firebase/logger';

/**
 * Retrieves a secret from Google Cloud Secret Manager.
 *
 * @param {string} secretName The name of the secret to retrieve.
 * @param {string} version The version of the secret to retrieve (optional, defaults to 'latest').
 * @return {Promise<string>} The secret value as a string.
 * @throws {Error} If the secret cannot be accessed or retrieved.
 */
export async function getSecret(
  secretName: string,
  version?: string,
): Promise<string> {
  const client = new SecretManagerServiceClient();

  const name = `projects/${
    process.env.GCP_PROJECT_NUMBER
  }/secrets/${secretName}/versions/${version || 'latest'}`;

  const [secretVersion] = await client.accessSecretVersion({
    name,
  });

  if (!secretVersion?.payload?.data) {
    throw new Error(`unable to retrieve secret: ${secretName}`);
  }

  const secret = secretVersion.payload.data.toString();

  logger.info(
    `Secret retrieved successfully: ${secretName} (version: ${
      version || 'latest'
    })`,
  );

  logger.info(`Secret value: ${secretVersion.payload.data}`);

  return secret;
}
