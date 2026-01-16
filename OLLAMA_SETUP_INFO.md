# Ollama Migration - Setup Information

## ✅ Current Status

- **Ollama:** ✓ Installed
- **System RAM:** 8 GB
- **Available LLM Models:**
  - `llama2:latest` (7B, ~3.8GB)
  - `llama3.2:3b` (3B, ~2GB)

## 🎯 Recommended Configuration for Your System (8GB RAM)

### **Option 1: Balanced (Recommended)**
- **LLM Model:** `llama3.2:3b` (already installed)
  - Fast, good quality
  - Uses ~2GB RAM
  - Good for your 8GB system
  
- **Embedding Model:** `nomic-embed-text` (needs to be pulled)
  - 768 dimensions (matches current Pinecone index - no recreation needed!)
  - Excellent quality
  - Fast embeddings

**Command to pull embedding model:**
```bash
ollama pull nomic-embed-text
```

### **Option 2: Better Quality (if you want)**
- **LLM Model:** `llama2:latest` (already installed)
  - Better quality than llama3.2:3b
  - Uses ~4GB RAM
  - Still works with 8GB system
  
- **Embedding Model:** `nomic-embed-text` (same as above)

**Note:** With 8GB RAM, using llama2:latest might be tight if you have other apps running.

---

## 📋 Information I Need From You

Please confirm your choices:

### **1. LLM Model (for text generation):**
- [ ] `llama3.2:3b` (Recommended - faster, less RAM)
- [ ] `llama2:latest` (Better quality, more RAM)

**Your choice:** _________________

### **2. Embedding Model (for vector embeddings):**
- [ ] `nomic-embed-text` (Recommended - 768 dims, matches current setup)
- [ ] `all-minilm` (384 dims, smaller, faster - requires Pinecone index recreation)
- [ ] Other: _________________

**Your choice:** _________________

### **3. Ollama Service:**
- **Base URL:** `http://localhost:11434` (default)
- **Custom port?** _________________

---

## 🔄 What Will Happen After You Confirm

1. **Pull embedding model** (if needed)
2. **Update backend code** to use Ollama API
3. **Update dependencies** (remove google-generativeai, add ollama)
4. **Update environment variables**
5. **Test the integration**
6. **Update documentation**

---

## ⚠️ Important Notes

### **Pinecone Index:**
- If you choose `nomic-embed-text` (768 dims): **No changes needed** ✅
- If you choose `all-minilm` (384 dims): **Need to recreate index** ⚠️

### **Performance:**
- Local models are slower than cloud APIs
- First request may be slower (model loading)
- Subsequent requests will be faster

### **Storage:**
- Models are stored locally (~2-4GB per model)
- Make sure you have enough disk space

---

## 🚀 Quick Start (After Migration)

1. **Start Ollama service:**
   ```bash
   ollama serve
   ```

2. **Pull embedding model** (if using nomic-embed-text):
   ```bash
   ollama pull nomic-embed-text
   ```

3. **Update .env file:**
   ```env
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_LLM_MODEL=llama3.2:3b
   OLLAMA_EMBEDDING_MODEL=nomic-embed-text
   ```

4. **Restart backend:**
   ```bash
   cd backend
   source venv/bin/activate
   python3 main.py
   ```

---

## 💡 My Recommendation

Based on your 8GB RAM system:

**Best Choice:**
- **LLM:** `llama3.2:3b` (fast, efficient, good quality)
- **Embedding:** `nomic-embed-text` (matches current setup, excellent quality)

This combination:
- ✅ Works well with 8GB RAM
- ✅ No Pinecone index recreation needed
- ✅ Good quality results
- ✅ Fast performance

---

**Please confirm your choices, and I'll proceed with the migration!**
