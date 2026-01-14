# Migration from Gemini to GLM-4.5

## Changes Made

The project has been updated to use **Zhipu AI GLM-4.5** instead of Google Gemini.

### Key Changes:

1. **Backend (`backend/main.py`):**
   - Replaced `google.generativeai` with `zhipuai`
   - Changed LLM model from `gemini-1.5-flash` to `glm-4` (GLM-4.5)
   - Changed embedding model from `text-embedding-004` to `embedding-2`
   - Updated embedding dimensions from 768 to 1024

2. **Dependencies (`backend/requirements.txt`):**
   - Replaced `google-generativeai` with `zhipuai==2.0.0`

3. **Ingestion Script (`scripts/ingest_documents.py`):**
   - Updated to use Zhipu AI for embeddings
   - Changed dimension from 768 to 1024

4. **Environment Variables:**
   - Changed `GEMINI_API_KEY` to `ZHIPUAI_API_KEY`

### Important Notes:

1. **API Format:** The Zhipu AI API format may vary. If you encounter errors, check:
   - The actual response structure from Zhipu AI API
   - Model name format (might be `glm-4`, `GLM-4`, or `glm-4.5`)
   - Embedding model name (might be `embedding-2` or different)

2. **Pinecone Index:** 
   - **IMPORTANT:** If you already created a Pinecone index with 768 dimensions, you'll need to:
     - Delete the old index, OR
     - Create a new index with 1024 dimensions
   - The code will automatically create a 1024-dimension index if it doesn't exist

3. **Testing:**
   - Verify your Zhipu AI API key works
   - Test embedding generation
   - Test GLM-4.5 text generation
   - Check response format matches expected structure

### Getting Zhipu AI API Key:

1. Visit: https://open.bigmodel.cn/
2. Sign up for an account
3. Navigate to API Keys section
4. Create a new API key
5. Add it to your `.env` file as `ZHIPUAI_API_KEY`

### Model Information:

- **GLM-4.5:** 355B parameters, 32B active per token, 128K context window
- **embedding-2:** 1024-dimensional embeddings
- Supports both "thinking mode" and "non-thinking mode" for complex reasoning

### Troubleshooting:

If you get API errors:
1. Check the Zhipu AI Python SDK documentation
2. Verify the model names are correct
3. Check API response format - the code includes flexible response handling
4. Ensure your API key has access to GLM-4.5 and embedding-2 models
