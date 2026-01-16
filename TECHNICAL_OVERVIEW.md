# DentalGPT - Complete Technical Overview

## 🎯 What is This Project?

**DentalGPT** is a **Retrieval Augmented Generation (RAG)**-based clinical dental assistant application. It allows dentists and dental professionals to:
- Upload dental guidelines, procedures, and clinical documents
- Ask questions about dental treatments, procedures, and diagnoses
- Get AI-powered answers based on their uploaded knowledge base
- Track query history per patient

Think of it as a **specialized ChatGPT for dentistry** that only answers based on your own clinical documents, ensuring accuracy and relevance.

---

## 🏗️ Complete Tech Stack

### **Frontend Layer**
- **React 18.2** - Modern UI framework
- **Vite 5.0** - Fast build tool and dev server
- **Axios** - HTTP client for API calls
- **Lucide React** - Icon library
- **CSS3** - Custom styling (UpToDate-inspired design)

### **Backend Layer**
- **FastAPI 0.104** - Modern Python web framework (async, fast, auto-docs)
- **Uvicorn** - ASGI server for FastAPI
- **Python 3.10+** - Programming language

### **AI/ML Layer**
- **Google Gemini 2.5 Flash** - Large Language Model (LLM) for text generation
- **Google Gemini text-embedding-004** - Embedding model (converts text to vectors)
- **Pinecone** - Vector database for semantic search

### **Data Storage Layer**
- **PostgreSQL** - Relational database for:
  - Query history
  - Patient records
  - Metadata tracking
- **Pinecone Vector DB** - Stores document embeddings for semantic search

### **Document Processing**
- **PyPDF2** - PDF parsing
- **python-docx** - Word document parsing
- **Custom chunking logic** - Text splitting with overlap

---

## 🤖 AI Concepts Explained

### 1. **RAG (Retrieval Augmented Generation)**

**What is RAG?**
RAG is a technique that combines:
- **Retrieval**: Finding relevant information from a knowledge base
- **Augmentation**: Adding that information to the LLM's context
- **Generation**: Using the LLM to generate answers based on retrieved context

**Why RAG?**
- LLMs have training data cutoffs (they don't know recent information)
- LLMs can hallucinate (make up information)
- RAG ensures answers come from YOUR documents (accurate, verifiable)

**How it works in DentalGPT:**
```
User Question → Embed Query → Search Vector DB → Retrieve Relevant Chunks → 
Add to LLM Context → Generate Answer → Return with Sources
```

### 2. **LLM (Large Language Model)**

**What is an LLM?**
A neural network trained on massive text data that can:
- Understand natural language
- Generate human-like text
- Answer questions
- Follow instructions

**In this project:**
- **Model**: Google Gemini 2.5 Flash
- **Purpose**: Generate answers based on retrieved context
- **Input**: User question + retrieved document chunks
- **Output**: Clinically accurate answer

**Example:**
```
Input: "How do I manage dental anxiety?"
Context: [Retrieved chunks about anxiety management]
Output: "Dental anxiety can be managed through behavioral techniques..."
```

### 3. **Embeddings (Vector Representations)**

**What are Embeddings?**
- Numerical representations of text (vectors/arrays of numbers)
- Capture semantic meaning (similar meanings = similar vectors)
- Enable mathematical similarity search

**In this project:**
- **Model**: Google Gemini text-embedding-004
- **Dimension**: 768 numbers per embedding
- **Purpose**: Convert text to searchable vectors

**Example:**
```
Text: "Root canal treatment procedure"
Embedding: [0.23, -0.45, 0.67, ..., 0.12] (768 numbers)
```

### 4. **Vector Database (Pinecone)**

**What is a Vector Database?**
- Specialized database for storing and searching vectors
- Uses cosine similarity to find similar vectors
- Much faster than traditional keyword search

**In this project:**
- **Database**: Pinecone (cloud-hosted)
- **Index**: "dental-gpt" (768 dimensions)
- **Metric**: Cosine similarity
- **Storage**: Document chunks as vectors with metadata

---

## 📊 Data Flow & Architecture

### **Phase 1: Document Ingestion (Training Phase)**

```
1. User uploads document (PDF/TXT/DOCX/MD)
   ↓
2. Document Parsing
   - PDF → PyPDF2 extracts text
   - DOCX → python-docx extracts text
   - TXT/MD → Direct text reading
   ↓
3. Text Chunking
   - Split into 1000-character chunks
   - 200-character overlap (for context continuity)
   - Example: 5000-char doc → 5 chunks
   ↓
4. Embedding Generation
   - Each chunk → Gemini embedding-004
   - Text → 768-dimensional vector
   ↓
5. Vector Storage
   - Store in Pinecone with metadata:
     * Original text chunk
     * Source file name
     * Chunk index
     * Document title
```

**Code Location**: `backend/main.py` → `/api/upload-document` endpoint

### **Phase 2: Query Processing (Inference Phase)**

```
1. User asks question
   "How do I manage dental anxiety?"
   ↓
2. Query Embedding
   - Question → Gemini embedding-004
   - Question → 768-dimensional vector
   ↓
3. Vector Similarity Search
   - Search Pinecone for top 5 similar chunks
   - Uses cosine similarity
   - Returns chunks with relevance scores
   ↓
4. Context Building
   - Combine top 5 chunks
   - Add metadata (sources, scores)
   ↓
5. LLM Generation
   - Prompt: "Answer based on this context: [chunks]"
   - Model: Gemini 2.5 Flash
   - Generates answer using retrieved context
   ↓
6. Response & Logging
   - Return answer + sources
   - Log to PostgreSQL (query, answer, sources)
```

**Code Location**: `backend/main.py` → `/api/query` endpoint

---

## 🔍 Detailed Component Breakdown

### **1. Document Parsing**

**Supported Formats:**
- **PDF**: Uses PyPDF2 to extract text from each page
- **DOCX**: Uses python-docx to extract paragraphs
- **TXT/MD**: Direct file reading

**Chunking Strategy:**
```python
chunk_size = 1000 characters
overlap = 200 characters

Example:
Document: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" (26 chars)
Chunk 1: "ABCDEFGHIJKLMNOPQRST" (chars 0-20)
Chunk 2: "STUVWXYZ" (chars 18-26, overlaps with chunk 1)
```

**Why Overlap?**
- Prevents losing context at chunk boundaries
- Ensures related information isn't split

### **2. Embedding Generation**

**Process:**
```python
text_chunk → Gemini API → embedding vector (768 numbers)
```

**What the embedding captures:**
- Semantic meaning
- Context
- Relationships between words
- Medical/dental terminology

**Example Similarity:**
```
Query: "tooth extraction"
Document chunk: "dental extraction procedure"
→ High similarity (similar meaning)
→ Retrieved in search results
```

### **3. Vector Search (Semantic Search)**

**How it works:**
1. Convert query to embedding
2. Compare with all stored embeddings
3. Calculate cosine similarity (0 to 1)
4. Return top 5 most similar chunks

**Cosine Similarity:**
```
Similarity = (A · B) / (||A|| × ||B||)
- 1.0 = Identical meaning
- 0.0 = Completely different
- 0.7+ = Highly relevant
```

**Advantages over keyword search:**
- Finds semantically similar content
- Works with synonyms
- Understands context
- Language-agnostic

### **4. LLM Prompt Engineering**

**Prompt Structure:**
```
You are a dental assistant AI. Answer the following question 
based on the provided dental guidelines and clinical knowledge.

Dental Guidelines Context:
[Retrieved chunk 1]
[Retrieved chunk 2]
[Retrieved chunk 3]
...

Question: [User's question]

Provide a clear, concise, and clinically accurate answer. 
If the context doesn't contain enough information, say so. 
Always cite which parts of the guidelines you're referencing.
```

**Why this prompt?**
- Sets role (dental assistant)
- Provides context (retrieved chunks)
- Sets expectations (clinical accuracy)
- Requires citations (transparency)

### **5. Response Generation**

**LLM Processing:**
1. Receives prompt with context
2. Processes through neural network
3. Generates token by token
4. Returns complete answer

**Output Format:**
```json
{
  "answer": "Dental anxiety can be managed through...",
  "sources": [
    {
      "text": "Behavioral techniques include...",
      "score": 0.92,
      "metadata": {"title": "Anxiety Management Guide"}
    }
  ],
  "query_id": 123
}
```

---

## 🗄️ Database Architecture

### **PostgreSQL (Relational DB)**

**Tables:**

1. **dental_queries**
   - `id` - Primary key
   - `patient_id` - Optional patient identifier
   - `query_text` - User's question
   - `ai_response` - Generated answer
   - `source_docs` - JSON array of sources
   - `created_at` - Timestamp

2. **patients** (Optional, for future expansion)
   - Patient records
   - Medical history

**Purpose:**
- Query history tracking
- Patient-specific context
- Audit trail
- Analytics

### **Pinecone (Vector DB)**

**Index Structure:**
- **Name**: "dental-gpt"
- **Dimension**: 768 (matches embedding model)
- **Metric**: Cosine similarity
- **Vectors**: Document chunk embeddings

**Metadata Stored:**
- Original text chunk
- Source file name
- Chunk index
- Document title
- Timestamp

**Query Process:**
```python
query_vector → Pinecone.query() → Top 5 matches
→ Returns: vectors + metadata + similarity scores
```

---

## 🔄 Complete End-to-End Flow

### **Scenario: User asks "What is root canal treatment?"**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. FRONTEND (React)                                         │
│    User types question → Clicks submit                       │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP POST /api/query
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. BACKEND (FastAPI)                                        │
│    Receives: {"query": "What is root canal treatment?"}     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. EMBEDDING GENERATION                                     │
│    Query → Gemini embedding-004                            │
│    Output: [0.23, -0.45, 0.67, ..., 0.12] (768 numbers)   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. VECTOR SEARCH (Pinecone)                                │
│    Search for top 5 similar vectors                         │
│    Returns:                                                  │
│    - Chunk: "Root canal treatment is..." (score: 0.95)     │
│    - Chunk: "Indications for RCT..." (score: 0.88)          │
│    - Chunk: "RCT procedure steps..." (score: 0.85)           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. CONTEXT BUILDING                                         │
│    Combine retrieved chunks                                 │
│    Build prompt with context                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. LLM GENERATION (Gemini 2.5 Flash)                       │
│    Prompt → Neural Network → Answer                         │
│    Output: "Root canal treatment is a procedure..."         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. DATABASE LOGGING (PostgreSQL)                           │
│    Save query, answer, sources to dental_queries table      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. RESPONSE (JSON)                                          │
│    {                                                        │
│      "answer": "Root canal treatment is...",                │
│      "sources": [...],                                      │
│      "query_id": 123                                        │
│    }                                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. FRONTEND DISPLAY                                         │
│    Show answer + sources + citations                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Frontend Architecture

### **Component Structure**

```
App.jsx (Main Component)
├── Sidebar
│   ├── Patient ID Input
│   ├── Patient History
│   └── Recent Queries
├── Header
│   └── Upload Document Button
├── Upload Section (Conditional)
│   ├── File Picker
│   ├── Title Input
│   └── Upload Button
├── Query Section
│   ├── Question Input
│   ├── Submit Button
│   └── Example Questions
└── Answer Section
    ├── Generated Answer
    └── Sources/Citations
```

### **State Management**

- **React Hooks** (useState, useEffect)
- **Local state** for UI interactions
- **API calls** via Axios
- **No global state management** (simple app, doesn't need Redux/Zustand)

---

## 🔐 Security & Best Practices

### **API Key Management**
- Stored in `.env` file (not in git)
- Loaded via `python-dotenv`
- Never exposed to frontend

### **CORS Configuration**
- Only allows localhost origins
- Prevents unauthorized access

### **Error Handling**
- Try-catch blocks in all API calls
- User-friendly error messages
- Detailed logging for debugging

### **Data Privacy**
- Patient IDs are optional
- No PHI stored in vector database
- Query history can be patient-specific

---

## 📈 Performance Optimizations

### **Vector Search**
- Top-K retrieval (only top 5 chunks)
- Cosine similarity (fast computation)
- Pinecone cloud (optimized infrastructure)

### **Chunking Strategy**
- 1000 chars per chunk (optimal for embeddings)
- 200 char overlap (context preservation)
- Batch processing for large documents

### **Caching**
- Pinecone caches embeddings
- PostgreSQL indexes on patient_id and created_at

---

## 🚀 Deployment Architecture

### **Current (Local Development)**
```
Frontend: Vite dev server (localhost:5173)
Backend: Uvicorn (localhost:8000)
PostgreSQL: Local instance
Pinecone: Cloud (AWS)
```

### **Production Ready**
```
Frontend: Vercel/Netlify
Backend: AWS Lambda/EC2/Railway
PostgreSQL: AWS RDS
Pinecone: Cloud (already production)
```

---

## 🎓 Key AI/ML Concepts Used

1. **RAG (Retrieval Augmented Generation)**
   - Combines retrieval + generation
   - Ensures answers from your documents

2. **Embeddings**
   - Text → Vector conversion
   - Semantic understanding

3. **Vector Similarity Search**
   - Mathematical similarity
   - Fast retrieval

4. **Prompt Engineering**
   - Structured prompts
   - Context injection
   - Role definition

5. **Chunking Strategy**
   - Text splitting
   - Overlap for context
   - Optimal chunk sizes

---

## 📚 Learning Resources

**RAG:**
- [LangChain RAG Tutorial](https://python.langchain.com/docs/use_cases/question_answering/)
- [RAG Paper](https://arxiv.org/abs/2005.11401)

**Embeddings:**
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [Vector Databases Explained](https://www.pinecone.io/learn/vector-database/)

**LLMs:**
- [Google Gemini Documentation](https://ai.google.dev/docs)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)

---

## 🔧 Customization Options

**Easy to Modify:**
- Chunk size (currently 1000)
- Overlap size (currently 200)
- Top-K retrieval (currently 5)
- LLM model (currently Gemini 2.5 Flash)
- Embedding model (currently text-embedding-004)

**Advanced Customizations:**
- Add more document formats
- Implement recursive text splitting
- Add metadata filtering
- Implement re-ranking
- Add multi-modal support (images)

---

This architecture provides a production-ready RAG system that's scalable, accurate, and maintainable!
