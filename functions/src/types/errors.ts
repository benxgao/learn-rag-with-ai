/**
 * Custom error class for embedding-related errors
 * Properly extends Error with cause support
 */
export class EmbeddingError extends Error {
  public readonly cause: Error | unknown;

  constructor(message: string, cause?: Error | unknown) {
    super(message);
    this.name = 'EmbeddingError';
    this.cause = cause;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, EmbeddingError.prototype);
  }
}
