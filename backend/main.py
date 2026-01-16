from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv
import ollama
import requests
from pinecone import Pinecone, ServerlessSpec
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime
import tempfile
import io

app = FastAPI(title="DentalGPT API", version="1.0.0")

# Load environment variables from project root `.env`
# (so you don't have to export them manually before running the backend)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Ollama
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_LLM_MODEL = os.getenv("OLLAMA_LLM_MODEL", "llama3.2:3b")
OLLAMA_EMBEDDING_MODEL = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")

# Initialize Pinecone
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index_name = os.getenv("PINECONE_INDEX_NAME", "dental-gpt")

# Get or create index
try:
    index = pc.Index(index_name)
except Exception:
    # Create index if it doesn't exist (768 dimensions for nomic-embed-text)
        pc.create_index(
            name=index_name,
            dimension=768,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1")
        )
    index = pc.Index(index_name)

# Database connection
def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("RDS_HOST", "localhost"),
        port=os.getenv("RDS_PORT", "5432"),
        database=os.getenv("RDS_DATABASE", "dentalgpt"),
        user=os.getenv("RDS_USER", "komalbhavake"),  # macOS uses your username, not "postgres"
        password=os.getenv("RDS_PASSWORD", "")
    )

# Pydantic models
class QueryRequest(BaseModel):
    query: str
    patient_id: Optional[str] = None

class QueryResponse(BaseModel):
    answer: str
    sources: List[dict]
    query_id: int

class IngestRequest(BaseModel):
    text: str
    metadata: Optional[dict] = None

@app.get("/")
async def root():
    return {"message": "DentalGPT API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/api/debug")
async def debug_info():
    """Debug endpoint to check environment variables and connections."""
    debug_info = {
        "ollama_base_url": OLLAMA_BASE_URL,
        "ollama_llm_model": OLLAMA_LLM_MODEL,
        "ollama_embedding_model": OLLAMA_EMBEDDING_MODEL,
        "pinecone_api_key_set": bool(os.getenv("PINECONE_API_KEY")),
        "pinecone_index_name": os.getenv("PINECONE_INDEX_NAME", "dental-gpt"),
        "rds_host": os.getenv("RDS_HOST", "localhost"),
        "rds_database": os.getenv("RDS_DATABASE", "dentalgpt"),
    }
    
    # Test database connection
    try:
        conn = get_db_connection()
        conn.close()
        debug_info["database_connection"] = "OK"
    except Exception as e:
        debug_info["database_connection"] = f"ERROR: {str(e)}"
    
    # Test Pinecone connection
    try:
        index_stats = index.describe_index_stats()
        debug_info["pinecone_connection"] = "OK"
    except Exception as e:
        debug_info["pinecone_connection"] = f"ERROR: {str(e)}"
    
    return debug_info

@app.post("/api/query", response_model=QueryResponse)
async def query_dental_assistant(request: QueryRequest):
    """
    Main query endpoint that:
    1. Embeds the query using Ollama nomic-embed-text
    2. Searches Pinecone for relevant context
    3. Generates answer using Ollama llama3.2:3b
    4. Logs to PostgreSQL
    """
    try:
        # 1. Generate embedding for the query using Ollama
        embedding_response = ollama.embeddings(
            model=OLLAMA_EMBEDDING_MODEL,
            prompt=request.query
        )
        query_embedding = embedding_response['embedding']
        
        # 2. Search Pinecone for relevant context
        search_results = index.query(
            vector=query_embedding,
            top_k=5,
            include_metadata=True
        )
        
        # 3. Build context from retrieved documents
        context_chunks = []
        sources = []
        for match in search_results.matches:
            chunk_text = match.metadata.get('text', '')
            context_chunks.append(chunk_text)
            sources.append({
                "text": chunk_text[:200] + "..." if len(chunk_text) > 200 else chunk_text,
                "score": match.score,
                "metadata": match.metadata
            })
        
        context = "\n\n".join(context_chunks)
        
        # 4. Generate answer using Ollama llama3.2:3b
        prompt = f"""You are a dental assistant AI. Answer the following question based on the provided dental guidelines and clinical knowledge.

Dental Guidelines Context:
{context}

Question: {request.query}

Provide a clear, concise, and clinically accurate answer. If the context doesn't contain enough information, say so. Always cite which parts of the guidelines you're referencing."""

        response = ollama.generate(
            model=OLLAMA_LLM_MODEL,
            prompt=prompt
        )
        answer = response['response']
        
        # 5. Log to PostgreSQL
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO dental_queries (patient_id, query_text, ai_response, source_docs, created_at) 
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (request.patient_id, request.query, answer, json.dumps(sources), datetime.now())
        )
        query_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        
        return QueryResponse(
            answer=answer,
            sources=sources,
            query_id=query_id
        )
    
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"ERROR in query_dental_assistant: {str(e)}")
        print(f"Full traceback:\n{error_details}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.post("/api/ingest")
async def ingest_document(request: IngestRequest):
    """
    Ingest a document into Pinecone for RAG retrieval.
    The text will be chunked and embedded.
    """
    try:
        # Simple chunking (you can enhance this with RecursiveCharacterTextSplitter)
        chunk_size = 1000
        overlap = 200
        chunks = []
        start = 0
        while start < len(request.text):
            end = start + chunk_size
            chunks.append(request.text[start:end])
            start = end - overlap
        
        vectors = []
        for i, chunk in enumerate(chunks):
            # Generate embedding using Ollama
            embedding_response = ollama.embeddings(
                model=OLLAMA_EMBEDDING_MODEL,
                prompt=chunk
            )
            embedding = embedding_response['embedding']
            
            # Prepare vector
            vector_id = f"doc_{datetime.now().timestamp()}_{i}"
            metadata = {
                "text": chunk,
                "chunk_index": i,
                "total_chunks": len(chunks),
                **(request.metadata or {})
            }
            vectors.append((vector_id, embedding, metadata))
        
        # Upsert to Pinecone
        index.upsert(vectors=vectors)
        
        return {"message": f"Successfully ingested {len(chunks)} chunks", "chunks": len(chunks)}
    
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"ERROR in ingest_document: {str(e)}")
        print(f"Full traceback:\n{error_details}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.post("/api/upload-document")
async def upload_document(file: UploadFile = File(...), title: Optional[str] = None):
    """
    Upload and ingest a document file (PDF, TXT, DOCX, etc.) into Pinecone.
    """
    try:
        # Read file content
        contents = await file.read()
        file_extension = os.path.splitext(file.filename)[1].lower()
        
        # Parse file based on extension
        text_content = ""
        
        if file_extension == '.txt' or file_extension == '.md':
            text_content = contents.decode('utf-8')
        
        elif file_extension == '.pdf':
            # For PDF parsing, you'll need PyPDF2 or pdfplumber
            try:
                import PyPDF2
                import io
                pdf_file = io.BytesIO(contents)
                pdf_reader = PyPDF2.PdfReader(pdf_file)
                text_content = ""
                for page in pdf_reader.pages:
                    text_content += page.extract_text() + "\n"
            except ImportError:
                # Fallback: try pdfplumber
                try:
                    import pdfplumber
                    with pdfplumber.open(io.BytesIO(contents)) as pdf:
                        text_content = ""
                        for page in pdf.pages:
                            text_content += page.extract_text() + "\n"
                except ImportError:
                    raise HTTPException(
                        status_code=400, 
                        detail="PDF parsing requires PyPDF2 or pdfplumber. Install with: pip install PyPDF2 or pip install pdfplumber"
                    )
        
        elif file_extension == '.docx':
            try:
                from docx import Document
                import io
                doc = Document(io.BytesIO(contents))
                text_content = "\n".join([paragraph.text for paragraph in doc.paragraphs])
            except ImportError:
                raise HTTPException(
                    status_code=400,
                    detail="DOCX parsing requires python-docx. Install with: pip install python-docx"
                )
        
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file_extension}. Supported: .txt, .md, .pdf, .docx"
            )
        
        if not text_content.strip():
            raise HTTPException(status_code=400, detail="No text content extracted from file")
        
        # Chunk and ingest
        chunk_size = 1000
        overlap = 200
        chunks = []
        start = 0
        while start < len(text_content):
            end = start + chunk_size
            chunks.append(text_content[start:end])
            start = end - overlap
        
        vectors = []
        for i, chunk in enumerate(chunks):
            # Generate embedding using Ollama
            embedding_response = ollama.embeddings(
                model=OLLAMA_EMBEDDING_MODEL,
                prompt=chunk
            )
            embedding = embedding_response['embedding']
            
            # Prepare vector
            vector_id = f"doc_{datetime.now().timestamp()}_{i}"
            metadata = {
                "text": chunk,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "source_file": file.filename,
                "title": title or file.filename
            }
            vectors.append((vector_id, embedding, metadata))
        
        # Upsert to Pinecone in batches
        batch_size = 100
        for i in range(0, len(vectors), batch_size):
            batch = vectors[i:i + batch_size]
            index.upsert(vectors=batch)
        
        return {
            "message": f"Successfully uploaded and ingested {file.filename}",
            "chunks": len(chunks),
            "filename": file.filename
        }
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"ERROR in upload_document: {str(e)}")
        print(f"Full traceback:\n{error_details}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.get("/api/patient-history/{patient_id}")
async def get_patient_history(patient_id: str):
    """
    Retrieve recent queries for a patient from PostgreSQL.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """SELECT id, query_text, ai_response, created_at 
               FROM dental_queries 
               WHERE patient_id = %s 
               ORDER BY created_at DESC 
               LIMIT 10""",
            (patient_id,)
        )
        history = cur.fetchall()
        cur.close()
        conn.close()
        
        return {"history": [dict(row) for row in history]}
    
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"ERROR in get_patient_history: {str(e)}")
        print(f"Full traceback:\n{error_details}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.get("/api/recent-queries")
async def get_recent_queries(limit: int = 10):
    """
    Get recent queries across all patients.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """SELECT id, patient_id, query_text, ai_response, created_at 
               FROM dental_queries 
               ORDER BY created_at DESC 
               LIMIT %s""",
            (limit,)
        )
        queries = cur.fetchall()
        cur.close()
        conn.close()
        
        return {"queries": [dict(row) for row in queries]}
    
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in get_recent_queries: {str(e)}")
        print(f"Traceback: {error_details}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
