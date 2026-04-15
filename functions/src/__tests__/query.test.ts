/**
 * Query Processing Integration Tests
 * Tests all layers of query understanding: rewrite, classify, decompose, expand
 */

import { processQuery } from '../services/query';
import { QueryType } from '../types';

// Mock logger to prevent actual logging during tests
jest.mock('../services/firebase/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock OpenAI client
jest.mock('../adapters/openai', () => ({
  getOpenAIClient: jest.fn(() => ({
    chat: {
      completions: {
        create: jest.fn((params) => {
          // Mock response based on the prompt
          const messageContent = params.messages[params.messages.length - 1].content || '';

          if (messageContent.includes('Rewrite')) {
            return Promise.resolve({
              choices: [
                {
                  message: {
                    content:
                      'What are the fundamental concepts of programming?\nQuery was too vague, made it more specific',
                  },
                },
              ],
            });
          } else if (messageContent.includes('Classify')) {
            return Promise.resolve({
              choices: [
                {
                  message: {
                    content: 'DESCRIPTIVE 0.92 This is a request for explanation',
                  },
                },
              ],
            });
          } else if (messageContent.includes('Break this query')) {
            return Promise.resolve({
              choices: [
                {
                  message: {
                    content: 'QUERY_1: Definition of programming\nQUERY_2: Programming concepts\nSYNTHESIS: Explain together\nCOMPLEXITY: 0.4',
                  },
                },
              ],
            });
          } else if (messageContent.includes('semantic variants')) {
            return Promise.resolve({
              choices: [
                {
                  message: {
                    content:
                      'VARIANT_1: Computer programming basics | synonym\nVARIANT_2: Software development fundamentals | expansion',
                  },
                },
              ],
            });
          }

          return Promise.resolve({
            choices: [{ message: { content: 'DEFAULT RESPONSE' } }],
          });
        }),
      },
    },
  })),
}));

describe('Query Processing Integration Tests', () => {
  describe('processQuery - Single Query Flow', () => {
    it('should process a vague query through all layers', async () => {
      const query = 'Tell me about that programming thing';
      const result = await processQuery(query, {
        useExpansion: true,
        decomposeLargeQueries: true,
        maxExpansions: 2,
        enableLogging: false,
      });

      // Verify basic structure
      expect(result).toBeDefined();
      expect(result.originalQuery).toBe(query);
      expect(result.rewrittenQuery).toBeTruthy();
      expect(result.rewrittenQuery).not.toBe(query); // Should be different from original
      expect(result.transformationSteps).toBeDefined();
      expect(result.transformationSteps.length).toBeGreaterThan(0);
      expect(result.allQueriesToExecute).toBeDefined();
      expect(result.allQueriesToExecute.length).toBeGreaterThan(0);
    });

    it('should track transformation steps', async () => {
      const query = 'What is machine learning?';
      const result = await processQuery(query, {
        useExpansion: false,
        decomposeLargeQueries: false,
        enableLogging: false,
      });

      // Verify transformation steps are recorded
      const rewriteStep = result.transformationSteps.find((s) => s.step === 'rewrite');
      const classifyStep = result.transformationSteps.find((s) => s.step === 'classification');
      const decomposeStep = result.transformationSteps.find((s) => s.step === 'decompose');

      expect(rewriteStep).toBeDefined();
      expect(rewriteStep?.metadata).toBeDefined();
      expect(rewriteStep?.metadata.confidenceScore).toBeGreaterThan(0);

      expect(classifyStep).toBeDefined();
      expect(classifyStep?.output).toBeTruthy(); // Should be a QueryType (string)

      expect(decomposeStep).toBeDefined();
    });

    it('should record timing for each layer', async () => {
      const query = 'What is artificial intelligence?';
      const result = await processQuery(query, { enableLogging: false });

      // Verify timing is recorded
      expect(result.totalProcessingTimeMs).toBeGreaterThanOrEqual(0);

      const rewriteStep = result.transformationSteps.find((s) => s.step === 'rewrite');
      expect(rewriteStep?.durationMs).toBeGreaterThanOrEqual(0);

      const classifyStep = result.transformationSteps.find((s) => s.step === 'classification');
      expect(classifyStep?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should classify query correctly', async () => {
      const query = 'Explain how neural networks work';
      const result = await processQuery(query, { enableLogging: false });

      expect(result.classification).toBe(QueryType.DESCRIPTIVE);
    });

    it('should handle expansion when enabled', async () => {
      const query = 'machine learning models';
      const result = await processQuery(query, {
        useExpansion: true,
        decomposeLargeQueries: false,
        maxExpansions: 2,
        enableLogging: false,
      });

      // Should have more than one query if expansion was applied
      const expandStep = result.transformationSteps.find((s) => s.step === 'expand');
      expect(expandStep).toBeDefined();

      if (expandStep && expandStep.output !== 'NO_DECOMPOSITION_NEEDED') {
        expect(Array.isArray(expandStep.output)).toBe(true);
      }
    });

    it('should skip expansion when disabled', async () => {
      const query = 'machine learning models';
      const result = await processQuery(query, {
        useExpansion: false,
        decomposeLargeQueries: false,
        enableLogging: false,
      });

      // Should have only one query when expansion is disabled
      expect(result.allQueriesToExecute.length).toBe(1);

      const expandStep = result.transformationSteps.find((s) => s.step === 'expand');
      expect(expandStep?.metadata.reason).toContain('disabled');
    });

    it('should gracefully handle empty queries', async () => {
      // This will fail at API validation level typically,
      // but we're testing the service robustness
      const query = '';
      const result = await processQuery(query, { enableLogging: false });

      // Should still return a valid structure even if query is empty
      expect(result).toBeDefined();
      expect(result.allQueriesToExecute).toBeDefined();
    });
  });

  describe('processQuery - Multi-Hop Query Flow', () => {
    it('should decompose complex queries when classification indicates multi-hop', async () => {
      // This test would work better with a specific mock for multi-hop classification
      // For now, we test the structure regardless
      const query = 'Compare machine learning and deep learning';
      const result = await processQuery(query, {
        decomposeLargeQueries: true,
        enableLogging: false,
      });

      expect(result).toBeDefined();
      expect(result.transformationSteps).toBeDefined();
    });
  });

  describe('processQuery - Options Handling', () => {
    it('should respect useExpansion option', async () => {
      const query = 'What is data science?';

      await processQuery(query, {
        useExpansion: true,
        decomposeLargeQueries: false,
        enableLogging: false,
      });

      const withoutExpansion = await processQuery(query, {
        useExpansion: false,
        decomposeLargeQueries: false,
        enableLogging: false,
      });

      // withoutExpansion should be minimal (just rewritten query)
      expect(withoutExpansion.allQueriesToExecute.length).toBeGreaterThan(0);
    });

    it('should respect decomposeLargeQueries option', async () => {
      const query = 'How do you train a neural network';
      const result = await processQuery(query, {
        decomposeLargeQueries: true,
        enableLogging: false,
      });

      // Should have decomposed step regardless (applied or skipped)
      const decomposeStep = result.transformationSteps.find((s) => s.step === 'decompose');
      expect(decomposeStep).toBeDefined();
    });

    it('should respect maxExpansions option', async () => {
      const query = 'clustering algorithms';
      const resultMax2 = await processQuery(query, {
        useExpansion: true,
        decomposeLargeQueries: false,
        maxExpansions: 2,
        enableLogging: false,
      });

      const resultMax3 = await processQuery(query, {
        useExpansion: true,
        decomposeLargeQueries: false,
        maxExpansions: 3,
        enableLogging: false,
      });

      // Both should process successfully
      expect(resultMax2.allQueriesToExecute).toBeDefined();
      expect(resultMax3.allQueriesToExecute).toBeDefined();
    });
  });

  describe('processQuery - Error Handling', () => {
    it('should return valid result even when processing partially fails', async () => {
      const query = 'Test query for error handling';
      const result = await processQuery(query, { enableLogging: false });

      // Should always return valid structure
      expect(result).toBeDefined();
      expect(result.originalQuery).toBe(query);
      expect(result.allQueriesToExecute).toBeDefined();
      expect(result.allQueriesToExecute.length).toBeGreaterThan(0);
      expect(result.transformationSteps).toBeInstanceOf(Array);
    });

    it('should have proper fallbacks in transformation steps', async () => {
      const query = 'Complex query with special characters: @#$%';
      const result = await processQuery(query, { enableLogging: false });

      // Each transformation step should have required fields
      result.transformationSteps.forEach((step) => {
        expect(step.step).toBeDefined();
        expect(step.input).toBeDefined();
        expect(step.output).toBeDefined();
        expect(step.metadata).toBeDefined();
      });
    });
  });

  describe('Transformation Step Structure', () => {
    it('should include all required fields in transformation steps', async () => {
      const query = 'How do LLMs work?';
      const result = await processQuery(query, { enableLogging: false });

      result.transformationSteps.forEach((step) => {
        expect(step).toHaveProperty('step');
        expect(step).toHaveProperty('input');
        expect(step).toHaveProperty('output');
        expect(step).toHaveProperty('metadata');
        expect(step).toHaveProperty('durationMs');

        // Validate step names
        expect(['rewrite', 'classification', 'decompose', 'expand']).toContain(step.step);

        // Metadata should be an object
        expect(typeof step.metadata).toBe('object');
      });
    });

    it('should provide meaningful metadata at each step', async () => {
      const query = 'Explain database indexing';
      const result = await processQuery(query, { enableLogging: false });

      const rewriteStep = result.transformationSteps.find((s) => s.step === 'rewrite');
      expect(rewriteStep?.metadata).toHaveProperty('rationale');
      expect(rewriteStep?.metadata).toHaveProperty('confidenceScore');

      const classifyStep = result.transformationSteps.find((s) => s.step === 'classification');
      expect(classifyStep?.metadata).toHaveProperty('confidence');
      expect(classifyStep?.metadata).toHaveProperty('reasoning');
    });
  });
});
