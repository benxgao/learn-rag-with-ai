---
notes: V2 Task - Build reflection loop to validate answers and detect hallucinations
prerequisites: V1 Tasks 01-08 completed, V2 Task 01-03 (query, tools, planner)
---

# V2 Tutorial 04 — Reflection & Self-Correction Loop

## What You'll Learn

In this tutorial, you'll discover:

- **Answer validation** — Checking if generated answers match source documents
- **Hallucination detection** — Identifying unsupported claims
- **Confidence scoring** — Quantifying answer quality
- **Automatic retry strategies** — Fixing low-confidence outputs
- **Failure analysis** — Understanding why validation failed
- **Quality thresholds** — Standards for acceptable answers
- **Iterative refinement** — Multiple passes to improve quality
- **Production patterns** — Monitoring answer quality over time

---

## The Core Problem: Too Much Trust in the System

### What Goes Wrong

```
Pipeline generates answer → User gets it
              ↓
         (No validation)
              ↓
    User might receive hallucination
```

**Real Examples:**

```
Q: "When was Python invented?"
Generated: "Python was invented in 1987"
Sources: [No mention of 1987]
Result: False, but sounds confident
```

```
Q: "What are the benefits of blockchain?"
Generated: "Blockchain is secure, decentralized, and has zero
environmental impact"
Sources: [Only mention first two; nothing about environmental impact]
Result: Partial hallucination mixed with truth
```

---

## The Solution: Reflection & Correction Layer

### Architecture Overview

```
Generated Answer + Source Documents
         ↓
   [1. Grounding Check] → Is answer actually in sources?
         ↓
   [2. Confidence Score] → How confident are we?
         ↓
   [3. Quality Threshold] → Is it good enough?
         ↓
      ┌─ YES → Return answer
      │
      NO
      │
      ↓
   [4. Analyze Failure] → Why did validation fail?
         ↓
   [5. Select Retry] → What strategy to fix it?
         ↓
   [6. Execute Retry] → Run improved search/generation
         ↓
   [7. Loop Back] → Re-validate
```

---

## Implementation Guide

### Layer 1: Answer Grounding Validator

**Purpose:** Check if answer claims are supported by retrieved documents

**Implementation Approach:**

```typescript
// services/reflection/grounding-validator.ts

export interface GroundingCheckResult {
  isGrounded: boolean;
  groundingScore: number; // 0.0-1.0
  supportedClaims: Array<{
    claim: string;
    supportingDocuments: string[]; // Document IDs
    confidence: number;
  }>;
  unsupportedClaims: Array<{
    claim: string;
    reason: string; // "not mentioned", "contradicts", etc.
  }>;
  analysis: string; // Detailed explanation
}

export class GroundingValidator {
  private openaiService: OpenAIService;
  private logger: Logger;

  constructor(openaiService: OpenAIService, logger: Logger) {
    this.openaiService = openaiService;
    this.logger = logger;
  }

  async validateGrounding(
    answer: string,
    sources: Array<{ id: string; content: string }>,
  ): Promise<GroundingCheckResult> {
    // Prepare source documents
    const sourceText = sources
      .map((s, i) => `[SOURCE_${i}] ${s.content.substring(0, 500)}`)
      .join("\n\n");

    const prompt = `You are a fact-checker. Analyze if this answer is grounded in the provided sources.

ANSWER:
"${answer}"

SOURCES:
${sourceText}

For each claim in the answer:
1. Identify the claim
2. Check if it's explicitly supported by sources
3. Rate support level: "fully_supported" / "partially_supported" / "unsupported" / "contradicts"

Format your response as:
CLAIM_1: [claim text]
SUPPORT: [fully_supported|partially_supported|unsupported|contradicts]
SOURCE_IDS: [which sources support it, or NONE]
---
[repeat for each claim]

OVERALL_SCORE: [0.0-1.0, 1.0 = fully grounded]
SUMMARY: [one sentence about grounding quality]`;

    const response = await this.openaiService.createCompletion({
      model: "gpt-4-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      maxTokens: 1500,
    });

    // Parse response
    const content = response.choices[0].message.content!;
    return this.parseGroundingResponse(content, sources);
  }

  private parseGroundingResponse(
    response: string,
    sources: Array<{ id: string; content: string }>,
  ): GroundingCheckResult {
    const lines = response.split("\n");
    const supportedClaims = [];
    const unsupportedClaims = [];
    let overallScore = 0.7;

    let currentClaim: any = null;

    for (const line of lines) {
      if (line.startsWith("CLAIM_")) {
        if (currentClaim) {
          if (
            currentClaim.support === "fully_supported" ||
            currentClaim.support === "partially_supported"
          ) {
            supportedClaims.push({
              claim: currentClaim.text,
              supportingDocuments: currentClaim.sourceIds || [],
              confidence:
                currentClaim.support === "fully_supported" ? 1.0 : 0.6,
            });
          } else {
            unsupportedClaims.push({
              claim: currentClaim.text,
              reason: currentClaim.support || "unknown",
            });
          }
        }
        currentClaim = { text: line.split(":")[1]?.trim() || "" };
      } else if (line.startsWith("SUPPORT:")) {
        currentClaim.support = line.split(":")[1]?.trim();
      } else if (line.startsWith("SOURCE_IDS:")) {
        const ids = line.split(":")[1]?.trim();
        currentClaim.sourceIds = ids === "NONE" ? [] : ids?.split(",") || [];
      } else if (line.startsWith("OVERALL_SCORE:")) {
        overallScore = parseFloat(line.split(":")[1]?.trim() || "0.7");
      }
    }

    const groundingScore = Math.max(
      0,
      overallScore - unsupportedClaims.length * 0.15,
    );

    return {
      isGrounded: groundingScore >= 0.6 && unsupportedClaims.length === 0,
      groundingScore: Math.min(1.0, groundingScore),
      supportedClaims,
      unsupportedClaims,
      analysis: `Found ${supportedClaims.length} supported claims and ${unsupportedClaims.length} unsupported claims`,
    };
  }
}
```

### Layer 2: Retrieval Quality Validator

**Purpose:** Check if retrieved documents are actually relevant to query

**Implementation Approach:**

```typescript
// services/reflection/retrieval-validator.ts

export interface RetrievalQualityResult {
  isQualityAcceptable: boolean;
  qualityScore: number; // 0.0-1.0
  relevantDocuments: Array<{
    id: string;
    relevance: number;
    reason: string;
  }>;
  irrelevantDocuments: Array<{
    id: string;
    reason: string;
  }>;
  averageRelevance: number;
  recommendation: "accept" | "refine_query" | "expand" | "retry";
}

export class RetrievalValidator {
  private openaiService: OpenAIService;

  constructor(openaiService: OpenAIService) {
    this.openaiService = openaiService;
  }

  async validateRetrievalQuality(
    query: string,
    retrievedDocs: Array<{ id: string; content: string; score: number }>,
  ): Promise<RetrievalQualityResult> {
    const prompt = `For this query, rate how relevant each document is:

QUERY: "${query}"

DOCUMENTS:
${retrievedDocs.map((d, i) => `[DOC_${i}] ${d.content.substring(0, 300)}`).join("\n\n")}

For each document, rate:
- Relevance: 0.0-1.0 (1.0 = directly answers query)
- Reason: why is it relevant/irrelevant?

Format:
DOC_0: 0.95 | Directly discusses the topic
DOC_1: 0.30 | Only tangentially related
...

AVERAGE_RELEVANCE: [0.0-1.0]
QUALITY_ASSESSMENT: [acceptable|needs_refinement]
RECOMMENDATION: [accept|refine_query|expand|retry]`;

    const response = await this.openaiService.createCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      maxTokens: 1000,
    });

    return this.parseRetrievalResponse(
      response.choices[0].message.content!,
      retrievedDocs,
    );
  }

  private parseRetrievalResponse(
    response: string,
    docs: Array<{ id: string; content: string; score: number }>,
  ): RetrievalQualityResult {
    const lines = response.split("\n");
    const relevantDocuments = [];
    const irrelevantDocuments = [];
    let averageRelevance = 0.5;
    let recommendation: "accept" | "refine_query" | "expand" | "retry" =
      "accept";

    let relevanceSum = 0;
    let count = 0;

    for (const line of lines) {
      if (line.startsWith("DOC_")) {
        const [idx, score, reason] = line.split("|").map((s) => s.trim());
        const docIndex = parseInt(idx.split("_")[1] || "0");
        const relevance = parseFloat(score);
        const docId = docs[docIndex]?.id || `doc_${docIndex}`;

        if (relevance >= 0.6) {
          relevantDocuments.push({
            id: docId,
            relevance,
            reason: reason || "Relevant",
          });
        } else {
          irrelevantDocuments.push({
            id: docId,
            reason: reason || "Low relevance",
          });
        }

        relevanceSum += relevance;
        count++;
      } else if (line.startsWith("AVERAGE_RELEVANCE:")) {
        averageRelevance = parseFloat(line.split(":")[1]?.trim() || "0.5");
      } else if (line.startsWith("RECOMMENDATION:")) {
        recommendation = (line.split(":")[1]?.trim() as any) || "accept";
      }
    }

    return {
      isQualityAcceptable: averageRelevance >= 0.6,
      qualityScore: Math.min(1.0, count > 0 ? relevanceSum / count : 0.5),
      relevantDocuments,
      irrelevantDocuments,
      averageRelevance,
      recommendation,
    };
  }
}
```

### Layer 3: Confidence Scorer

**Purpose:** Calculate overall confidence based on multiple signals

**Implementation Approach:**

```typescript
// services/reflection/confidence-scorer.ts

export interface ConfidenceSignals {
  groundingScore: number;
  retrievalQuality: number;
  documentCount: number;
  answerLength: number;
  classificationConfidence: number;
}

export interface ConfidenceResult {
  overallConfidence: number; // 0.0-1.0
  signals: ConfidenceSignals;
  recommendation: "accept" | "retry" | "request_clarification";
  reasoning: string;
}

export class ConfidenceScorer {
  calculateConfidence(signals: ConfidenceSignals): ConfidenceResult {
    // Weighted combination of signals
    const weights = {
      grounding: 0.4, // Most important: answer must be grounded
      retrieval: 0.25, // Good retrieval improves confidence
      documentCount: 0.15, // More docs = more confidence
      answerLength: 0.1,
      classification: 0.1,
    };

    // Normalize document count (assume 5 docs is optimal)
    const docNormalized = Math.min(1.0, signals.documentCount / 5);

    // Normalize answer length (assume 200-500 chars is optimal)
    const lengthNormalized = Math.min(
      1.0,
      signals.answerLength > 0 ? Math.min(signals.answerLength / 500, 1.0) : 0,
    );

    const weighted =
      signals.groundingScore * weights.grounding +
      signals.retrievalQuality * weights.retrieval +
      docNormalized * weights.documentCount +
      lengthNormalized * weights.answerLength +
      signals.classificationConfidence * weights.classification;

    // Determine recommendation
    let recommendation: "accept" | "retry" | "request_clarification";
    let reasoning: string;

    if (weighted >= 0.75) {
      recommendation = "accept";
      reasoning = "High confidence: good grounding and retrieval quality";
    } else if (weighted >= 0.5) {
      recommendation = "retry";
      reasoning = `Moderate confidence (${weighted.toFixed(2)}): consider refined retry`;
    } else {
      recommendation = "request_clarification";
      reasoning = `Low confidence (${weighted.toFixed(2)}): ask user for clarification`;
    }

    return {
      overallConfidence: weighted,
      signals,
      recommendation,
      reasoning,
    };
  }
}
```

### Layer 4: Retry Strategy Manager

**Purpose:** Select and execute retry strategies when validation fails

**Implementation Approach:**

```typescript
// services/reflection/retry-manager.ts

export enum RetryStrategy {
  QUERY_EXPANSION = "query_expansion", // Search with synonyms
  QUERY_REFINEMENT = "query_refinement", // Rewrite query
  DECOMPOSITION = "decomposition", // Break into sub-queries
  INCREASED_CONTEXT = "increased_context", // Get more documents
  DIFFERENT_TOOL = "different_tool", // Use different tool
}

export interface RetryConfig {
  maxRetries: number;
  strategies: RetryStrategy[];
  backoffMultiplier: number;
}

export class RetryManager {
  private dispatcher: ToolDispatcher;
  private queryExpander: QueryExpander;
  private logger: Logger;

  constructor(
    dispatcher: ToolDispatcher,
    queryExpander: QueryExpander,
    logger: Logger,
  ) {
    this.dispatcher = dispatcher;
    this.queryExpander = queryExpander;
    this.logger = logger;
  }

  async executeRetry(
    originalQuery: string,
    failureReason: string,
    attemptNumber: number,
    config: Partial<RetryConfig> = {},
  ): Promise<{ success: boolean; result: any; strategy: RetryStrategy }> {
    const fullConfig: RetryConfig = {
      maxRetries: 3,
      strategies: [
        RetryStrategy.QUERY_EXPANSION,
        RetryStrategy.QUERY_REFINEMENT,
        RetryStrategy.INCREASED_CONTEXT,
        RetryStrategy.DECOMPOSITION,
      ],
      backoffMultiplier: 1.5,
      ...config,
    };

    // Choose strategy based on attempt number and failure reason
    const strategy = this.selectStrategy(
      failureReason,
      attemptNumber,
      fullConfig.strategies,
    );

    this.logger.info(
      `Retry attempt ${attemptNumber} using strategy: ${strategy}`,
    );

    switch (strategy) {
      case RetryStrategy.QUERY_EXPANSION:
        return this.retryWithExpansion(originalQuery);

      case RetryStrategy.QUERY_REFINEMENT:
        return this.retryWithRefinement(originalQuery);

      case RetryStrategy.DECOMPOSITION:
        return this.retryWithDecomposition(originalQuery);

      case RetryStrategy.INCREASED_CONTEXT:
        return this.retryWithIncreasedContext(originalQuery);

      case RetryStrategy.DIFFERENT_TOOL:
        return this.retryWithDifferentTool(originalQuery);

      default:
        return { success: false, result: null, strategy };
    }
  }

  private selectStrategy(
    failureReason: string,
    attemptNumber: number,
    available: RetryStrategy[],
  ): RetryStrategy {
    // Attempt 1: Try expansion
    if (
      attemptNumber === 1 &&
      available.includes(RetryStrategy.QUERY_EXPANSION)
    ) {
      return RetryStrategy.QUERY_EXPANSION;
    }

    // Attempt 2: Try refinement
    if (
      attemptNumber === 2 &&
      available.includes(RetryStrategy.QUERY_REFINEMENT)
    ) {
      return RetryStrategy.QUERY_REFINEMENT;
    }

    // Attempt 3: Try decomposition
    if (
      attemptNumber === 3 &&
      available.includes(RetryStrategy.DECOMPOSITION)
    ) {
      return RetryStrategy.DECOMPOSITION;
    }

    // Fallback
    return (
      available[attemptNumber % available.length] ||
      RetryStrategy.QUERY_EXPANSION
    );
  }

  private async retryWithExpansion(query: string) {
    const expanded = await this.queryExpander.expand(query, 2);
    const variant = expanded.variants[0];

    const result = await this.dispatcher.dispatch({
      toolId: "retrieval-v1",
      input: { query: variant.query, topK: 8 },
    });

    return {
      success: result.status === "success",
      result: result.output.data,
      strategy: RetryStrategy.QUERY_EXPANSION,
    };
  }

  private async retryWithRefinement(query: string) {
    const refined = await this.refineQuery(query);

    const result = await this.dispatcher.dispatch({
      toolId: "retrieval-v1",
      input: { query: refined, topK: 6 },
    });

    return {
      success: result.status === "success",
      result: result.output.data,
      strategy: RetryStrategy.QUERY_REFINEMENT,
    };
  }

  private async retryWithDecomposition(query: string) {
    // Decompose into sub-queries and retrieve separately
    const subQueries = await this.decomposeQuery(query);
    const allResults = [];

    for (const subQ of subQueries) {
      const result = await this.dispatcher.dispatch({
        toolId: "retrieval-v1",
        input: { query: subQ, topK: 4 },
      });
      if (result.status === "success") {
        allResults.push(...result.output.data.results);
      }
    }

    return {
      success: allResults.length > 0,
      result: { results: allResults },
      strategy: RetryStrategy.DECOMPOSITION,
    };
  }

  private async retryWithIncreasedContext(query: string) {
    // Retrieve more documents
    const result = await this.dispatcher.dispatch({
      toolId: "retrieval-v1",
      input: { query, topK: 15 },
    });

    return {
      success: result.status === "success",
      result: result.output.data,
      strategy: RetryStrategy.INCREASED_CONTEXT,
    };
  }

  private async retryWithDifferentTool(query: string) {
    // Try web search if available
    const result = await this.dispatcher.dispatch({
      toolId: "web-search-v1",
      input: { query, resultCount: 5 },
    });

    return {
      success: result.status === "success",
      result: result.output.data,
      strategy: RetryStrategy.DIFFERENT_TOOL,
    };
  }

  private async refineQuery(query: string): Promise<string> {
    // Use LLM to refine query for better retrieval
    // (reuse from Task 01)
    return query; // Placeholder
  }

  private async decomposeQuery(query: string): Promise<string[]> {
    // (reuse from Task 01)
    return [query];
  }
}
```

### Layer 5: Reflection Orchestrator

**Purpose:** Coordinate all validation and correction components

**Implementation Approach:**

```typescript
// services/reflection/orchestrator.ts

export interface ReflectionInput {
  query: string;
  answer: string;
  sources: Array<{ id: string; content: string }>;
  classificationConfidence: number;
}

export interface ReflectionResult {
  isAccepted: boolean;
  confidence: number;
  validation: {
    grounding: GroundingCheckResult;
    retrievalQuality: RetrievalQualityResult;
  };
  recommendation: string;
  retryAttempts: number;
  finalAnswer?: string;
  errors: string[];
}

export class ReflectionOrchestrator {
  private groundingValidator: GroundingValidator;
  private retrievalValidator: RetrievalValidator;
  private confidenceScorer: ConfidenceScorer;
  private retryManager: RetryManager;
  private logger: Logger;

  constructor(
    groundingValidator: GroundingValidator,
    retrievalValidator: RetrievalValidator,
    confidenceScorer: ConfidenceScorer,
    retryManager: RetryManager,
    logger: Logger,
  ) {
    this.groundingValidator = groundingValidator;
    this.retrievalValidator = retrievalValidator;
    this.confidenceScorer = confidenceScorer;
    this.retryManager = retryManager;
    this.logger = logger;
  }

  async reflect(input: ReflectionInput): Promise<ReflectionResult> {
    const errors: string[] = [];
    let retryCount = 0;
    let currentAnswer = input.answer;
    let currentSources = input.sources;

    // Attempt up to 3 cycles of validation + retry
    while (retryCount < 3) {
      // Step 1: Validate answer grounding
      const grounding = await this.groundingValidator.validateGrounding(
        currentAnswer,
        currentSources,
      );

      // Step 2: Validate retrieval quality
      const retrieval = await this.retrievalValidator.validateRetrievalQuality(
        input.query,
        currentSources.map((s) => ({
          id: s.id,
          content: s.content,
          score: 0.8,
        })),
      );

      // Step 3: Calculate confidence
      const confidence = this.confidenceScorer.calculateConfidence({
        groundingScore: grounding.groundingScore,
        retrievalQuality: retrieval.qualityScore,
        documentCount: currentSources.length,
        answerLength: currentAnswer.length,
        classificationConfidence: input.classificationConfidence,
      });

      this.logger.info(
        `Reflection cycle ${retryCount}: confidence ${confidence.overallConfidence.toFixed(2)}`,
      );

      // If acceptable, return
      if (recommendation === "accept" || retryCount === 2) {
        return {
          isAccepted: confidence.overallConfidence >= 0.6,
          confidence: confidence.overallConfidence,
          validation: { grounding, retrievalQuality: retrieval },
          recommendation: confidence.recommendation,
          retryAttempts: retryCount,
          finalAnswer: currentAnswer,
          errors,
        };
      }

      // Otherwise, retry
      try {
        const retryResult = await this.retryManager.executeRetry(
          input.query,
          grounding.unsupportedClaims.length > 0
            ? "unsupported_claims"
            : "low_retrieval_quality",
          retryCount + 1,
        );

        if (retryResult.success && retryResult.result.results) {
          currentSources = retryResult.result.results.map((r, i) => ({
            id: r.id || `doc_${i}`,
            content: r.content || r.text,
          }));

          // Note: In real system, would regenerate answer with new sources
          retryCount++;
        } else {
          break;
        }
      } catch (error) {
        errors.push(
          `Retry failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        break;
      }
    }

    // Final result if retries exhausted
    return {
      isAccepted: false,
      confidence: 0.4,
      validation: {
        grounding: {
          isGrounded: false,
          groundingScore: 0,
          supportedClaims: [],
          unsupportedClaims: [],
          analysis: "Validation failed after retries",
        },
        retrievalQuality: {
          isQualityAcceptable: false,
          qualityScore: 0,
          relevantDocuments: [],
          irrelevantDocuments: [],
          averageRelevance: 0,
          recommendation: "retry",
        },
      },
      recommendation: "request_clarification",
      retryAttempts: retryCount,
      errors,
    };
  }
}
```

### Layer 6: New Endpoint — Validation & Reflection

**New Endpoint: `/api/reflection/`**

```typescript
// endpoints/api/reflection.ts

export interface ReflectionRequest {
  query: string;
  answer: string;
  sources: Array<{ id: string; content: string }>;
  classificationConfidence?: number;
}

router.post("/validate", async (req: Request, res: Response) => {
  const { query, answer, sources, classificationConfidence = 0.8 } = req.body;

  try {
    const result = await reflectionOrchestrator.reflect({
      query,
      answer,
      sources,
      classificationConfidence,
    });

    res.json(result);
  } catch (error) {
    logger.error("Reflection failed", error);
    res.status(500).json({ error: "Reflection failed" });
  }
});

// GET /api/reflection/metrics
// Get validation metrics
router.get("/metrics", (req: Request, res: Response) => {
  // Return statistics: avg confidence, retry rates, etc.
  res.json({
    message: "Validation metrics",
  });
});
```

---

## Integration with Main RAG

Update the RAG endpoint to include reflection:

```typescript
// Updated: endpoints/api/rag.ts

router.post('/ask', async (req: Request, res: Response) => {
  const { question } = req.body;

  // ... existing retrieval + generation code ...

  const retrieval Results = [...];
  const answer = generateAnswer(question, retrievalResults);

  // NEW: Add reflection layer
  const reflection = await reflectionOrchestrator.reflect({
    query: question,
    answer,
    sources: retrievalResults.map(r => ({
      id: r.id,
      content: r.content
    })),
    classificationConfidence: 0.9
  });

  // Return with validation metadata
  res.json({
    question,
    answer: reflection.isAccepted ? answer : null,
    confidence: reflection.confidence,
    sources: retrievalResults,
    validation: {
      isGrounded: reflection.validation.grounding.isGrounded,
      groundingScore: reflection.validation.grounding.groundingScore,
      unsupportedClaims: reflection.validation.grounding.unsupportedClaims,
      retryAttempts: reflection.retryAttempts,
      ...reflection.validation
    }
  });
});
```

---

## Testing & Validation

### Unit Tests

```typescript
// Test grounding detection (hallucination vs truth)
// Test confidence scoring combinations
// Test retry strategy selection
// Test validator error handling
```

### Test Cases

```typescript
// Case 1: Fully grounded answer → accept
// Case 2: Partially supported → conditional accept
// Case 3: Ungrounded claims → retry or reject
// Case 4: Low retrieval quality → retry
// Case 5: Multiple failures → fallback
```

---

## Deliverables Checklist

- [ ] GroundingValidator for answer fact-checking
- [ ] RetrievalValidator for document relevance checking
- [ ] ConfidenceScorer combining multiple signals
- [ ] RetryManager with 5+ retry strategies
- [ ] ReflectionOrchestrator coordinating all components
- [ ] `/api/reflection/validate` endpoint
- [ ] `/api/reflection/metrics` endpoint
- [ ] Integration with main RAG endpoint
- [ ] Type definitions in `types/reflection.ts`
- [ ] Comprehensive logging
- [ ] Test suite for all validation scenarios
- [ ] Failure mode analysis
