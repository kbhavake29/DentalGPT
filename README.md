# DentalGPT - Clinical Dental Assistant

A medical-grade MVP for a dental assistant application using RAG (Retrieval Augmented Generation) with Ollama (local LLM), Pinecone vector database, and PostgreSQL.

## 🏗️ Architecture

- **Frontend:** React.js with Vite (ready for Vercel deployment)
- **Backend:** FastAPI (Python)
- **Vector DB:** Pinecone (for clinical knowledge retrieval)
- **Relational DB:** PostgreSQL (for patient records and query history)
- **LLM:** Ollama llama3.2:3b (local, for text generation)
- **Embeddings:** Ollama nomic-embed-text (local, for vector embeddings)

## 📋 Prerequisites

1. **Python 3.9+**
2. **Node.js 18+**
3. **PostgreSQL** (local or AWS RDS)
4. **Ollama:** Local LLM runtime ([Install here](https://ollama.com/))
5. **API Keys:**
   - Pinecone API Key ([Get it here](https://www.pinecone.io/)) - for vector database

## 🚀 Quick Start

### 1. Clone and Setup

```bash
cd DentalGPT
```

### 2. Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp ../.env.example ../.env
# Edit .env with your API keys
```

### 3. Database Setup

```bash
# Create PostgreSQL database
createdb dentalgpt

# Run setup script
psql -d dentalgpt -f ../scripts/setup_database.sql
```

### 4. Frontend Setup

```bash
# Navigate to frontend
cd ../frontend

# Install dependencies
npm install

# Create .env file (optional, defaults to localhost:8000)
echo "VITE_API_URL=http://localhost:8000" > .env
```

### 5. Configure Environment Variables

Edit the `.env` file in the root directory:

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_LLM_MODEL=llama3.2:3b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
PINECONE_API_KEY=your_actual_pinecone_key
PINECONE_INDEX_NAME=dental-gpt
RDS_HOST=localhost
RDS_PORT=5432
RDS_DATABASE=dentalgpt
RDS_USER=postgres
RDS_PASSWORD=your_password
```

## 🏃 Running the Application

### Start Backend

```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python main.py
```

Backend will run on `http://localhost:8000`

### Start Frontend

```bash
cd frontend
npm run dev
```

Frontend will run on `http://localhost:3000`

## 📚 Ingesting Documents

To add dental guidelines and knowledge to the system:

### Option 1: Using the ingestion script

```bash
# From root directory
cd scripts
python ingest_documents.py --file path/to/your/document.txt --title "Document Title"
```

### Option 2: Using the API

```bash
curl -X POST http://localhost:8000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your dental guideline text here...",
    "metadata": {"title": "Document Title"}
  }'
```

### Option 3: Programmatically

```python
import requests

response = requests.post(
    "http://localhost:8000/api/ingest",
    json={
        "text": "Your dental guideline text...",
        "metadata": {"title": "Document Title"}
    }
)
```

## 🎯 Features

- **RAG-based Query System:** Ask questions and get answers based on ingested dental guidelines
- **Source Citations:** Every answer includes sources with relevance scores
- **Patient History:** Track queries per patient (optional patient ID)
- **Recent Queries:** View recent queries across all patients
- **UpToDate-style UI:** Clean, clinical interface inspired by UpToDate Expert AI
- **Example Questions:** Quick-start with pre-filled example questions

## 📁 Project Structure

```
DentalGPT/
├── backend/
│   ├── main.py              # FastAPI application
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main React component
│   │   ├── App.css          # Styles
│   │   ├── main.jsx         # React entry point
│   │   └── index.css        # Global styles
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── scripts/
│   ├── ingest_documents.py  # Document ingestion script
│   └── setup_database.sql   # Database schema
├── .env.example             # Environment variables template
├── .gitignore
└── README.md
```

## 🔌 API Endpoints

### `POST /api/query`
Query the dental assistant.

**Request:**
```json
{
  "query": "What is the recommended treatment for acute pulpitis?",
  "patient_id": "optional_patient_id"
}
```

**Response:**
```json
{
  "answer": "The recommended treatment...",
  "sources": [
    {
      "text": "Source text...",
      "score": 0.95,
      "metadata": {...}
    }
  ],
  "query_id": 123
}
```

### `POST /api/ingest`
Ingest a document into Pinecone.

**Request:**
```json
{
  "text": "Document text...",
  "metadata": {"title": "Document Title"}
}
```

### `GET /api/patient-history/{patient_id}`
Get query history for a patient.

### `GET /api/recent-queries?limit=10`
Get recent queries across all patients.

## 🚢 Deployment to Vercel

### Frontend Deployment

1. **Build the frontend:**
   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy to Vercel:**
   ```bash
   npm install -g vercel
   vercel
   ```

3. **Set environment variable in Vercel:**
   - Go to Vercel dashboard → Your project → Settings → Environment Variables
   - Add `VITE_API_URL` with your backend API URL

### Backend Deployment

For production, deploy the FastAPI backend to:
- **AWS Lambda** (using Mangum or similar)
- **AWS EC2**
- **Google Cloud Run**
- **Heroku**
- **Railway**

Update the `VITE_API_URL` in Vercel to point to your deployed backend.

## 🔒 Security Notes

- Never commit `.env` files
- Use AWS Secrets Manager or similar for production API keys
- Implement authentication for production use
- Add rate limiting to API endpoints
- Use HTTPS in production

## 📝 License

This project is for educational/demonstration purposes.

## 🤝 Contributing

This is a side project MVP. Feel free to fork and modify for your needs!

## 📞 Support

For issues or questions, please open an issue on GitHub.

---

**Disclaimer:** This tool is for clinical reference only and should not replace professional clinical judgment. See the footer disclaimer in the application for full details.

## 🔄 Model Information

This project uses **Zhipu AI GLM-4.5** for text generation and **Zhipu AI embedding-2** for vector embeddings. 

- **LLM Model:** GLM-4.5 (355B parameters, 32B active per token)
- **Embedding Model:** embedding-2 (1024 dimensions)
- **Vector Database:** Pinecone (1024 dimensions to match embedding-2)

If you need to use a different model, update the model names in `backend/main.py` and adjust the embedding dimensions accordingly.
