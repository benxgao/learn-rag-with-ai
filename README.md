# Pinecone AI Starter: Learn RAG by Building

**Build a Production-Ready RAG System in 8 Phases** 🚀

This isn't just another boilerplate — it's a **hands-on learning experience** where you'll build a complete Retrieval-Augmented Generation (RAG) system from scratch. Perfect for developers who want to **master AI engineering** by actually building something real.

---

## What You'll Build

**Phase 1-8 Progression:** Each phase adds a core RAG component
```
📄 Text → 🔢 Vectors → 🗄️ Storage → 🔍 Search → 🤖 AI Answers
```

**By the end, you'll have:**
- ✅ Text embedding service (OpenAI)
- ✅ Vector database (Pinecone) 
- ✅ Semantic search API
- ✅ Complete RAG pipeline
- ✅ Evaluation metrics
- ✅ Production deployment

---

## Why This Approach Works

### 🎯 **Learning by Doing**
- **8 bite-sized phases** — No overwhelming complexity
- **Working code at each step** — See immediate results
- **Real integrations** — Not toy examples
- **Production patterns** — Learn industry best practices

### 📈 **Skills You'll Master**
- Vector embeddings & similarity search
- Pinecone vector database operations
- OpenAI API integration
- Firebase Cloud Functions
- TypeScript API development
- RAG pipeline architecture
- Retrieval evaluation metrics

---

## Learning Paths

We offer **two tracks** to match your experience level:

### **Basic Track** — Perfect for Getting Started
New to RAG? Start here for fundamentals and quick wins.
- 8 core tasks (00-08)
- Minimal setup complexity
- Build working features incrementally
- **Estimated time**: 5-6 hours

### **Advanced Track** — Ready for Production
Want enterprise patterns and optimization? Go advanced.
- 8 comprehensive tasks (00-08)
- Production-grade implementation
- Performance optimization
- Real-world patterns and gotchas
- **Estimated time**: 10-12 hours

**Choose Your Path:** Both start in `/docs/ai_tasks/` — pick `basic/` or `advanced/` based on your experience!

---

## Your Learning Journey

| Phase | Basic Task | Advanced Task | Key Skill | Time |
|-------|-----------|---------------|-----------|------|
| **1** | Setup (5min) | Advanced Setup | Env & Tools | 30min |
| **2** | OpenAI Embed | Embed Optimization | Vector Generation | 30min |
| **3** | Pinecone Index | Index Configuration | Vector DB | 20min |
| **4** | Upsert Data | Batch Operations | Data Loading | 25min |
| **5** | Similarity Search | Advanced Search | Semantic Match | 30min |
| **6** | RAG Pipeline | Production RAG | Integration | 45min |
| **7** | Chunking | Smart Chunking | Optimization | 35min |
| **8** | Evaluation | Comprehensive Eval | Measurement | 40min |

---

## Quick Start (5 Minutes)

```bash
# 1. Clone & setup
git clone <your-repo>
cd pinecone-ai-starter
cd functions && npm install

# 2. Add your API keys (free tiers work!)
cp .env.sample .env
# Edit .env: Add OpenAI + Pinecone keys

# 3. Start building!
npm run dev  # Local development server
```

**First milestone:** `POST /embed` working in under 10 minutes!

---

## The 8-Phase API

```javascript
// Phase 1: Get embeddings
POST /embed
{"text": "What is RAG?"}
// → {"embedding": [0.1, -0.2, ...], "dimensions": 1536}

// Phase 4: Semantic search  
POST /search
{"query": "RAG explanation", "topK": 3}
// → {"results": [{"text": "...", "score": 0.89}]}

// Phase 5: Complete RAG
POST /rag/query
{"query": "Explain RAG simply"}
// → {"answer": "RAG is...", "context": [...]}
```

---

## Perfect for Learning Because...

✅ **No AI/ML background required** — We explain everything  
✅ **Real tools, real APIs** — Not simplified toy examples  
✅ **Incremental complexity** — Each phase builds on the last  
✅ **Production ready** — Learn patterns that scale  
✅ **TypeScript + Firebase** — Modern, in-demand skills  

---

## What Developers Say

> *"Finally understood RAG by actually building it. The 8-phase approach made it digestible."*  
> *"Went from zero to production RAG in one weekend. Incredible learning resource."*

---

## Next Steps

1. **Start Phase 1** → Get your first embedding working
2. **Join the journey** → Build all 8 phases  
3. **Deploy to production** → Real users, real impact
4. **Add your features** → Make it your own

---

**Ready to master RAG?**  
Start with Phase 1 and build your first embedding API in the next 30 minutes!

---

*Built with ❤️ for developers who learn by building*
