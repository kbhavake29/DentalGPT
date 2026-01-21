# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DentalGPT is a clinical dental assistant application using RAG (Retrieval Augmented Generation). It provides evidence-based dental answers by querying local LLMs with context from a vector database of ingested dental guidelines.

**Tech Stack:**
- **Backend:** FastAPI (Python) with Ollama for local LLM embeddings and generation
- **Frontend:** React 18 with Vite build tool
- **Vector DB:** Pinecone serverless for semantic search (768-dim embeddings via nomic-embed-text)
- **Relational DB:** PostgreSQL for user data, chats, and query history
- **Authentication:** Google OAuth with JWT tokens (auth.py module)

## Development Commands

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py  # Runs on http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev     # Runs on http://localhost:5173
npm run build   # Production build to dist/
```

### Database Setup
```bash
createdb dentalgpt
psql -d dentalgpt -f scripts/setup_database.sql
# Or use Python script:
python scripts/setup_database.py
```

### Document Ingestion
```bash
# Ingest documents into Pinecone vector DB
python scripts/ingest_documents.py --file path/to/document.txt --title "Document Title"
```

### Quick Start (Both Services)
```bash
chmod +x start.sh
./start.sh  # Starts both backend and frontend
```

## Architecture Overview

```
Frontend (React/Vite)         Backend (FastAPI)
     |                              |
     +-------- HTTP/API ------------+
     |                              |
     |                         PostgreSQL (users/chats/messages)
     |                              |
     |                         Pinecone (vector search)
     |                              |
     |                         Ollama (local LLM)
```

**Query Flow:**
1. User submits query (text or voice) → Frontend
2. Frontend calls `/api/query` or `/api/chats/{id}/messages`
3. Backend generates embedding via Ollama (nomic-embed-text)
4. Pinecone semantic search retrieves relevant dental guidelines
5. Ollama LLM (llama3.2:3b) generates answer with retrieved context
6. Response stored in PostgreSQL, returned with sources

**Authentication Flow (Google OAuth):**
1. Frontend redirects to Google consent screen
2. Google redirects to frontend with auth code
3. Frontend sends code to `/api/auth/google`
4. Backend exchanges code for tokens, creates/updates user in DB
5. Backend returns JWT token stored in localStorage

## Key File Locations

- `backend/main.py` - FastAPI app with all API endpoints
- `backend/auth.py` - Google OAuth and JWT authentication logic
- `frontend/src/App.jsx` - Main React component with chat UI
- `frontend/src/Auth.jsx` - Google OAuth login component
- `frontend/src/LandingPage.jsx` - Landing page
- `frontend/src/LiveWaveform.jsx` - Audio visualization for voice input
- `scripts/setup_database.sql` - PostgreSQL schema
- `scripts/ingest_documents.py` - Bulk document ingestion utility

## Database Schema

**PostgreSQL Tables:**
- `users` - Google OAuth accounts (google_id, email, name)
- `chats` - User conversation sessions (user_id, title, favorite)
- `chat_messages` - Individual messages (chat_id, role, content, sources)
- `dental_queries` - Legacy query storage (with user_id)

## Environment Variables

Required in root `.env`:
```env
# Ollama (must be running locally)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_LLM_MODEL=llama3.2:3b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Pinecone
PINECONE_API_KEY=your_key
PINECONE_INDEX_NAME=dental-gpt

# PostgreSQL
RDS_HOST=localhost
RDS_PORT=5432
RDS_DATABASE=dentalgpt
RDS_USER=postgres
RDS_PASSWORD=your_password

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
JWT_SECRET=your_jwt_secret
```

Frontend `.env` (optional):
```env
VITE_API_URL=http://localhost:8000
```

## API Endpoints

**Authentication:**
- `POST /api/auth/google` - Exchange Google auth code for JWT
- `GET /api/auth/me` - Get current user from JWT

**Chat Management:**
- `GET /api/chats` - List user's chats
- `POST /api/chats` - Create new chat
- `PATCH /api/chats/{id}` - Update chat title/favorite
- `DELETE /api/chats/{id}` - Delete chat
- `GET /api/chats/{id}/messages` - Get chat messages
- `POST /api/chats/{id}/messages` - Add message (returns AI response)

**Query System:**
- `POST /api/query` - Unauthenticated query endpoint
- `POST /api/chats/{id}/messages` - Authenticated query with chat context

**Documents:**
- `POST /api/ingest` - Ingest text into Pinecone
- `POST /api/upload-document` - Upload PDF/TXT/DOCX for ingestion

**Voice:**
- `POST /api/voice/transcribe` - Transcribe audio via Faster-Whisper

## Important Patterns

1. **Database Access:** Uses `psycopg2.extras.RealDictCursor` for dict-like row access
2. **Error Handling:** Comprehensive try/catch with detailed error logging
3. **CORS:** Configured for localhost:3000, localhost:5173
4. **Embeddings:** 768-dimensional vectors via Ollama nomic-embed-text
5. **File Processing:** PyPDF2 for PDFs, python-docx for DOCX, with graceful fallbacks
6. **Frontend State:** React hooks with localStorage for JWT persistence

## Deployment Notes

- **Frontend:** Can deploy to Vercel (vite build output in `dist/`)
- **Backend:** Deploy to AWS Lambda, Google Cloud Run, Railway, or similar
- **Ollama:** Must be running on server for LLM features (local-only for privacy)
- **Environment:** Set `VITE_API_URL` to production backend URL in frontend deployment
