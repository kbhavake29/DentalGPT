# DentalGPT - Technical Stack Overview

## 🎯 Project Overview
**DentalGPT** is a patient-oriented dental assistant application using RAG (Retrieval Augmented Generation) to provide clinical guidance based on ingested dental guidelines and patient history.

---

## 🖥️ Frontend Stack

### **Core Framework**
- **React 18.2.0** - UI library
- **Vite 5.0.8** - Build tool and dev server
- **JavaScript (ES6+)** - Programming language

### **Key Libraries**
- **axios 1.6.2** - HTTP client for API calls
- **react-markdown 10.1.0** - Markdown rendering for AI responses
- **remark-gfm 4.0.1** - GitHub Flavored Markdown support
- **lucide-react 0.294.0** - Icon library

### **Frontend Features**
- Single Page Application (SPA)
- Real-time chat interface
- Voice recording with Web Audio API
- Live waveform visualization
- Responsive three-column layout
- Google OAuth authentication
- Patient management interface
- X-ray image upload and display

---

## ⚙️ Backend Stack

### **Core Framework**
- **FastAPI 0.104.1** - Modern Python web framework
- **Python 3.9+** - Programming language
- **Uvicorn 0.24.0** - ASGI server

### **AI/ML Libraries**
- **Ollama 0.1.7** - Local LLM runtime integration
  - LLM Model: `llama3.2:3b` (text generation)
  - Embedding Model: `nomic-embed-text` (vector embeddings)
  - Vision Model: `llava` (image analysis)
- **Google Generative AI 0.8.3** - Gemini API integration
- **ZhipuAI 2.0.1** - GLM-4.5 model integration
- **faster-whisper 1.0.0** - Speech-to-text transcription

### **Database & Storage**
- **PostgreSQL** (via psycopg2-binary 2.9.9) - Relational database
  - Stores: Users, chats, messages, patients, patient documents
- **Pinecone 3.0.0** - Vector database
  - Stores: Document embeddings for RAG retrieval
  - Dimension: 768 (for Ollama embeddings)

### **Authentication & Security**
- **python-jose 3.3.0** - JWT token handling
- **authlib 1.2.1** - OAuth utilities
- **Google OAuth 2.0** - User authentication

### **File Processing**
- **PyPDF2 3.0.1** - PDF document parsing
- **python-docx 1.1.0** - Word document parsing
- **Pillow 10.0.0** - Image processing and optimization

### **Utilities**
- **python-dotenv 1.0.0** - Environment variable management
- **pydantic 2.5.0+** - Data validation and settings
- **python-multipart 0.0.6** - File upload handling

---

## 🗄️ Database Architecture

### **PostgreSQL Tables**
1. **users** - User accounts (Google OAuth)
2. **chats** - Chat sessions (user-specific, patient-linked)
3. **chat_messages** - Individual messages (text + images)
4. **patients** - Patient records (comprehensive medical history)
5. **patient_documents** - X-rays, reports, documents
6. **dental_queries** - Query history (legacy table)

### **Pinecone Vector Database**
- **Index Type:** Serverless
- **Dimension:** 768 (matches Ollama embedding model)
- **Purpose:** Semantic search over ingested dental guidelines
- **Metadata:** Document chunks with source information

---

## 🤖 AI/ML Architecture

### **RAG (Retrieval Augmented Generation) Pipeline**
1. **Document Ingestion:**
   - Parse documents (PDF, DOCX, TXT)
   - Chunk text into smaller segments
   - Generate embeddings using Ollama `nomic-embed-text`
   - Store in Pinecone vector database

2. **Query Processing:**
   - User asks a question
   - Generate query embedding
   - Semantic search in Pinecone (top-k retrieval)
   - Retrieve relevant document chunks
   - Build context from retrieved chunks

3. **Response Generation:**
   - Combine context + query + patient info + chat history
   - Generate response using LLM (Ollama/Gemini/GLM-4.5)
   - Return answer with source citations

### **Vision Capabilities**
- **X-ray Analysis:** Upload X-ray images
- **Image Processing:** Resize/optimize images before analysis
- **Vision Models:**
  - Ollama `llava` (local)
  - Google Gemini (cloud)
  - GLM-4.5 (cloud)

### **Voice Features**
- **Speech-to-Text:** Faster-Whisper for voice transcription
- **Real-time Visualization:** Web Audio API for live waveform

---

## 🔐 Authentication & Authorization

- **Google OAuth 2.0** - Social login
- **JWT Tokens** - Session management
- **User-specific data** - All chats, patients, messages are user-scoped

---

## 📦 Key Features Implemented

1. **RAG-based Q&A** - Context-aware responses from dental guidelines
2. **Patient Management** - Full CRUD for patient records
3. **Chat History** - Persistent, user-specific conversations
4. **Document Upload** - PDF, DOCX, TXT ingestion
5. **X-ray Analysis** - Vision model integration
6. **Voice Input** - Speech-to-text transcription
7. **Multi-model Support** - Ollama, Gemini, GLM-4.5
8. **Source Citations** - Every answer includes sources
9. **Patient Context** - AI remembers patient info within chats
10. **Image Persistence** - X-rays stored in chat history

---

## 🚀 Deployment Architecture

### **Frontend**
- **Build Tool:** Vite
- **Target:** Vercel (static hosting)
- **Port:** 5173 (dev), production-ready for Vercel

### **Backend**
- **Framework:** FastAPI
- **Server:** Uvicorn
- **Port:** 8000
- **Deployment Options:**
  - AWS Lambda (serverless)
  - AWS EC2
  - Google Cloud Run
  - Railway
  - Heroku

### **Database**
- **PostgreSQL:** AWS RDS or local
- **Pinecone:** Cloud-hosted (serverless)

---

## 🔄 Data Flow

1. **User Query** → Frontend (React)
2. **API Request** → Backend (FastAPI)
3. **Embedding Generation** → Ollama/Gemini/GLM
4. **Vector Search** → Pinecone
5. **Context Retrieval** → PostgreSQL (patient info, chat history)
6. **LLM Generation** → Ollama/Gemini/GLM
7. **Response** → Backend → Frontend
8. **Storage** → PostgreSQL (messages, queries)

---

## 📊 Technology Highlights

- **Modern Stack:** React 18, FastAPI, Python 3.9+
- **AI Integration:** Multiple LLM providers (local + cloud)
- **Vector Search:** Pinecone for semantic retrieval
- **Real-time Features:** Voice recording, live waveform
- **Image Processing:** Vision models for X-ray analysis
- **Authentication:** OAuth 2.0 with JWT
- **Database:** Hybrid (PostgreSQL + Pinecone)
- **Type Safety:** Pydantic models for validation

---

## 🎓 Interview Talking Points

1. **RAG Architecture:** Explain how you combine vector search with LLM generation
2. **Multi-model Support:** Flexibility to switch between local (Ollama) and cloud (Gemini/GLM) models
3. **Patient Context:** How the system maintains patient information across conversations
4. **Image Analysis:** Vision model integration for X-ray analysis
5. **Real-time Features:** Voice transcription and waveform visualization
6. **Scalability:** Vector database for efficient semantic search
7. **Security:** User authentication, data isolation, JWT tokens
8. **Full-stack:** End-to-end implementation from frontend to database

---

**Built with:** React, FastAPI, PostgreSQL, Pinecone, Ollama, Gemini, GLM-4.5
