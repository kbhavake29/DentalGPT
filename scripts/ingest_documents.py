"""
Document ingestion script for DentalGPT.
Processes PDF/text files and ingests them into Pinecone.
"""
import os
import sys
import google.generativeai as genai
from pinecone import Pinecone, ServerlessSpec
from datetime import datetime
import json
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

# Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "dental-gpt")

# Initialize Gemini
genai.configure(api_key=GEMINI_API_KEY)

def chunk_text(text, chunk_size=1000, overlap=200):
    """Split text into overlapping chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start = end - overlap
    return chunks

def ingest_text(text, metadata=None):
    """Ingest a text document into Pinecone."""
    # Initialize
    pc = Pinecone(api_key=PINECONE_API_KEY)
    
    # Get or create index
    try:
        index = pc.Index(INDEX_NAME)
    except Exception:
        print(f"Creating index {INDEX_NAME}...")
        pc.create_index(
            name=INDEX_NAME,
            dimension=768,  # Google Gemini text-embedding-004 uses 768 dimensions
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1")
        )
        index = pc.Index(INDEX_NAME)
    
    # Chunk the text
    chunks = chunk_text(text)
    print(f"Processing {len(chunks)} chunks...")
    
    # Generate embeddings and upsert
    vectors = []
    
    for i, chunk in enumerate(chunks):
        try:
            # Generate embedding using Google Gemini
            result = genai.embed_content(
                model="models/text-embedding-004",
                content=chunk
            )
            embedding = result['embedding']
            
            # Create vector ID and metadata
            vector_id = f"doc_{datetime.now().timestamp()}_{i}"
            chunk_metadata = {
                "text": chunk,
                "chunk_index": i,
                "total_chunks": len(chunks),
                **(metadata or {})
            }
            
            vectors.append((vector_id, embedding, chunk_metadata))
            
            if (i + 1) % 10 == 0:
                print(f"Processed {i + 1}/{len(chunks)} chunks...")
        
        except Exception as e:
            print(f"Error processing chunk {i}: {e}")
            continue
    
    # Upsert in batches
    batch_size = 100
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i:i + batch_size]
        index.upsert(vectors=batch)
        print(f"Upserted batch {i//batch_size + 1}/{(len(vectors) + batch_size - 1)//batch_size}")
    
    print(f"Successfully ingested {len(vectors)} chunks into Pinecone!")
    return len(vectors)

def ingest_file(file_path, metadata=None):
    """Ingest a file into Pinecone."""
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return
    
    # Read file based on extension
    if file_path.endswith('.txt'):
        with open(file_path, 'r', encoding='utf-8') as f:
            text = f.read()
    elif file_path.endswith('.md'):
        with open(file_path, 'r', encoding='utf-8') as f:
            text = f.read()
    else:
        print(f"Unsupported file type: {file_path}")
        return
    
    file_metadata = {
        "source_file": os.path.basename(file_path),
        **(metadata or {})
    }
    
    return ingest_text(text, file_metadata)

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Ingest documents into DentalGPT")
    parser.add_argument("--file", type=str, help="Path to text/markdown file")
    parser.add_argument("--text", type=str, help="Direct text to ingest")
    parser.add_argument("--title", type=str, help="Document title for metadata")
    
    args = parser.parse_args()
    
    if args.file:
        metadata = {"title": args.title} if args.title else None
        ingest_file(args.file, metadata)
    elif args.text:
        metadata = {"title": args.title} if args.title else None
        ingest_text(args.text, metadata)
    else:
        print("Please provide either --file or --text argument")
        parser.print_help()
