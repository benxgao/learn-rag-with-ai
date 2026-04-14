import { z } from 'zod';

/**
 * Validation schemas for API requests
 * Using Zod for type-safe request body validation
 */

/** Embed endpoint request schema */
export const embedRequestSchema = z.object({
  text: z
    .string({ error: 'text must be a string' })
    .min(1, 'text is required and cannot be empty')
    .max(100000, 'text exceeds 100,000 character limit'),
});

/** Type inferred from schema */
export type EmbedRequest = z.infer<typeof embedRequestSchema>;

/**
 * Validate embed request
 * @returns Validated request data or throws ZodError
 */
export function validateEmbedRequest(data: unknown): EmbedRequest {
  return embedRequestSchema.parse(data);
}
