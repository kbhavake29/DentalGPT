# DentalGPT Setup Guide

## Required API Keys

You'll need the following API keys to run DentalGPT:

### 1. Zhipu AI API Key (for GLM-4.5)
- Visit: https://open.bigmodel.cn/
- Sign up for an account
- Navigate to API Keys section
- Create a new API key
- Copy the API key

### 2. Pinecone API Key
- Visit: https://www.pinecone.io/
- Sign up for a free account
- Go to API Keys section
- Copy your API key

## Quick Setup Steps

### Step 1: Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
ZHIPUAI_API_KEY=your_actual_zhipuai_key_here
PINECONE_API_KEY=your_actual_pinecone_key_here
PINECONE_INDEX_NAME=dental-gpt
RDS_HOST=localhost
RDS_PORT=5432
RDS_DATABASE=dentalgpt
RDS_USER=postgres
RDS_PASSWORD=your_postgres_password
```

### Step 2: Install PostgreSQL

**macOS:**
```bash
brew install postgresql
brew services start postgresql
createdb dentalgpt
```

**Linux:**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres createdb dentalgpt
```

**Windows:**
- Download from https://www.postgresql.org/download/windows/
- Install and create database using pgAdmin

### Step 3: Setup Database Schema

```bash
psql -d dentalgpt -f scripts/setup_database.sql
```

### Step 4: Setup Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Step 5: Setup Frontend

```bash
cd frontend
npm install
```

### Step 6: Ingest Sample Data (Optional)

```bash
cd scripts
python ingest_documents.py --file sample_dental_guidelines.txt --title "Sample Dental Guidelines"
```

### Step 7: Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
python main.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Visit: http://localhost:3000

## Troubleshooting

### Backend won't start
- Check that all environment variables are set in `.env`
- Verify PostgreSQL is running: `pg_isready`
- Check API keys are valid

### Frontend can't connect to backend
- Ensure backend is running on port 8000
- Check CORS settings in `backend/main.py`
- Verify `VITE_API_URL` in frontend `.env` (if using custom URL)

### Pinecone index errors
- The index will be created automatically on first run
- Ensure your Pinecone API key has permission to create indexes
- Check that index name doesn't conflict with existing indexes

### Database connection errors
- Verify PostgreSQL is running
- Check database credentials in `.env`
- Ensure database `dentalgpt` exists

## Next Steps

1. Ingest your own dental guidelines documents
2. Customize the UI colors/branding
3. Add authentication for production
4. Deploy to Vercel (frontend) and AWS (backend)
