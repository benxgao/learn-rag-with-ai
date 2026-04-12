/**
 * Run Full Retrieval Evaluation
 *
 * This script executes the evaluation suite against your live Pinecone index
 * and outputs detailed results including all metrics and diagnostics.
 *
 * Usage:
 *   npm run eval
 *   or
 *   ts-node --project tsconfig.dev.json scripts/run-evaluation.ts
 *
 * Requirements:
 *   - Pinecone index populated with seeded documents (Task 03)
 *   - Environment variables configured (.env file)
 *   - Firebase credentials available
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import evaluation module
import {
  runFullEvaluation,
  formatEvalResults,
  EvalSummary,
  testCases,
  METRIC_THRESHOLDS,
} from '../src/__tests__/retrieval.test';

/**
 * Generate detailed failure analysis
 */
function generateFailureAnalysis(summary: EvalSummary): string {
  const failures = summary.results.filter((r) => !r.success);
  if (failures.length === 0) {
    return '\n✓ All queries passed evaluation!\n';
  }

  let analysis = `\nFAILURE ANALYSIS (${failures.length} queries failed)\n`;
  analysis += `${'='.repeat(50)}\n\n`;

  for (const result of failures) {
    analysis += `❌ ${result.queryId}: "${result.query}"\n`;
    analysis += '   Status: Failed\n';

    // Check which thresholds failed
    const failedThresholds: string[] = [];

    if (result.precision < METRIC_THRESHOLDS.precision3) {
      failedThresholds.push(
        `Precision@3 ${result.precision.toFixed(3)} < ${METRIC_THRESHOLDS.precision3}`,
      );
    }
    if (result.recall < METRIC_THRESHOLDS.recall5) {
      failedThresholds.push(
        `Recall@5 ${result.recall.toFixed(3)} < ${METRIC_THRESHOLDS.recall5}`,
      );
    }
    if (result.mrr < METRIC_THRESHOLDS.mrr) {
      failedThresholds.push(
        `MRR ${result.mrr.toFixed(3)} < ${METRIC_THRESHOLDS.mrr}`,
      );
    }
    if (result.ndcg < METRIC_THRESHOLDS.ndcg) {
      failedThresholds.push(
        `NDCG ${result.ndcg.toFixed(3)} < ${METRIC_THRESHOLDS.ndcg}`,
      );
    }

    analysis += '\n   Failed Thresholds:\n';
    for (const threshold of failedThresholds) {
      analysis += `     • ${threshold}\n`;
    }

    // Diagnostic recommendations
    analysis += '\n   Diagnostics:\n';

    if (result.precision < METRIC_THRESHOLDS.precision3) {
      analysis +=
        `     • Low Precision: Got ${result.retrieved.length} results, ` +
        `${result.retrieved.filter((r) => result.expected.includes(r)).length} relevant\n`;
      analysis += '       → Try: Query expansion, semantic filtering, or reranking\n';
    }

    if (result.recall < METRIC_THRESHOLDS.recall5) {
      analysis +=
        `     • Low Recall: Missing ${result.expected.length - result.retrieved.filter((r) => result.expected.includes(r)).length} ` +
        `of ${result.expected.length} expected docs\n`;
      analysis += '       → Try: Reduce chunk size, increase overlap, or improve embeddings\n';
    }

    if (result.mrr < METRIC_THRESHOLDS.mrr) {
      const firstRelevantIdx = result.retrieved.findIndex((r) =>
        result.expected.includes(r),
      );
      analysis += `     • Low MRR: First relevant result at position ${firstRelevantIdx + 1}\n`;
      analysis += '       → Try: Add reranking layer or adjust similarity scoring\n';
    }

    if (result.ndcg < METRIC_THRESHOLDS.ndcg) {
      analysis += '     • Low NDCG: Ranking quality suboptimal\n';
      analysis += '       → Try: Normalize scores, use cross-encoder, or fine-tune embeddings\n';
    }

    analysis += '\n';
  }

  return analysis;
}

/**
 * Generate improvement recommendations
 */
function generateRecommendations(summary: EvalSummary): string {
  let recs = '\n\nRECOMMENDATIONS FOR IMPROVEMENT\n';
  recs += `${'='.repeat(50)}\n\n`;

  // Overall pattern analysis
  const avgPrecisionGap = METRIC_THRESHOLDS.precision3 - summary.avgPrecision;
  const avgRecallGap = METRIC_THRESHOLDS.recall5 - summary.avgRecall;
  const avgMRRGap = METRIC_THRESHOLDS.mrr - summary.avgMRR;
  const avgNDCGGap = METRIC_THRESHOLDS.ndcg - summary.avgNDCG;

  const gaps = [
    { metric: 'Precision@3', gap: avgPrecisionGap },
    { metric: 'Recall@5', gap: avgRecallGap },
    { metric: 'MRR', gap: avgMRRGap },
    { metric: 'NDCG', gap: avgNDCGGap },
  ].filter((m) => m.gap > 0.05); // Show metrics that are >5% below threshold

  if (gaps.length === 0) {
    recs +=
      '✓ All metrics are above thresholds. Minor tweaks may still help.\n\n';
  } else {
    recs += 'Priority improvements (by gap size):\n\n';
    gaps.sort((a, b) => b.gap - a.gap);

    for (const gap of gaps) {
      recs += `• ${gap.metric.padEnd(12)} gap: ${(gap.gap * 100).toFixed(1)}%\n`;
    }

    recs += '\n';
  }

  // Specific recommendations
  if (summary.avgPrecision < METRIC_THRESHOLDS.precision3 - 0.1) {
    recs +=
      '1. IMPROVE PRECISION (reduce false positives)\n' +
      '   Actions:\n' +
      '   - Implement query expansion with semantic filtering\n' +
      '   - Add domain-specific post-filtering\n' +
      '   - Use a reranker model (e.g., cross-encoder)\n' +
      '   - Analyze low-scoring keywords for chunking improvements\n\n';
  }

  if (summary.avgRecall < METRIC_THRESHOLDS.recall5 - 0.1) {
    recs +=
      '2. IMPROVE RECALL (reduce false negatives)\n' +
      '   Actions:\n' +
      '   - Review chunk size (try smaller chunks with overlap)\n' +
      '   - Increase topK in retrieval calls temporarily to test\n' +
      '   - Evaluate embedding model quality\n' +
      '   - Add dense passage retrieval layer\n\n';
  }

  if (summary.avgMRR < METRIC_THRESHOLDS.mrr - 0.1) {
    recs +=
      '3. IMPROVE MRR (correct answer should rank first)\n' +
      '   Actions:\n' +
      '   - Implement retrieval reranking\n' +
      '   - Tune cosine similarity threshold\n' +
      '   - Add BM25 hybrid search alongside semantic search\n' +
      '   - Experiment with different embedding models\n\n';
  }

  if (summary.avgNDCG < METRIC_THRESHOLDS.ndcg - 0.1) {
    recs +=
      '4. IMPROVE NDCG (overall ranking quality)\n' +
      '   Actions:\n' +
      '   - Use graded relevance scores (0-3) instead of binary\n' +
      '   - Implement a learning-to-rank approach\n' +
      '   - Normalize similarity scores\n' +
      '   - Test with different K values\n\n';
  }

  return recs;
}

/**
 * Main evaluation runner
 */
async function main(): Promise<void> {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   PINECONE RAG RETRIEVAL EVALUATION    ║');
  console.log('║           Task 07 Implementation        ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    console.log(`Testing ${testCases.length} query scenarios...\n`);

    // Run evaluation
    const startTime = Date.now();
    const summary = await runFullEvaluation();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Format and display results
    console.log(formatEvalResults(summary));

    // Show pass rate with emoji
    const passEmoji =
      summary.passRate >= 1.0 ? '✅' : summary.passRate >= 0.8 ? '🟡' : '❌';
    console.log(
      `\n${passEmoji} Overall Pass Rate: ` +
        `${summary.successCount}/${summary.totalQueries} ` +
        `(${(summary.passRate * 100).toFixed(1)}%)\n`,
    );

    // Metric comparison vs thresholds
    console.log('METRIC COMPARISON vs THRESHOLDS');
    console.log('================================');
    console.log(
      `Precision@3: ${summary.avgPrecision.toFixed(3)} ${summary.avgPrecision >= METRIC_THRESHOLDS.precision3 ? '✓' : '✗'} (threshold: ${METRIC_THRESHOLDS.precision3})`,
    );
    console.log(
      `Recall@5:    ${summary.avgRecall.toFixed(3)} ${summary.avgRecall >= METRIC_THRESHOLDS.recall5 ? '✓' : '✗'} (threshold: ${METRIC_THRESHOLDS.recall5})`,
    );
    console.log(
      `MRR:         ${summary.avgMRR.toFixed(3)} ${summary.avgMRR >= METRIC_THRESHOLDS.mrr ? '✓' : '✗'} (threshold: ${METRIC_THRESHOLDS.mrr})`,
    );
    console.log(
      `NDCG:        ${summary.avgNDCG.toFixed(3)} ${summary.avgNDCG >= METRIC_THRESHOLDS.ndcg ? '✓' : '✗'} (threshold: ${METRIC_THRESHOLDS.ndcg})`,
    );
    console.log(`\nExecution time: ${duration}s\n`);

    // Show failures
    const failures = summary.results.filter((r) => !r.success);
    if (failures.length > 0) {
      console.log(generateFailureAnalysis(summary));
    }

    // Show recommendations
    console.log(generateRecommendations(summary));

    // Exit code based on pass rate
    if (summary.passRate === 1.0) {
      console.log('Perfect score! 🎉 All queries passed evaluation.');
      process.exit(0);
    } else if (summary.passRate >= 0.8) {
      console.log(
        'Good performance. Follow recommendations above to improve further.',
      );
      process.exit(0);
    } else {
      console.log(
        'Performance below target. See recommendations above for improvements.',
      );
      process.exit(1);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Evaluation failed: ${errorMsg}\n`);
    console.error('Common issues:');
    console.error('  1. Pinecone index not initialized (run Task 03)');
    console.error('  2. Environment variables not configured (.env file)');
    console.error('  3. Firebase credentials missing');
    console.error('  4. OpenAI API key not set\n');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { runFullEvaluation, formatEvalResults };
