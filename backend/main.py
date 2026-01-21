from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv
import ollama
import requests
from pinecone import Pinecone, ServerlessSpec
import google.generativeai as genai
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime
import tempfile
import io
import base64
from auth import verify_google_token, get_or_create_user, create_jwt_token, get_current_user

app = FastAPI(title="DentalGPT API", version="1.0.0")

# Load environment variables from project root `.env`
# (so you don't have to export them manually before running the backend)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Ollama
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_LLM_MODEL = os.getenv("OLLAMA_LLM_MODEL", "llama3.2:3b")
OLLAMA_EMBEDDING_MODEL = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")
OLLAMA_VISION_MODEL = os.getenv("OLLAMA_VISION_MODEL", "llava")  # Vision model for image analysis

# Initialize Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    GEMINI_LLM_MODEL = "gemini-2.5-flash"  # Latest fast model (2025) - NO models/ prefix
    GEMINI_EMBEDDING_MODEL = "models/text-embedding-004"  # Embeddings NEED models/ prefix
else:
    print("Warning: GEMINI_API_KEY not found in environment variables")

# Initialize GLM (Zhipu AI)
GLM_API_KEY = os.getenv("GLM_API_KEY")
GLM_LLM_MODEL = os.getenv("GLM_LLM_MODEL", "glm-4")  # GLM-4 or GLM-4-Plus
GLM_EMBEDDING_MODEL = os.getenv("GLM_EMBEDDING_MODEL", "embedding-2")  # Try: embedding-2, text_embedding, or text-embedding
glm_client = None
if GLM_API_KEY:
    try:
        from zhipuai import ZhipuAI
        glm_client = ZhipuAI(api_key=GLM_API_KEY)
        print("GLM API key configured")
    except ImportError:
        print("Warning: zhipuai package not installed. Install with: pip install zhipuai")
else:
    print("Warning: GLM_API_KEY not found in environment variables")

# Configure Ollama client
try:
    import ollama
    # Set the base URL for Ollama client if needed
    if hasattr(ollama, 'Client'):
        ollama_client = ollama.Client(host=OLLAMA_BASE_URL)
    else:
        # For older versions, set environment variable
        os.environ['OLLAMA_HOST'] = OLLAMA_BASE_URL
except Exception as e:
    print(f"Warning: Could not configure Ollama client: {e}")


# ============================================================================
# AI MODEL HELPER FUNCTIONS
# ============================================================================

def get_embedding(text: str, model_provider: str = "ollama") -> List[float]:
    """Generate embedding using the specified model provider."""
    if model_provider == "gemini":
        if not GEMINI_API_KEY:
            raise HTTPException(status_code=500, detail="Gemini API key not configured")
        try:
            result = genai.embed_content(
                model=GEMINI_EMBEDDING_MODEL,
                content=text,
                task_type="retrieval_document"
            )
            return result['embedding']
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Gemini embedding error: {str(e)}")
    elif model_provider == "glm":
        # Note: Zhipu AI may not have a separate embedding model
        # Fall back to Ollama embeddings for GLM provider
        # If you have a valid GLM embedding model, uncomment the code below
        try:
            # Try using Ollama embeddings as fallback for GLM
            embedding_response = ollama.embeddings(
                model=OLLAMA_EMBEDDING_MODEL,
                prompt=text
            )
            return embedding_response['embedding']
        except Exception as e:
            # If Ollama also fails, try GLM embeddings API (if available)
            if GLM_API_KEY and glm_client:
                try:
                    # Try common embedding model names
                    for model_name in ["embedding-2", "text_embedding", "text-embedding"]:
                        try:
                            response = glm_client.embeddings.create(
                                model=model_name,
                                input=text
                            )
                            if hasattr(response, 'data') and len(response.data) > 0:
                                return response.data[0].embedding
                        except:
                            continue
                except:
                    pass
            raise HTTPException(status_code=500, detail=f"Embedding error: {str(e)}. Using Ollama embeddings as fallback for GLM.")
    else:  # ollama
        try:
            embedding_response = ollama.embeddings(
                model=OLLAMA_EMBEDDING_MODEL,
                prompt=text
            )
            return embedding_response['embedding']
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ollama embedding error: {str(e)}")


def generate_llm_response(prompt: str, model_provider: str = "ollama", image_data: Optional[str] = None) -> str:
    """Generate LLM response using the specified model provider. Supports vision if image_data is provided."""
    if model_provider == "gemini":
        if not GEMINI_API_KEY:
            raise HTTPException(status_code=500, detail="Gemini API key not configured")
        try:
            model = genai.GenerativeModel(GEMINI_LLM_MODEL)
            if image_data:
                # Decode base64 image
                image_bytes = base64.b64decode(image_data)
                from PIL import Image
                import io  # Explicit import to avoid scoping issues
                image = Image.open(io.BytesIO(image_bytes))
                response = model.generate_content([prompt, image])
            else:
                response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Gemini generation error: {str(e)}")
    elif model_provider == "glm":
        if not GLM_API_KEY or not glm_client:
            raise HTTPException(status_code=500, detail="GLM API key not configured")
        try:
            if image_data:
                # GLM-4 supports vision via messages format
                # Note: GLM vision API may require a different format
                # Try OpenAI-compatible format first
                try:
                    response = glm_client.chat.completions.create(
                        model=GLM_LLM_MODEL,
                        messages=[
                            {
                                "role": "user",
                                "content": [
                                    {"type": "text", "text": prompt},
                                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
                                ]
                            }
                        ]
                    )
                except Exception as vision_error:
                    # Fallback to simpler format if OpenAI format doesn't work
                    print(f"[DEBUG] GLM vision format error, trying fallback: {str(vision_error)}")
                    response = glm_client.chat.completions.create(
                        model=GLM_LLM_MODEL,
                        messages=[
                            {"role": "user", "content": f"{prompt}\n\n[Image attached: {len(image_data)} bytes]"}
                        ]
                    )
            else:
                response = glm_client.chat.completions.create(
                    model=GLM_LLM_MODEL,
                    messages=[{"role": "user", "content": prompt}]
                )
            
            # Extract response text from GLM API response
            if hasattr(response, 'choices') and len(response.choices) > 0:
                return response.choices[0].message.content
            else:
                raise HTTPException(status_code=500, detail="GLM generation error: Invalid response format")
        except ImportError:
            raise HTTPException(status_code=500, detail="zhipuai package not installed. Install with: pip install zhipuai")
        except Exception as e:
            error_str = str(e)
            # Check if it's a quota/balance error (429 or 1113)
            if "429" in error_str or "1113" in error_str or "余额不足" in error_str or "insufficient" in error_str.lower():
                # Fall back to Ollama when GLM quota is exhausted
                print(f"[WARNING] GLM quota exhausted, falling back to Ollama: {error_str}")
                try:
                    response = ollama.generate(
                        model=OLLAMA_LLM_MODEL,
                        prompt=prompt
                    )
                    return response['response']
                except Exception as ollama_error:
                    raise HTTPException(
                        status_code=500, 
                        detail=f"GLM quota exhausted and Ollama fallback failed. Please recharge your GLM account or switch to Ollama model. Ollama error: {str(ollama_error)}"
                    )
            raise HTTPException(status_code=500, detail=f"GLM generation error: {str(e)}")
    else:  # ollama
        try:
            if image_data:
                # Use vision model for image analysis
                image_bytes = base64.b64decode(image_data)
                
                # Optimize image size to prevent memory issues
                try:
                    from PIL import Image
                    import io
                    # Open and resize image if too large (max 1024px on longest side)
                    img = Image.open(io.BytesIO(image_bytes))
                    max_size = 1024
                    if max(img.size) > max_size:
                        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
                        # Convert back to bytes
                        output = io.BytesIO()
                        img_format = img.format or 'JPEG'
                        img.save(output, format=img_format, quality=85, optimize=True)
                        image_bytes = output.getvalue()
                        print(f"[DEBUG] Image resized to {img.size} to reduce memory usage")
                except ImportError:
                    print("[WARNING] PIL/Pillow not installed, using original image size")
                except Exception as img_error:
                    print(f"[WARNING] Image optimization failed, using original: {str(img_error)}")
                
                try:
                    print(f"[DEBUG] Calling Ollama vision model with image size: {len(image_bytes)} bytes")
                    response = ollama.generate(
                        model=OLLAMA_VISION_MODEL,
                        prompt=prompt,
                        images=[image_bytes]
                    )
                    print(f"[DEBUG] Ollama vision response received")
                except Exception as vision_error:
                    error_msg = str(vision_error)
                    if "not found" in error_msg.lower() or "404" in error_msg:
                        raise HTTPException(
                            status_code=404,
                            detail=f"Vision model '{OLLAMA_VISION_MODEL}' not found. Please install it by running: 'ollama pull {OLLAMA_VISION_MODEL}'"
                        )
                    if "500" in error_msg or "unexpectedly stopped" in error_msg.lower() or "resource" in error_msg.lower():
                        raise HTTPException(
                            status_code=500,
                            detail=f"Ollama vision model crashed (likely due to memory/resource limits). Try: 1) Restart Ollama service, 2) Use a smaller image, 3) Switch to Gemini model. Error: {str(vision_error)}"
                        )
                    raise
            else:
                response = ollama.generate(
                    model=OLLAMA_LLM_MODEL,
                    prompt=prompt
                )
            return response['response']
        except HTTPException:
            raise
        except Exception as e:
            error_msg = str(e)
            if "not found" in error_msg.lower() or "404" in error_msg:
                model_name = OLLAMA_VISION_MODEL if image_data else OLLAMA_LLM_MODEL
                raise HTTPException(
                    status_code=404,
                    detail=f"Model '{model_name}' not found. Please install it by running: 'ollama pull {model_name}'"
                )
            if "500" in error_msg or "unexpectedly stopped" in error_msg.lower():
                raise HTTPException(
                    status_code=500,
                    detail=f"Ollama model crashed. This may be due to resource limitations. Try restarting Ollama or using a different model. Error: {str(e)}"
                )
            raise HTTPException(status_code=500, detail=f"Ollama generation error: {str(e)}")


def transcribe_audio_gemini(audio_data: bytes) -> tuple:
    """Transcribe audio using Gemini (if configured as primary)."""
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API key not configured")
    # Note: Gemini doesn't have native audio transcription,
    # so we fall back to Whisper even when using Gemini for LLM
    from faster_whisper import WhisperModel
    import tempfile

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
        tmp_file.write(audio_data)
        tmp_file_path = tmp_file.name

    try:
        model = WhisperModel("base", device="cpu", compute_type="int8")
        segments, info = model.transcribe(tmp_file_path, beam_size=5)
        text = " ".join([segment.text for segment in segments])
        return text.strip(), info.language
    finally:
        if os.path.exists(tmp_file_path):
            os.unlink(tmp_file_path)

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
        user=os.getenv("RDS_USER", "postgres"),  # Default PostgreSQL user
        password=os.getenv("RDS_PASSWORD", "")
    )

# Pydantic models
class QueryRequest(BaseModel):
    query: str
    patient_id: Optional[str] = None
    model_provider: Optional[str] = "ollama"  # "ollama", "gemini", or "glm"

class QueryResponse(BaseModel):
    answer: str
    sources: List[dict]
    query_id: int

class IngestRequest(BaseModel):
    text: str
    metadata: Optional[dict] = None

class GoogleAuthRequest(BaseModel):
    access_token: str

class ChatCreateRequest(BaseModel):
    title: str = "New Chat"
    patient_id: Optional[str] = None

class ChatMessageRequest(BaseModel):
    query: str
    patient_id: Optional[str] = None
    model_provider: Optional[str] = "ollama"  # "ollama", "gemini", or "glm"
    image_data: Optional[str] = None  # Base64 encoded image for vision analysis

class ChatUpdateRequest(BaseModel):
    title: Optional[str] = None
    is_favorite: Optional[bool] = None

class VoiceTranscribeRequest(BaseModel):
    audio_data: str  # Base64 encoded audio

class PatientCreateRequest(BaseModel):
    id: str  # Unique patient ID
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    medical_history: Optional[str] = None
    dental_history: Optional[str] = None
    allergies: Optional[str] = None
    medications: Optional[str] = None
    summary: Optional[str] = None

class PatientUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    medical_history: Optional[str] = None
    dental_history: Optional[str] = None
    allergies: Optional[str] = None
    medications: Optional[str] = None
    summary: Optional[str] = None

class ChatCreateRequestWithPatient(BaseModel):
    title: str = "New Chat"
    patient_id: Optional[str] = None

@app.get("/")
async def root():
    return {"message": "DentalGPT API is running"}

# Authentication endpoints
@app.post("/api/auth/google")
async def google_auth(request: GoogleAuthRequest):
    """Authenticate user with Google OAuth token"""
    try:
        google_user_info = verify_google_token(request.access_token)
        user = get_or_create_user(google_user_info)
        token = create_jwt_token(user["id"])
        return {
            "token": token,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "picture_url": user.get("picture_url")
            }
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@app.get("/api/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user info"""
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "picture_url": current_user.get("picture_url")
    }

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
        "gemini_api_key_set": bool(GEMINI_API_KEY),
        "gemini_llm_model": GEMINI_LLM_MODEL if GEMINI_API_KEY else None,
        "gemini_embedding_model": GEMINI_EMBEDDING_MODEL if GEMINI_API_KEY else None,
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

# Chat management endpoints
@app.get("/api/chats")
async def get_user_chats(patient_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get all chats for the current user, optionally filtered by patient_id"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        if patient_id:
            # Verify patient belongs to user
            cur.execute(
                "SELECT user_id FROM patients WHERE id = %s",
                (patient_id,)
            )
            patient = cur.fetchone()
            if not patient or patient["user_id"] != current_user["id"]:
                raise HTTPException(status_code=403, detail="Patient not found or access denied")
            
            cur.execute(
                """SELECT c.id, c.title, c.patient_id, c.created_at, c.updated_at, c.is_favorite,
                          COUNT(cm.id) as message_count
                   FROM chats c
                   LEFT JOIN chat_messages cm ON c.id = cm.chat_id
                   WHERE c.user_id = %s AND c.patient_id = %s
                   GROUP BY c.id, c.title, c.patient_id, c.created_at, c.updated_at, c.is_favorite
                   ORDER BY c.updated_at DESC""",
                (current_user["id"], patient_id)
            )
        else:
            cur.execute(
                """SELECT c.id, c.title, c.patient_id, c.created_at, c.updated_at, c.is_favorite,
                          COUNT(cm.id) as message_count
                   FROM chats c
                   LEFT JOIN chat_messages cm ON c.id = cm.chat_id
                   WHERE c.user_id = %s
                   GROUP BY c.id, c.title, c.patient_id, c.created_at, c.updated_at, c.is_favorite
                   ORDER BY c.updated_at DESC""",
                (current_user["id"],)
            )
        
        chats = cur.fetchall()
        cur.close()
        conn.close()
        return {"chats": [dict(row) for row in chats]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chats")
async def create_chat(request: ChatCreateRequest, current_user: dict = Depends(get_current_user)):
    """Create a new chat for the current user, optionally linked to a patient"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # If patient_id is provided, verify it belongs to the user
        if request.patient_id:
            cur.execute(
                "SELECT user_id FROM patients WHERE id = %s",
                (request.patient_id,)
            )
            patient = cur.fetchone()
            if not patient or patient["user_id"] != current_user["id"]:
                raise HTTPException(status_code=403, detail="Patient not found or access denied")
        
        cur.execute(
            """INSERT INTO chats (user_id, title, patient_id) 
               VALUES (%s, %s, %s) 
               RETURNING *""",
            (current_user["id"], request.title, request.patient_id)
        )
        chat = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        print(f"[DEBUG] Created chat with patient_id: {chat.get('patient_id')}")
        return dict(chat)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"ERROR in create_chat: {str(e)}")
        print(f"Full traceback:\n{error_details}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/chats/{chat_id}")
async def update_chat(chat_id: int, request: ChatUpdateRequest, current_user: dict = Depends(get_current_user)):
    """Update chat title or favorite status"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Verify chat belongs to user
        cur.execute(
            "SELECT user_id FROM chats WHERE id = %s",
            (chat_id,)
        )
        chat = cur.fetchone()
        if not chat or chat["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Chat not found or access denied")
        
        # Build update query dynamically
        updates = []
        params = []
        
        if request.title is not None:
            new_title = request.title.strip()
            if not new_title:
                raise HTTPException(status_code=400, detail="Title cannot be empty")
            updates.append("title = %s")
            params.append(new_title)
        
        if request.is_favorite is not None:
            updates.append("is_favorite = %s")
            params.append(request.is_favorite)
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(chat_id)
        
        query = f"UPDATE chats SET {', '.join(updates)} WHERE id = %s RETURNING *"
        cur.execute(query, params)
        updated_chat = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        
        return dict(updated_chat)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/chats/{chat_id}")
async def delete_chat(chat_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a chat and all its messages"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Verify chat belongs to user
        cur.execute(
            "SELECT user_id FROM chats WHERE id = %s",
            (chat_id,)
        )
        chat = cur.fetchone()
        if not chat or chat["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Chat not found or access denied")
        
        # Delete chat (messages will be deleted via CASCADE)
        cur.execute("DELETE FROM chats WHERE id = %s", (chat_id,))
        conn.commit()
        cur.close()
        conn.close()
        
        return {"message": "Chat deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chats/{chat_id}/messages")
async def get_chat_messages(chat_id: int, current_user: dict = Depends(get_current_user)):
    """Get all messages for a specific chat"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Verify chat belongs to user
        cur.execute(
            "SELECT user_id FROM chats WHERE id = %s",
            (chat_id,)
        )
        chat = cur.fetchone()
        if not chat or chat["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Chat not found or access denied")
        
        cur.execute(
            """SELECT id, message_type, content, sources, image, created_at
               FROM chat_messages
               WHERE chat_id = %s
               ORDER BY created_at ASC""",
            (chat_id,)
        )
        messages = cur.fetchall()
        cur.close()
        conn.close()
        return {"messages": [dict(row) for row in messages]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def is_conversation_ending(query: str) -> bool:
    """Check if the query sounds like the end of a conversation"""
    query_lower = query.lower().strip()
    
    # List of phrases that indicate conversation ending
    ending_phrases = [
        "ok thanks", "ok thank you", "okay thanks", "okay thank you",
        "thanks", "thank you", "thx", "ty",
        "that's all", "thats all", "that is all",
        "nothing else", "nothing more",
        "no more questions", "no more",
        "that's it", "thats it", "that is it",
        "all done", "done", "finished",
        "no further questions", "no other questions",
        "got it", "understood", "i understand",
        "perfect", "great thanks", "great thank you",
        "appreciate it", "appreciate",
        "sounds good", "sounds great"
    ]
    
    # Check if query matches any ending phrase (exact match or starts with it)
    for phrase in ending_phrases:
        if query_lower == phrase or query_lower.startswith(phrase + " ") or query_lower.endswith(" " + phrase):
            return True
    
    # Check if query is very short and contains thanks/ok
    if len(query_lower.split()) <= 3:
        if any(word in query_lower for word in ["ok", "okay", "thanks", "thank", "thx", "ty"]):
            return True
    
    return False

@app.post("/api/chats/{chat_id}/messages")
async def add_chat_message(chat_id: int, request: ChatMessageRequest, current_user: dict = Depends(get_current_user)):
    """Add a message to a chat and get AI response"""
    try:
        model_provider = request.model_provider or "ollama"
        print(f"[DEBUG] Using model provider: {model_provider}")

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Verify chat belongs to user and get patient_id
        cur.execute(
            "SELECT user_id, patient_id FROM chats WHERE id = %s",
            (chat_id,)
        )
        chat = cur.fetchone()
        if not chat or chat["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Chat not found or access denied")
        
        # Get patient information if chat is linked to a patient
        patient_info = None
        if chat.get("patient_id"):
            print(f"[DEBUG] Chat is linked to patient_id: {chat['patient_id']}")
            cur.execute(
                """SELECT id, name, email, phone, date_of_birth, gender, address, 
                   medical_history, dental_history, allergies, medications, summary
                   FROM patients WHERE id = %s AND user_id = %s""",
                (chat["patient_id"], current_user["id"])
            )
            patient = cur.fetchone()
            if patient:
                patient_info = dict(patient)
                print(f"[DEBUG] Loaded patient info for: {patient_info.get('name')}")
            else:
                print(f"[DEBUG] Patient not found for patient_id: {chat['patient_id']}")
        else:
            print(f"[DEBUG] Chat is not linked to any patient")

        # Check if this is a conversation-ending message
        if is_conversation_ending(request.query):
            # Save user message with image if provided
            cur.execute(
                """INSERT INTO chat_messages (chat_id, message_type, content, image)
                   VALUES (%s, 'user', %s, %s)
                   RETURNING id""",
                (chat_id, request.query, request.image_data)
            )
            user_result = cur.fetchone()
            if not user_result:
                raise Exception("Failed to save user message")
            user_message_id = user_result['id']

            # Return a friendly closing response
            closing_response = "You're welcome! Is there anything else you'd like to know?"
            
            # Save AI message
            cur.execute(
                """INSERT INTO chat_messages (chat_id, message_type, content)
                   VALUES (%s, 'ai', %s)
                   RETURNING id""",
                (chat_id, closing_response)
            )
            ai_result = cur.fetchone()
            if not ai_result:
                raise Exception("Failed to save AI message")
            ai_message_id = ai_result['id']

            # Update chat timestamp
            cur.execute(
                "UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                (chat_id,)
            )

            conn.commit()
            cur.close()
            conn.close()

            return {
                "user_message": {"id": user_message_id, "content": request.query, "type": "user", "image": request.image_data},
                "ai_message": {"id": ai_message_id, "content": closing_response, "type": "ai", "sources": []}
            }

        # Generate embedding using the selected model provider
        query_embedding = get_embedding(request.query, model_provider)
        print(f"[DEBUG] Got embedding, dimension: {len(query_embedding)}")

        # Search Pinecone for relevant context
        search_results = index.query(
            vector=query_embedding,
            top_k=5,
            include_metadata=True
        )
        print(f"[DEBUG] Pinecone query returned {len(search_results.matches)} matches")

        # Build context from retrieved documents
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

        # Get recent chat message history for context (including images)
        cur.execute(
            """SELECT message_type, content, image, created_at
               FROM chat_messages
               WHERE chat_id = %s
               ORDER BY created_at DESC
               LIMIT 10""",
            (chat_id,)
        )
        recent_messages = cur.fetchall()
        chat_history = ""
        previous_image_data = None  # Store the most recent image from history
        if recent_messages:
            # Reverse to show chronological order (oldest first)
            messages_list = list(reversed(recent_messages))
            chat_history = "\n\nRecent Conversation History:\n"
            for msg in messages_list:
                role = "User" if msg["message_type"] == "user" else "Assistant"
                content = msg['content']
                # If message has an image, note it in the history
                if msg.get('image'):
                    content += " [Note: This message included an X-ray/medical image that was analyzed]"
                    # Store the most recent image for potential re-use
                    if msg["message_type"] == "user" and not previous_image_data:
                        previous_image_data = msg['image']
                chat_history += f"{role}: {content}\n"

        # Build patient context if available
        patient_context = ""
        if patient_info:
            patient_context = f"""
Patient Information:
- Name: {patient_info.get('name', 'N/A')}
- Patient ID: {patient_info.get('id', 'N/A')}
- Date of Birth: {patient_info.get('date_of_birth', 'N/A')}
- Gender: {patient_info.get('gender', 'N/A')}
- Email: {patient_info.get('email', 'N/A')}
- Phone: {patient_info.get('phone', 'N/A')}
- Address: {patient_info.get('address', 'N/A')}
"""
            if patient_info.get('summary'):
                patient_context += f"- Summary: {patient_info.get('summary')}\n"
            if patient_info.get('medical_history'):
                patient_context += f"- Medical History: {patient_info.get('medical_history')}\n"
            if patient_info.get('dental_history'):
                patient_context += f"- Dental History: {patient_info.get('dental_history')}\n"
            if patient_info.get('allergies'):
                patient_context += f"- Allergies: {patient_info.get('allergies')}\n"
            if patient_info.get('medications'):
                patient_context += f"- Current Medications: {patient_info.get('medications')}\n"

        # Generate prompt
        image_instruction = ""
        image_data_to_use = request.image_data
        
        # If current request doesn't have an image but previous message had one, 
        # and the query seems related to image analysis, use the previous image
        if not image_data_to_use and previous_image_data:
            # Check if query is asking about previous image analysis or summary
            query_lower = request.query.lower()
            # More specific keywords that indicate the user wants to reference the previous image
            image_related_keywords = ['xray', 'x-ray', 'image', 'picture', 'photo', 'summarize', 'summary', 'what did you see', 'what did you find', 'analysis', 'observe', 'findings', 'tell me about', 'describe']
            # Also check if it's a short follow-up query (likely referencing previous image)
            is_short_followup = len(request.query.split()) <= 5 and any(word in query_lower for word in ['summary', 'summarize', 'ok', 'what', 'tell', 'describe'])
            
            if any(keyword in query_lower for keyword in image_related_keywords) or is_short_followup:
                print(f"[DEBUG] Query seems related to image analysis, using previous image from chat history")
                image_data_to_use = previous_image_data
        
        if image_data_to_use:
            print(f"[DEBUG] Image data present in request, length: {len(image_data_to_use)}")
            image_instruction = "\n\nCRITICAL: The user has provided an X-ray or medical image that you MUST analyze. The image has been sent to you - do NOT say you don't have it or can't see it. Please carefully examine the image and provide detailed observations about:\n- Any visible dental structures, restorations, or abnormalities\n- Potential issues or concerns\n- Recommendations based on what you observe\n- Specific findings from the image\n\nYou have access to the image - analyze it now."
        
        prompt = f"""You are a dental assistant AI helping a dentist with patient care. Answer the following question based on the provided dental guidelines, clinical knowledge, and conversation history.{patient_context}{chat_history}

Dental Guidelines Context:
{context}
{image_instruction}

Current Question: {request.query}

IMPORTANT: Provide a clear, concise, and clinically accurate answer. 
- If the context contains relevant information, use it and cite which parts of the guidelines you're referencing.
- If the context doesn't contain enough information, still provide a helpful general answer based on your dental knowledge and best practices. Don't just say "I don't have information" - be helpful and provide practical guidance.
- Always be professional, empathetic, and clinically sound in your responses. 

IMPORTANT INSTRUCTIONS:
1. When the user asks about "this patient", "the patient", "patient summary", "patient information", or similar questions, you MUST use the Patient Information provided above.
2. When the user asks about procedures, treatments, or actions discussed in this conversation, refer to the Recent Conversation History above to see what was previously discussed.
3. If the conversation history mentions a procedure being done (e.g., "done with procedure of root canal"), you should acknowledge this when asked about the last procedure.
4. Use both the dental guidelines and conversation history to provide comprehensive answers."""

        # Generate answer using the selected LLM (with image support if provided)
        print(f"[DEBUG] Image data present: {bool(image_data_to_use)}, length: {len(image_data_to_use) if image_data_to_use else 0}")
        answer = generate_llm_response(prompt, model_provider, image_data_to_use)
        print(f"[DEBUG] Got response from {model_provider}, length: {len(answer)}")
        if image_data_to_use:
            print(f"[DEBUG] Image analysis was performed with {model_provider}")

        # Save user message with image if provided
        cur.execute(
            """INSERT INTO chat_messages (chat_id, message_type, content, image)
               VALUES (%s, 'user', %s, %s)
               RETURNING id""",
            (chat_id, request.query, request.image_data)
        )
        user_result = cur.fetchone()
        if not user_result:
            raise Exception("Failed to save user message")
        user_message_id = user_result['id']

        # Save AI message
        cur.execute(
            """INSERT INTO chat_messages (chat_id, message_type, content, sources)
               VALUES (%s, 'ai', %s, %s)
               RETURNING id""",
            (chat_id, answer, json.dumps(sources))
        )
        ai_result = cur.fetchone()
        if not ai_result:
            raise Exception("Failed to save AI message")
        ai_message_id = ai_result['id']

        # Update chat timestamp
        cur.execute(
            "UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = %s",
            (chat_id,)
        )

        # Update chat title if it's the first message
        cur.execute(
            "SELECT COUNT(*) as count FROM chat_messages WHERE chat_id = %s AND message_type = 'user'",
            (chat_id,)
        )
        result = cur.fetchone()
        message_count = result['count'] if result else 0
        if message_count == 1:
            title = request.query[:30] + "..." if len(request.query) > 30 else request.query
            cur.execute(
                "UPDATE chats SET title = %s WHERE id = %s",
                (title, chat_id)
            )

        conn.commit()
        cur.close()
        conn.close()

        return {
            "user_message": {"id": user_message_id, "content": request.query, "type": "user", "image": request.image_data},
            "ai_message": {"id": ai_message_id, "content": answer, "type": "ai", "sources": sources}
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        error_type = type(e).__name__
        error_message = str(e) if str(e) else repr(e)
        print(f"=" * 50)
        print(f"ERROR in add_chat_message:")
        print(f"Type: {error_type}")
        print(f"Message: {error_message}")
        print(f"Chat ID: {chat_id}")
        print(f"User ID: {current_user.get('id') if current_user else 'None'}")
        print(f"Query: {request.query[:50] if request else 'N/A'}")
        print(f"Full traceback:\n{error_details}")
        print(f"=" * 50)
        # Close database connection if still open
        try:
            if 'cur' in locals():
                cur.close()
            if 'conn' in locals():
                conn.close()
        except:
            pass
        raise HTTPException(
            status_code=500,
            detail=f"Error processing query ({error_type}): {error_message}. Check backend terminal for full details."
        )

# Voice transcription endpoint
@app.post("/api/voice/transcribe")
async def transcribe_audio(request: VoiceTranscribeRequest, current_user: dict = Depends(get_current_user)):
    """Transcribe audio using Faster-Whisper"""
    try:
        from faster_whisper import WhisperModel
        import base64
        
        # Decode base64 audio
        audio_bytes = base64.b64decode(request.audio_data)
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            tmp_file.write(audio_bytes)
            tmp_file_path = tmp_file.name
        
        try:
            # Load Whisper model (use base model for speed, or medium for better accuracy)
            model = WhisperModel("base", device="cpu", compute_type="int8")
            
            # Transcribe
            segments, info = model.transcribe(tmp_file_path, beam_size=5)
            text = " ".join([segment.text for segment in segments])
            
            return {"text": text.strip(), "language": info.language}
        finally:
            # Clean up temp file
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
    except ImportError:
        raise HTTPException(status_code=500, detail="Faster-Whisper not installed. Install with: pip install faster-whisper")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")

@app.post("/api/query", response_model=QueryResponse)
async def query_dental_assistant(request: QueryRequest, current_user: Optional[dict] = Depends(get_current_user) if hasattr(get_current_user, '__call__') else None):
    """
    Main query endpoint that:
    1. Embeds the query using Ollama or Gemini
    2. Searches Pinecone for relevant context
    3. Generates answer using Ollama or Gemini
    4. Logs to PostgreSQL
    """
    try:
        # Check if this is a conversation-ending message
        if is_conversation_ending(request.query):
            closing_response = "You're welcome! Is there anything else you'd like to know?"
            
            # Log to database if user is authenticated
            if current_user:
                try:
                    conn = get_db_connection()
                    cur = conn.cursor()
                    cur.execute(
                        """INSERT INTO dental_queries (user_id, query, response, model_provider)
                           VALUES (%s, %s, %s, %s)""",
                        (current_user["id"], request.query, closing_response, "ollama")
                    )
                    conn.commit()
                    cur.close()
                    conn.close()
                except Exception as e:
                    print(f"Error logging query: {e}")
            
            return QueryResponse(
                query=request.query,
                answer=closing_response,
                sources=[],
                model_provider="ollama"
            )
        
        model_provider = request.model_provider or "ollama"
        print(f"[DEBUG] Using model provider: {model_provider}")

        # 1. Generate embedding for the query
        query_embedding = get_embedding(request.query, model_provider)
        print(f"[DEBUG] Got embedding, dimension: {len(query_embedding)}")

        # 2. Search Pinecone for relevant context
        search_results = index.query(
            vector=query_embedding,
            top_k=5,
            include_metadata=True
        )
        print(f"[DEBUG] Pinecone query returned {len(search_results.matches)} matches")

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

        # 4. Generate answer using the selected LLM
        prompt = f"""You are a dental assistant AI. Answer the following question based on the provided dental guidelines and clinical knowledge.

Dental Guidelines Context:
{context}

Question: {request.query}

IMPORTANT: Provide a clear, concise, and clinically accurate answer.
- If the context contains relevant information, use it and cite which parts of the guidelines you're referencing.
- If the context doesn't contain enough information, still provide a helpful general answer based on your dental knowledge and best practices. Don't just say "I don't have information" - be helpful and provide practical guidance.
- Always be professional, empathetic, and clinically sound in your responses."""

        answer = generate_llm_response(prompt, model_provider)
        print(f"[DEBUG] Got response from {model_provider}, length: {len(answer)}")

        # 5. Log to PostgreSQL
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        user_id = current_user["id"] if current_user else None
        cur.execute(
            """INSERT INTO dental_queries (user_id, patient_id, query_text, ai_response, source_docs, created_at)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (user_id, request.patient_id, request.query, answer, json.dumps(sources), datetime.now())
        )
        result = cur.fetchone()
        query_id = result['id'] if result else None
        conn.commit()
        cur.close()
        conn.close()

        return QueryResponse(
            answer=answer,
            sources=sources,
            query_id=query_id
        )

    except HTTPException:
        raise
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

@app.post("/api/upload-image")
async def upload_image(file: UploadFile = File(...), patient_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """
    Upload an image (X-ray, medical image) and return base64 encoded data for vision analysis.
    Optionally link to a patient.
    """
    try:
        # Read file content
        contents = await file.read()
        file_extension = os.path.splitext(file.filename)[1].lower()
        
        # Check if it's an image file
        allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.dicom', '.dcm']
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported image type: {file_extension}. Supported: {', '.join(allowed_extensions)}"
            )
        
        # Convert to base64
        image_base64 = base64.b64encode(contents).decode('utf-8')
        
        # Optionally save to patient_documents table if patient_id is provided
        if patient_id:
            try:
                conn = get_db_connection()
                cur = conn.cursor(cursor_factory=RealDictCursor)
                
                # Verify patient belongs to user
                cur.execute(
                    "SELECT user_id FROM patients WHERE id = %s",
                    (patient_id,)
                )
                patient = cur.fetchone()
                if not patient or patient["user_id"] != current_user["id"]:
                    raise HTTPException(status_code=403, detail="Patient not found or access denied")
                
                # Save to patient_documents
                cur.execute(
                    """INSERT INTO patient_documents (patient_id, user_id, document_type, file_name, file_data, created_at)
                       VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                       RETURNING id""",
                    (patient_id, current_user["id"], "xray", file.filename, contents)
                )
                doc_result = cur.fetchone()
                conn.commit()
                cur.close()
                conn.close()
                print(f"[DEBUG] Saved image to patient_documents: {doc_result['id']}")
            except HTTPException:
                raise
            except Exception as e:
                print(f"[WARNING] Could not save to patient_documents: {str(e)}")
                # Continue anyway - image is still encoded and can be used
        
        return {
            "message": f"Successfully uploaded image: {file.filename}",
            "filename": file.filename,
            "image_data": image_base64,  # Return base64 for frontend to use in queries
            "patient_id": patient_id
        }
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"ERROR in upload_image: {str(e)}")
        print(f"Full traceback:\n{error_details}")
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

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

# Patient management endpoints
@app.get("/api/patients")
async def get_patients(current_user: dict = Depends(get_current_user)):
    """Get all patients for the current user, sorted A-Z by name"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute(
            """SELECT id, name, email, phone, date_of_birth, gender, summary, created_at
               FROM patients
               WHERE user_id = %s
               ORDER BY LOWER(name) ASC""",
            (current_user["id"],)
        )
        patients = cur.fetchall()
        cur.close()
        conn.close()
        
        return {"patients": [dict(row) for row in patients]}
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"ERROR in get_patients: {str(e)}")
        print(f"Full traceback:\n{error_details}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.get("/api/patients/{patient_id}")
async def get_patient(patient_id: str, current_user: dict = Depends(get_current_user)):
    """Get patient details by ID"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute(
            """SELECT * FROM patients
               WHERE id = %s AND user_id = %s""",
            (patient_id, current_user["id"])
        )
        patient = cur.fetchone()
        cur.close()
        conn.close()
        
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        return dict(patient)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"ERROR in get_patient: {str(e)}")
        print(f"Full traceback:\n{error_details}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.post("/api/patients")
async def create_patient(request: PatientCreateRequest, current_user: dict = Depends(get_current_user)):
    """Create a new patient"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if patient ID already exists for this user
        cur.execute(
            "SELECT id FROM patients WHERE id = %s AND user_id = %s",
            (request.id, current_user["id"])
        )
        existing = cur.fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Patient ID already exists")
        
        cur.execute(
            """INSERT INTO patients (id, user_id, name, email, phone, date_of_birth, gender, address, 
               medical_history, dental_history, allergies, medications, summary)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING *""",
            (request.id, current_user["id"], request.name, request.email, request.phone,
             request.date_of_birth, request.gender, request.address, request.medical_history,
             request.dental_history, request.allergies, request.medications, request.summary)
        )
        patient = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        
        return dict(patient)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"ERROR in create_patient: {str(e)}")
        print(f"Full traceback:\n{error_details}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.patch("/api/patients/{patient_id}")
async def update_patient(patient_id: str, request: PatientUpdateRequest, current_user: dict = Depends(get_current_user)):
    """Update patient information"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Verify patient belongs to user
        cur.execute(
            "SELECT user_id FROM patients WHERE id = %s",
            (patient_id,)
        )
        patient = cur.fetchone()
        if not patient or patient["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Patient not found or access denied")
        
        # Build update query dynamically
        updates = []
        params = []
        
        if request.name is not None:
            updates.append("name = %s")
            params.append(request.name)
        if request.email is not None:
            updates.append("email = %s")
            params.append(request.email)
        if request.phone is not None:
            updates.append("phone = %s")
            params.append(request.phone)
        if request.date_of_birth is not None:
            updates.append("date_of_birth = %s")
            params.append(request.date_of_birth)
        if request.gender is not None:
            updates.append("gender = %s")
            params.append(request.gender)
        if request.address is not None:
            updates.append("address = %s")
            params.append(request.address)
        if request.medical_history is not None:
            updates.append("medical_history = %s")
            params.append(request.medical_history)
        if request.dental_history is not None:
            updates.append("dental_history = %s")
            params.append(request.dental_history)
        if request.allergies is not None:
            updates.append("allergies = %s")
            params.append(request.allergies)
        if request.medications is not None:
            updates.append("medications = %s")
            params.append(request.medications)
        if request.summary is not None:
            updates.append("summary = %s")
            params.append(request.summary)
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(patient_id)
        
        query = f"UPDATE patients SET {', '.join(updates)} WHERE id = %s RETURNING *"
        cur.execute(query, params)
        updated_patient = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        
        return dict(updated_patient)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"ERROR in update_patient: {str(e)}")
        print(f"Full traceback:\n{error_details}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.get("/api/patients/{patient_id}/chats")
async def get_patient_chats(patient_id: str, current_user: dict = Depends(get_current_user)):
    """Get all chats for a specific patient"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Verify patient belongs to user
        cur.execute(
            "SELECT user_id FROM patients WHERE id = %s",
            (patient_id,)
        )
        patient = cur.fetchone()
        if not patient or patient["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Patient not found or access denied")
        
        cur.execute(
            """SELECT id, title, is_favorite, created_at, updated_at
               FROM chats
               WHERE patient_id = %s AND user_id = %s
               ORDER BY updated_at DESC""",
            (patient_id, current_user["id"])
        )
        chats = cur.fetchall()
        cur.close()
        conn.close()
        
        return {"chats": [dict(row) for row in chats]}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"ERROR in get_patient_chats: {str(e)}")
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
