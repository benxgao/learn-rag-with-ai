# Postman Chunking-Strategy Test Guide

1. Start emulator: `npm run dev`  
2. In Postman → Import → Paste Raw Text → copy any section below  
3. Send requests; each returns chunked JSON

---

### 1️⃣ Fixed-size (8 tokens)

**Method & URL**  
`POST http://localhost:5001/pinecone-ai-starter/us-central1/api/chunk`

**Headers**  
Content-Type: application/json  
auth_token: test

**Body (raw JSON)**
```json
{
  "text": "Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience. Deep learning, a subfield of machine learning, uses neural networks with multiple layers. Transformers represent a breakthrough in neural network architecture, powering modern natural language processing models. These models can process and understand vast amounts of text data efficiently. The evolution from RNNs to Transformers has revolutionized how we approach sequence-to-sequence tasks in AI.",
  "strategy": "fixed-size",
  "chunkSize": 8
}
```

---

### 2️⃣ Sliding-window (8 tokens / 2 overlap)

**Method & URL**  
same as above

**Headers**  
same as above

**Body**
```json
{
  "text": "Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience. Deep learning, a subfield of machine learning, uses neural networks with multiple layers. Transformers represent a breakthrough in neural network architecture, powering modern natural language processing models. These models can process and understand vast amounts of text data efficiently. The evolution from RNNs to Transformers has revolutionized how we approach sequence-to-sequence tasks in AI.",
  "strategy": "sliding-window",
  "chunkSize": 8,
  "overlap": 2
}
```

---

### 3️⃣ Semantic (break on headers/paragraphs)

**Method & URL**  
same

**Headers**  
same

**Body**
```json
{
  "text": "Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience. Deep learning, a subfield of machine learning, uses neural networks with multiple layers. Transformers represent a breakthrough in neural network architecture, powering modern natural language processing models. These models can process and understand vast amounts of text data efficiently. The evolution from RNNs to Transformers has revolutionized how we approach sequence-to-sequence tasks in AI.",
  "strategy": "semantic"
}
```

---

### 4️⃣ Compare all strategies at once

**Method & URL**  
same

**Headers**  
same

**Body**
```json
{
  "text": "Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience. Deep learning, a subfield of machine learning, uses neural networks with multiple layers. Transformers represent a breakthrough in neural network architecture, powering modern natural language processing models. These models can process and understand vast amounts of text data efficiently. The evolution from RNNs to Transformers has revolutionized how we approach sequence-to-sequence tasks in AI.",
  "isStrategyCompare": true
}
