#!/bin/bash
# Task 06: Chunking Strategy Test Script

echo "=========================================="
echo "Task 06: Chunking Strategy Test"
echo "=========================================="
echo ""

# Sample document for testing
SAMPLE_TEXT="Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience. Deep learning, a subfield of machine learning, uses neural networks with multiple layers. Transformers represent a breakthrough in neural network architecture, powering modern natural language processing models. These models can process and understand vast amounts of text data efficiently. The evolution from RNNs to Transformers has revolutionized how we approach sequence-to-sequence tasks in AI."

echo "📄 Test Document Length: $(echo "$SAMPLE_TEXT" | wc -c) characters"
echo ""

# Test 1: Fixed-size strategy
echo "1️⃣ Testing FIXED-SIZE STRATEGY (512 tokens)..."
curl -s -X POST http://localhost:5001/pinecone-ai-starter/us-central1/api/chunk \
  -H "Content-Type: application/json" \
  -H "auth_token: test" \
  -d "{\"text\": \"$SAMPLE_TEXT\", \"strategy\": \"fixed-size\", \"chunkSize\": 512}" | jq .
echo ""

# Test 2: Sliding-window strategy
echo "2️⃣ Testing SLIDING-WINDOW STRATEGY (512 tokens, 100 overlap)..."
curl -s -X POST http://localhost:5001/pinecone-ai-starter/us-central1/api/chunk \
  -H "Content-Type: application/json" \
  -H "auth_token: test" \
  -d "{\"text\": \"$SAMPLE_TEXT\", \"strategy\": \"sliding-window\", \"chunkSize\": 512, \"overlap\": 100}" | jq .
echo ""

# Test 3: Semantic strategy
echo "3️⃣ Testing SEMANTIC STRATEGY (headers/breaks)..."
curl -s -X POST http://localhost:5001/pinecone-ai-starter/us-central1/api/chunk \
  -H "Content-Type: application/json" \
  -H "auth_token: test" \
  -d "{\"text\": \"$SAMPLE_TEXT\", \"strategy\": \"semantic\"}" | jq .
echo ""

# Test 4: Compare all strategies
echo "4️⃣ COMPARING ALL STRATEGIES..."
curl -s -X POST http://localhost:5001/pinecone-ai-starter/us-central1/api/chunk \
  -H "Content-Type: application/json" \
  -H "auth_token: test" \
  -d "{\"text\": \"$SAMPLE_TEXT\", \"strategy\": \"compare\"}" | jq .
echo ""

echo "=========================================="
echo "✅ All tests completed!"
echo "=========================================="
