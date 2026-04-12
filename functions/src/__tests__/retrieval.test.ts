/**
 * Task 07: Eval Retrieval [advanced]
 *
 * Systematic evaluation methods to measure retrieval quality
 * Implements Precision@K, Recall@K, MRR, and NDCG metrics
 */

import { querySimilar, RetrievalResult } from '../services/rag/retrieval';
import logger from '../services/firebase/logger';

/**
 * Test case interface - defines query and expected relevant documents
 */
export interface TestCase {
  id: string;
  query: string;
  expectedDocs: string[]; // Document IDs that should be retrieved
  explanation?: string; // Why these docs are relevant
}

/**
 * Evaluation result interface - stores metrics for a single query
 */
export interface EvalResult {
  queryId: string;
  query: string;
  retrieved: string[]; // Retrieved document IDs in order
  expected: string[]; // Expected relevant document IDs
  precision: number; // Precision@K
  recall: number; // Recall@K
  mrr: number; // Mean Reciprocal Rank
  ndcg: number; // Normalized Discounted Cumulative Gain
  success: boolean; // Passes thresholds
  explanation?: string;
}

/**
 * Summary metrics across all test cases
 */
export interface EvalSummary {
  totalQueries: number;
  successCount: number;
  passRate: number;
  avgPrecision: number;
  avgRecall: number;
  avgMRR: number;
  avgNDCG: number;
  results: EvalResult[];
}

/**
 * Test cases matching the 5 seeded documents from Task 03
 * - doc-1: Machine learning
 * - doc-2: Vector databases
 * - doc-3: Embeddings
 * - doc-4: RAG (Retrieval-Augmented Generation)
 * - doc-5: Semantic search
 */
export const testCases: TestCase[] = [
  {
    id: 'test-ml-definition',
    query: 'What is machine learning?',
    expectedDocs: ['doc-1'],
    explanation: 'Directly about ML definition',
  },
  {
    id: 'test-vector-db',
    query: 'How do vector databases work?',
    expectedDocs: ['doc-2'],
    explanation: 'Core topic of vector databases',
  },
  {
    id: 'test-embeddings-concept',
    query: 'What are embeddings?',
    expectedDocs: ['doc-3'],
    explanation: 'Embeddings definition',
  },
  {
    id: 'test-rag-pipeline',
    query: 'Tell me about RAG systems',
    expectedDocs: ['doc-4'],
    explanation: 'RAG is the topic',
  },
  {
    id: 'test-semantic-search',
    query: 'How to search semantically?',
    expectedDocs: ['doc-5', 'doc-2', 'doc-3'],
    explanation: 'Semantic search relies on embeddings and vector search',
  },
  {
    id: 'test-ai-learning',
    query: 'AI that learns from examples',
    expectedDocs: ['doc-1'],
    explanation: 'Semantic match to ML definition (not keyword match)',
  },
  {
    id: 'test-vector-similarity',
    query: 'Finding similar content with vectors',
    expectedDocs: ['doc-2', 'doc-5'],
    explanation: 'Vector similarity is core to both',
  },
];

/**
 * Metric Thresholds for Production
 * Used to determine if evaluation passes
 */
export const METRIC_THRESHOLDS = {
  precision3: 0.7, // Precision@3 > 70%
  recall5: 0.8, // Recall@5 > 80%
  mrr: 0.5, // MRR > 0.5
  ndcg: 0.6, // NDCG > 0.6
};

/**
 * Calculate Precision@K
 * Of K results, how many are relevant?
 *
 * Precision@K = (# of relevant docs in top K) / K
 */
function calculatePrecision(
  retrieved: string[],
  expected: string[],
  k: number = 3,
): number {
  if (k <= 0 || retrieved.length === 0) return 0;

  const topK = retrieved.slice(0, k);
  const relevantCount = topK.filter((docId) => expected.includes(docId)).length;

  return relevantCount / k;
}

/**
 * Calculate Recall@K
 * Of all relevant docs, how many did we find?
 *
 * Recall@K = (# of relevant docs in top K) / (total # of relevant docs)
 */
function calculateRecall(
  retrieved: string[],
  expected: string[],
  k: number = 5,
): number {
  if (expected.length === 0) return 1; // No relevant docs to miss
  if (retrieved.length === 0) return 0; // Nothing retrieved

  const topK = retrieved.slice(0, k);
  const relevantCount = topK.filter((docId) => expected.includes(docId)).length;

  return relevantCount / expected.length;
}

/**
 * Calculate Mean Reciprocal Rank (MRR)
 * How quickly do we find the first relevant result?
 *
 * MRR = 1 / (rank of first relevant doc)
 * If no relevant doc found, MRR = 0
 */
function calculateMRR(retrieved: string[], expected: string[]): number {
  for (let i = 0; i < retrieved.length; i++) {
    if (expected.includes(retrieved[i])) {
      return 1 / (i + 1); // Rank is 1-based
    }
  }
  return 0; // No relevant doc found
}

/**
 * Calculate Normalized Discounted Cumulative Gain (NDCG)
 * Overall ranking quality - top results count more than bottom results
 *
 * DCG = sum(rel_i / log2(i + 1)) for i in 1..k
 * IDCG = DCG if all relevant docs were at top
 * NDCG = DCG / IDCG
 */
function calculateNDCG(
  retrieved: string[],
  expected: string[],
  k: number = 5,
): number {
  if (expected.length === 0) return 1;
  if (retrieved.length === 0) return 0;

  const topK = retrieved.slice(0, k);

  // Calculate DCG (Discounted Cumulative Gain)
  let dcg = 0;
  for (let i = 0; i < topK.length; i++) {
    const rel = expected.includes(topK[i]) ? 1 : 0;
    dcg += rel / Math.log2(i + 2); // i + 2 because log2(1) = 0
  }

  // Calculate IDCG (Ideal DCG - if all relevant docs were at top)
  let idcg = 0;
  for (let i = 0; i < Math.min(expected.length, k); i++) {
    idcg += 1 / Math.log2(i + 2);
  }

  // Return normalized DCG
  return idcg > 0 ? dcg / idcg : 0;
}

/**
 * Evaluate a single test case
 * Runs the query and calculates all metrics
 */
export async function evaluateQuery(
  testCase: TestCase,
  topK: number = 5,
): Promise<EvalResult> {
  try {
    // Run the retrieval query
    const results: RetrievalResult[] = await querySimilar(testCase.query, topK);
    const retrieved = results.map((r) => r.id);

    // Calculate metrics
    const precision = calculatePrecision(retrieved, testCase.expectedDocs);
    const recall = calculateRecall(retrieved, testCase.expectedDocs);
    const mrr = calculateMRR(retrieved, testCase.expectedDocs);
    const ndcg = calculateNDCG(retrieved, testCase.expectedDocs);

    // Determine if query passes thresholds
    const success =
      precision >= METRIC_THRESHOLDS.precision3 &&
      recall >= METRIC_THRESHOLDS.recall5 &&
      mrr >= METRIC_THRESHOLDS.mrr &&
      ndcg >= METRIC_THRESHOLDS.ndcg;

    return {
      queryId: testCase.id,
      query: testCase.query,
      retrieved,
      expected: testCase.expectedDocs,
      precision,
      recall,
      mrr,
      ndcg,
      success,
      explanation: testCase.explanation,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to evaluate query: ${testCase.id}`, {
      error: errorMsg,
      query: testCase.query,
    });

    // Return failed result
    return {
      queryId: testCase.id,
      query: testCase.query,
      retrieved: [],
      expected: testCase.expectedDocs,
      precision: 0,
      recall: 0,
      mrr: 0,
      ndcg: 0,
      success: false,
      explanation: `Error: ${errorMsg}`,
    };
  }
}

/**
 * Run full evaluation suite
 * Evaluates all test cases and returns summary
 */
export async function runFullEvaluation(): Promise<EvalSummary> {
  logger.info('Starting full retrieval evaluation', {
    totalQueries: testCases.length,
  });

  const results: EvalResult[] = [];

  for (const testCase of testCases) {
    const result = await evaluateQuery(testCase);
    results.push(result);

    logger.info(`Completed query evaluation: ${testCase.id}`, {
      precision: result.precision.toFixed(2),
      recall: result.recall.toFixed(2),
      mrr: result.mrr.toFixed(2),
      ndcg: result.ndcg.toFixed(2),
      success: result.success,
    });
  }

  // Calculate summary metrics
  const successCount = results.filter((r) => r.success).length;
  const passRate = successCount / results.length;

  const avgPrecision =
    results.reduce((sum, r) => sum + r.precision, 0) / results.length;
  const avgRecall =
    results.reduce((sum, r) => sum + r.recall, 0) / results.length;
  const avgMRR = results.reduce((sum, r) => sum + r.mrr, 0) / results.length;
  const avgNDCG = results.reduce((sum, r) => sum + r.ndcg, 0) / results.length;

  const summary: EvalSummary = {
    totalQueries: results.length,
    successCount,
    passRate,
    avgPrecision,
    avgRecall,
    avgMRR,
    avgNDCG,
    results,
  };

  logger.info('Evaluation complete', {
    totalQueries: summary.totalQueries,
    successCount: summary.successCount,
    passRate: (summary.passRate * 100).toFixed(1) + '%',
    avgPrecision: summary.avgPrecision.toFixed(2),
    avgRecall: summary.avgRecall.toFixed(2),
    avgMRR: summary.avgMRR.toFixed(2),
    avgNDCG: summary.avgNDCG.toFixed(2),
  });

  return summary;
}

/**
 * Format evaluation results for display
 */
export function formatEvalResults(summary: EvalSummary): string {
  let output = '\n=== RETRIEVAL EVALUATION RESULTS ===\n\n';

  output += 'SUMMARY METRICS\n';
  output += '================\n';
  output += `Total Queries: ${summary.totalQueries}\n`;
  output += `Passed: ${summary.successCount}/${summary.totalQueries} (${(summary.passRate * 100).toFixed(1)}%)\n\n`;

  output += 'Average Metrics:\n';
  output += `  Precision@3: ${summary.avgPrecision.toFixed(3)} (threshold: ${METRIC_THRESHOLDS.precision3})\n`;
  output += `  Recall@5:    ${summary.avgRecall.toFixed(3)} (threshold: ${METRIC_THRESHOLDS.recall5})\n`;
  output += `  MRR:         ${summary.avgMRR.toFixed(3)} (threshold: ${METRIC_THRESHOLDS.mrr})\n`;
  output += `  NDCG:        ${summary.avgNDCG.toFixed(3)} (threshold: ${METRIC_THRESHOLDS.ndcg})\n\n`;

  output += 'PER-QUERY RESULTS\n';
  output += '=================\n';

  for (const result of summary.results) {
    output += `\n[${result.success ? '✓' : '✗'}] ${result.queryId}: "${result.query}"\n`;
    output += `    Retrieved: [${result.retrieved.join(', ')}]\n`;
    output += `    Expected:  [${result.expected.join(', ')}]\n`;
    output += `    Precision@3: ${result.precision.toFixed(3)}\n`;
    output += `    Recall@5:    ${result.recall.toFixed(3)}\n`;
    output += `    MRR:         ${result.mrr.toFixed(3)}\n`;
    output += `    NDCG:        ${result.ndcg.toFixed(3)}\n`;
    if (result.explanation) {
      output += `    Note: ${result.explanation}\n`;
    }
  }

  output += `\n${'='.repeat(35)}\n`;

  return output;
}

/**
 * Jest test suite for retrieval evaluation
 */
describe('Retrieval Evaluation', () => {
  describe('Metric Calculations', () => {
    it('should calculate precision correctly', () => {
      const retrieved = ['doc-1', 'doc-2', 'doc-3'];
      const expected = ['doc-1', 'doc-2'];
      const precision = calculatePrecision(retrieved, expected, 3);
      expect(precision).toBe(2 / 3); // 2 relevant out of 3
    });

    it('should calculate recall correctly', () => {
      const retrieved = ['doc-1', 'doc-2', 'doc-3', 'doc-4', 'doc-5'];
      const expected = ['doc-1', 'doc-3'];
      const recall = calculateRecall(retrieved, expected, 5);
      expect(recall).toBe(1); // Found all 2 relevant docs
    });

    it('should calculate MRR correctly', () => {
      const retrieved = ['doc-5', 'doc-2', 'doc-1'];
      const expected = ['doc-1'];
      const mrr = calculateMRR(retrieved, expected);
      expect(mrr).toBeCloseTo(1 / 3); // First relevant at position 3
    });

    it('should calculate NDCG correctly', () => {
      const retrieved = ['doc-1', 'doc-2', 'doc-3', 'doc-4', 'doc-5'];
      const expected = ['doc-1', 'doc-2'];
      const ndcg = calculateNDCG(retrieved, expected, 5);
      expect(ndcg).toBeGreaterThan(0);
      expect(ndcg).toBeLessThanOrEqual(1);
    });

    it('should handle empty retrieval results', () => {
      const retrieved: string[] = [];
      const expected = ['doc-1'];
      expect(calculatePrecision(retrieved, expected)).toBe(0);
      expect(calculateRecall(retrieved, expected)).toBe(0);
      expect(calculateMRR(retrieved, expected)).toBe(0);
      expect(calculateNDCG(retrieved, expected)).toBe(0);
    });

    it('should handle empty expected results', () => {
      const retrieved = ['doc-1', 'doc-2'];
      const expected: string[] = [];
      expect(calculatePrecision(retrieved, expected)).toBe(0);
      expect(calculateRecall(retrieved, expected)).toBe(1); // No docs to miss
    });
  });

  describe('Full Evaluation', () => {
    it('should have defined test cases', () => {
      expect(testCases.length).toBeGreaterThanOrEqual(5);
      expect(testCases.length).toBeLessThanOrEqual(10);

      // Each test case should have required fields
      testCases.forEach((tc) => {
        expect(tc.id).toBeDefined();
        expect(tc.query).toBeDefined();
        expect(tc.expectedDocs).toBeDefined();
        expect(Array.isArray(tc.expectedDocs)).toBe(true);
      });
    });

    it('should have valid metric thresholds', () => {
      expect(METRIC_THRESHOLDS.precision3).toBeGreaterThan(0);
      expect(METRIC_THRESHOLDS.precision3).toBeLessThanOrEqual(1);
      expect(METRIC_THRESHOLDS.recall5).toBeGreaterThan(0);
      expect(METRIC_THRESHOLDS.recall5).toBeLessThanOrEqual(1);
      expect(METRIC_THRESHOLDS.mrr).toBeGreaterThan(0);
      expect(METRIC_THRESHOLDS.mrr).toBeLessThanOrEqual(1);
      expect(METRIC_THRESHOLDS.ndcg).toBeGreaterThan(0);
      expect(METRIC_THRESHOLDS.ndcg).toBeLessThanOrEqual(1);
    });

    it('should format evaluation results', () => {
      const mockSummary: EvalSummary = {
        totalQueries: 3,
        successCount: 2,
        passRate: 2 / 3,
        avgPrecision: 0.7,
        avgRecall: 0.8,
        avgMRR: 0.6,
        avgNDCG: 0.7,
        results: [
          {
            queryId: 'test-1',
            query: 'test query',
            retrieved: ['doc-1', 'doc-2'],
            expected: ['doc-1'],
            precision: 0.5,
            recall: 1,
            mrr: 1,
            ndcg: 0.8,
            success: true,
          },
          {
            queryId: 'test-2',
            query: 'another query',
            retrieved: ['doc-3', 'doc-4'],
            expected: ['doc-2', 'doc-3'],
            precision: 0.5,
            recall: 0.5,
            mrr: 0.5,
            ndcg: 0.6,
            success: true,
          },
          {
            queryId: 'test-3',
            query: 'third query',
            retrieved: [],
            expected: ['doc-5'],
            precision: 0,
            recall: 0,
            mrr: 0,
            ndcg: 0,
            success: false,
          },
        ],
      };

      const formatted = formatEvalResults(mockSummary);
      expect(formatted).toContain('RETRIEVAL EVALUATION RESULTS');
      expect(formatted).toContain('Passed: 2/3');
      expect(formatted).toContain('Precision@3');
      expect(formatted).toContain('Recall@5');
      expect(formatted).toContain('MRR');
      expect(formatted).toContain('NDCG');
    });
  });
});
