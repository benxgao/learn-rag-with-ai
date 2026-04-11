import { querySimilar, RetrievalResult } from './retrieval';
import { getOpenAIClient } from '../../adapters/openai';
import logger from '../firebase/logger';

/**
 * RAG Result: Answer grounded in retrieved documents
 */
export interface RAGResult {
  question: string;
  answer: string;
  sources: Array<{ id: string; text: string; score: number }>;
  tokensUsed: number;
  duration: number; // milliseconds
}

/**
 * Assemble context from retrieved documents
 * Format: numbered list with document text
 */
function assembleContext(sources: RetrievalResult[]): string {
  return sources.map((doc, i) => `${i + 1}. ${doc.text}`).join('\n\n');
}

/**
 * Build system prompt that constrains LLM to use only provided documents
 * Reduces hallucination by explicitly directing model to ground answers
 */
function buildAugmentation(context: string): string {
  return `You are a helpful AI assistant answering questions based on provided documents.

RELEVANT DOCUMENTS:
${context}

RULES:
1. Answer ONLY using the provided documents
2. If the answer is not in the documents, clearly state: "I don't have enough information to answer this."
3. Be concise and direct (1-2 paragraphs maximum)
4. Cite which document(s) the answer comes from when possible
5. Do not add information from your training data

Respond in clear, natural language.`;
}

/**
 * Complete RAG pipeline: Retrieve → Assemble → Prompt → Generate
 *
 * Stage 1: Embed question and retrieve top-K similar documents (~100ms)
 * Stage 2: Assemble documents into readable context (~1ms)
 * Stage 3: Build system prompt with context and constraints (~1ms)
 * Stage 4: Call LLM to generate grounded answer (~1-2 seconds)
 * Stage 5: Return answer with sources and metrics
 *
 * @param question - Natural language question to answer
 * @returns RAGResult with answer, sources, and metrics
 */
export async function ask(question: string): Promise<RAGResult> {
  const startTime = Date.now();

  // Input validation
  if (!question || typeof question !== 'string') {
    throw new Error('Question must be a non-empty string');
  }

  const trimmedQuestion = question.trim();
  if (trimmedQuestion.length === 0) {
    throw new Error('Question cannot be empty');
  }

  if (trimmedQuestion.length > 1000) {
    throw new Error('Question too long (max 1000 characters)');
  }

  try {
    logger.info('🔍 RAG Pipeline Started', {
      question: trimmedQuestion.substring(0, 60),
    });

    // STAGE 1 & 2: Retrieve relevant documents
    logger.info('📚 Stage 1-2: Retrieving documents...');
    const retrievalChunks = await querySimilar(trimmedQuestion, 3);

    // Handle case where no documents retrieved
    if (retrievalChunks.length === 0) {
      const emptyDuration = Date.now() - startTime;
      logger.warn('⚠️ No documents retrieved', {
        question: trimmedQuestion.substring(0, 60),
        duration: emptyDuration,
      });
      return {
        question: trimmedQuestion,
        answer:
          'No relevant documents found in the knowledge base. Cannot answer this question.',
        sources: [],
        tokensUsed: 0,
        duration: emptyDuration,
      };
    }

    logger.info(`✓ Found ${retrievalChunks.length} documents`, {
      scores: retrievalChunks.map((s) => s.score.toFixed(3)),
    });

    // STAGE 3: Assemble context from retrieved documents
    logger.info('🧩 Stage 3: Assembling context...');
    const context = assembleContext(retrievalChunks);
    logger.info(`✓ Context assembled: ${context.length} chars`);

    // STAGE 4: Construct prompt with system instructions
    logger.info('✍️ Stage 4: Constructing prompt...');
    const augmentatedPrompt = buildAugmentation(context);
    logger.info(`✓ Prompt constructed: ${augmentatedPrompt.length} chars`);

    // STAGE 5: Generate answer using LLM
    logger.info('🤖 Stage 5: Generating answer with LLM...');
    const client = getOpenAIClient();

    const generation = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: augmentatedPrompt,
        },
        {
          role: 'user',
          content: trimmedQuestion,
        },
      ],
      temperature: 0.7, // Balanced between deterministic and creative
      max_tokens: 500, // Limit answer length to fit in context window
      top_p: 0.95, // Nucleus sampling for quality
    });

    const answer = generation.choices[0].message.content || '';
    const tokensUsed = generation.usage?.total_tokens || 0;

    const duration = Date.now() - startTime;
    logger.info('✅ RAG Pipeline Complete', {
      duration,
      tokensUsed,
      answerLength: answer.length,
    });

    return {
      question: trimmedQuestion,
      answer,
      sources: retrievalChunks.map((s) => ({
        id: s.id,
        text: s.text.substring(0, 150), // Truncate for readability
        score: s.score,
      })),
      tokensUsed,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`❌ RAG Pipeline Error: ${errorMsg}`, {
      question: trimmedQuestion.substring(0, 60),
      duration,
    });

    throw error;
  }
}
