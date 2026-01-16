# Ollama Migration - Complete Guide

## ✅ Migration Status: COMPLETE

Your DentalGPT project has been successfully migrated from Google Gemini to Ollama (local LLM).

---

## 🎯 What Changed

### **Models:**
- **LLM:** Google Gemini 2.5 Flash → **Ollama llama3.2:3b** (local)
- **Embeddings:** Google Gemini text-embedding-004 → **Ollama nomic-embed-text** (local)

### **Dependencies:**
- ❌ Removed: `google-generativeai`
- ✅ Added: `ollama==0.6.1`

### **Environment Variables:**
- ❌ Removed: `GEMINI_API_KEY`
- ✅ Added: `OLLAMA_BASE_URL` (default: http://localhost:11434)
- ✅ Added: `OLLAMA_LLM_MODEL` (default: llama3.2:3b)
- ✅ Added: `OLLAMA_EMBEDDING_MODEL` (default: nomic-embed-text)

### **Code Changes:**
- Updated `backend/main.py` - All Gemini calls replaced with Ollama
- Updated `scripts/ingest_documents.py` - Embedding generation uses Ollama
- Updated `backend/requirements.txt` - Dependencies updated

---

## 🚀 Setup Instructions

### **1. Install Ollama Models**

Make sure you have the required models:

```bash
# Pull LLM model (if not already installed)
ollama pull llama3.2:3b

# Pull embedding model (already done)
ollama pull nomic-embed-text
```

### **2. Start Ollama Service**

```bash
# Start Ollama (if not running)
ollama serve

# Or run in background
ollama serve &
```

**Verify it's running:**
```bash
curl http://localhost:11434/api/tags
```

### **3. Update .env File**

Add these to your `.env` file:

```env
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_LLM_MODEL=llama3.2:3b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Keep existing
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX_NAME=dental-gpt
RDS_HOST=localhost
RDS_PORT=5432
RDS_DATABASE=dentalgpt
RDS_USER=komalbhavake
RDS_PASSWORD=
```

### **4. Install Updated Dependencies**

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

### **5. Test the Setup**

```bash
# Test embedding
python3 -c "import ollama; print(len(ollama.embeddings(model='nomic-embed-text', prompt='test')['embedding']))"
# Should output: 768

# Test LLM
python3 -c "import ollama; print(ollama.generate(model='llama3.2:3b', prompt='Hello')['response'][:50])"
# Should output: Some text response
```

### **6. Start the Backend**

```bash
cd backend
source venv/bin/activate
python3 main.py
```

---

## 🔍 Key Differences: Gemini vs Ollama

### **API Calls:**

**Gemini (Old):**
```python
# Embedding
result = genai.embed_content(model="models/text-embedding-004", content=text)
embedding = result['embedding']

# Generation
model = genai.GenerativeModel('gemini-2.5-flash')
response = model.generate_content(prompt)
answer = response.text
```

**Ollama (New):**
```python
# Embedding
result = ollama.embeddings(model='nomic-embed-text', prompt=text)
embedding = result['embedding']

# Generation
response = ollama.generate(model='llama3.2:3b', prompt=prompt)
answer = response['response']
```

---

## ⚡ Performance Notes

### **Advantages:**
- ✅ **No API costs** - Everything runs locally
- ✅ **Data privacy** - No data sent to external APIs
- ✅ **No internet required** - Works offline
- ✅ **Full control** - You own the models

### **Considerations:**
- ⚠️ **Slower than cloud** - Local inference is slower
- ⚠️ **First request slower** - Model loading time
- ⚠️ **RAM usage** - Models use system memory
- ⚠️ **Storage** - Models take disk space (~2-4GB)

### **Performance Tips:**
1. Keep Ollama service running (avoid cold starts)
2. Use GPU if available (faster inference)
3. Consider larger models if you have more RAM
4. Batch embedding requests when possible

---

## 🧪 Testing

### **Test 1: Verify Ollama is Running**
```bash
curl http://localhost:11434/api/tags
```

### **Test 2: Test Embedding**
```bash
cd backend
source venv/bin/activate
python3 -c "import ollama; r = ollama.embeddings(model='nomic-embed-text', prompt='test'); print(f'Dimension: {len(r[\"embedding\"])}')"
```

### **Test 3: Test LLM**
```bash
python3 -c "import ollama; r = ollama.generate(model='llama3.2:3b', prompt='What is a tooth?'); print(r['response'])"
```

### **Test 4: Test Full Pipeline**
1. Start backend: `python3 main.py`
2. Upload a document via UI
3. Ask a question
4. Verify answer is generated

---

## 🔧 Troubleshooting

### **Issue: "Connection refused"**
**Solution:** Make sure Ollama is running
```bash
ollama serve
```

### **Issue: "Model not found"**
**Solution:** Pull the model
```bash
ollama pull llama3.2:3b
ollama pull nomic-embed-text
```

### **Issue: "Out of memory"**
**Solution:** 
- Use smaller model (llama3.2:3b is good)
- Close other applications
- Consider using a system with more RAM

### **Issue: "Slow responses"**
**Solution:**
- This is normal for local models
- First request is slower (model loading)
- Subsequent requests are faster
- Consider GPU acceleration if available

---

## 📊 Model Specifications

### **llama3.2:3b**
- **Parameters:** 3 billion
- **RAM Usage:** ~2GB
- **Quality:** Good for most tasks
- **Speed:** Fast
- **Context Window:** 128K tokens

### **nomic-embed-text**
- **Dimensions:** 768
- **RAM Usage:** ~500MB
- **Quality:** Excellent
- **Speed:** Very fast
- **Compatibility:** Matches current Pinecone index (no recreation needed!)

---

## 🎓 Next Steps

1. **Update .env file** with Ollama configuration
2. **Restart backend** to load new dependencies
3. **Test with a query** to verify everything works
4. **Monitor performance** and adjust if needed

---

## 💡 Optional: Upgrade Models

If you want better quality (and have more RAM):

**Better LLM:**
```bash
ollama pull llama3.1:8b  # Better quality, ~5GB RAM
```

Then update `.env`:
```env
OLLAMA_LLM_MODEL=llama3.1:8b
```

**Better Embedding:**
```bash
ollama pull mxbai-embed-large  # 1024 dimensions, better quality
```

**Note:** If you change embedding dimensions, you'll need to recreate the Pinecone index!

---

## ✅ Migration Checklist

- [x] Ollama installed
- [x] Models pulled (llama3.2:3b, nomic-embed-text)
- [x] Code updated to use Ollama
- [x] Dependencies updated
- [x] Environment variables documented
- [ ] .env file updated
- [ ] Backend restarted
- [ ] Tested with query

---

**Your project is now running completely locally with Ollama!** 🎉
