# Debugging 500 Internal Server Error

## Check Backend Terminal

The backend should be printing the actual error. Look at your backend terminal where you ran `python3 main.py` and you should see:

```
ERROR in add_chat_message: [actual error message]
Full traceback:
[stack trace]
```

## Common Causes

### 1. Ollama Not Running
**Check:**
```bash
curl http://localhost:11434/api/tags
```

**Fix:**
```bash
ollama serve
```

### 2. Pinecone Connection Issue
**Check:** Look for "Pinecone" errors in backend logs

**Fix:** Verify PINECONE_API_KEY in .env file

### 3. Database Connection Issue
**Check:** Look for "psycopg2" or "database" errors

**Fix:** 
- Check PostgreSQL is running: `brew services list | grep postgresql`
- Verify database credentials in .env

### 4. Chat ID Type Mismatch
**Check:** Backend expects `chat_id` as integer, frontend might be sending string

**Fix:** Already handled in code, but verify

## Quick Test

Test the endpoint directly:
```bash
curl -X POST http://localhost:8000/api/chats/1/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "patient_id": null}'
```

## Next Steps

1. **Check backend terminal** for the actual error message
2. **Share the error** from backend terminal
3. **Check if Ollama is running**: `ollama list`
4. **Check if Pinecone is accessible**: Look for errors in backend

The backend should print the full error with stack trace. That will tell us exactly what's wrong.
