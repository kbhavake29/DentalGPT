# Integration Guide - New Features

## Overview

This guide covers the three major features added to DentalGPT:
1. **Authentication System** with Google OAuth
2. **Landing Page** with marketing content
3. **Voice Agent** using Faster-Whisper

---

## 1. Authentication System

### Backend Setup

1. **Update Database Schema:**
   ```bash
   psql -d dentalgpt -f scripts/setup_database.sql
   ```

2. **Environment Variables:**
   Add to your `.env` file:
   ```env
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   JWT_SECRET=your-secret-key-change-in-production
   ```

3. **Get Google OAuth Credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs:
     - `http://localhost:5173` (development)
     - Your production URL

### Frontend Setup

1. **Environment Variables:**
   Create `frontend/.env`:
   ```env
   VITE_GOOGLE_CLIENT_ID=your_google_client_id
   VITE_API_URL=http://localhost:8000
   ```

2. **Install Dependencies:**
   ```bash
   cd frontend
   npm install
   ```

### How It Works

- User clicks "Get Started" on landing page
- Redirected to authentication page
- Signs in with Google
- JWT token stored in localStorage
- All API calls include token in Authorization header
- User-specific chats stored in PostgreSQL

---

## 2. Landing Page

### Features

- **Hero Section:** "Get Started" button, marketing copy
- **Demo Video:** YouTube embed (update with your demo video)
- **Features Section:** 6 key features with icons
- **Benefits Section:** How it helps dentists, students, hygienists
- **Feedback Form:** Collect user feedback
- **Contact Form:** Contact form for inquiries
- **Footer:** Links and legal information

### Customization

1. **Update Demo Video:**
   Edit `frontend/src/LandingPage.jsx`:
   ```jsx
   src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
   ```

2. **Update Marketing Content:**
   Edit the text in `LandingPage.jsx` to match your brand

3. **Add Backend Endpoints:**
   Create endpoints for feedback and contact forms:
   ```python
   @app.post("/api/feedback")
   @app.post("/api/contact")
   ```

---

## 3. Voice Agent (Faster-Whisper)

### Backend Setup

1. **Install Faster-Whisper:**
   ```bash
   cd backend
   source venv/bin/activate
   pip install faster-whisper
   ```

2. **Download Model (first time):**
   The model will be downloaded automatically on first use (~150MB for base model)

### Frontend Setup

1. **Microphone Permissions:**
   - Browser will prompt for microphone access
   - User must grant permission

2. **Voice Recording:**
   - Click microphone icon in chat input
   - Speak your question
   - Click again to stop recording
   - Audio is transcribed automatically
   - Transcribed text appears in input field

### How It Works

1. User clicks microphone button
2. Browser records audio (Web Audio API)
3. Audio converted to WAV format
4. Sent to backend as base64
5. Faster-Whisper transcribes audio
6. Text returned to frontend
7. User can edit or send the transcribed text

### Model Options

Edit `backend/main.py` to change model:
```python
# Options: tiny, base, small, medium, large
model = WhisperModel("base", device="cpu", compute_type="int8")
```

- **tiny:** Fastest, least accurate (~40MB)
- **base:** Good balance (~150MB) - Recommended
- **small:** Better accuracy (~500MB)
- **medium:** High accuracy (~1.5GB)
- **large:** Best accuracy (~3GB)

---

## Database Schema

### New Tables

1. **users:** Stores user authentication data
2. **chats:** Stores chat sessions per user
3. **chat_messages:** Stores individual messages in chats

### Migration

Run the updated `setup_database.sql` to create all tables:
```bash
psql -d dentalgpt -f scripts/setup_database.sql
```

---

## API Endpoints

### Authentication
- `POST /api/auth/google` - Authenticate with Google
- `GET /api/auth/me` - Get current user info

### Chat Management
- `GET /api/chats` - Get all user chats
- `POST /api/chats` - Create new chat
- `GET /api/chats/{chat_id}/messages` - Get chat messages
- `POST /api/chats/{chat_id}/messages` - Add message to chat

### Voice
- `POST /api/voice/transcribe` - Transcribe audio

---

## Testing

### Test Authentication
1. Start backend: `python3 main.py`
2. Start frontend: `npm run dev`
3. Click "Get Started"
4. Sign in with Google
4. Verify chat interface loads

### Test Voice Agent
1. Click microphone icon
2. Grant microphone permission
3. Speak a question
4. Click microphone again to stop
5. Verify text appears in input

### Test Chat Persistence
1. Create a chat and send messages
2. Log out
3. Log back in
4. Verify chats are still there

---

## Troubleshooting

### Google OAuth Not Working
- Check client ID is correct
- Verify redirect URI matches exactly
- Check browser console for errors
- Ensure Google+ API is enabled

### Voice Not Working
- Check microphone permissions in browser
- Verify Faster-Whisper is installed
- Check backend logs for errors
- Try different browser (Chrome recommended)

### Chats Not Persisting
- Verify database connection
- Check user is authenticated
- Verify JWT token is being sent
- Check backend logs for errors

---

## Next Steps

1. **Add Demo Video:** Record and upload your demo video
2. **Customize Landing Page:** Update branding and content
3. **Add Feedback/Contact Backend:** Create endpoints to store submissions
4. **Improve Voice UI:** Add visual feedback during recording
5. **Add Error Handling:** Better error messages for users

---

## Security Notes

- **JWT Secret:** Use a strong, random secret in production
- **HTTPS:** Always use HTTPS in production
- **Token Storage:** Consider httpOnly cookies instead of localStorage
- **Rate Limiting:** Add rate limiting to API endpoints
- **Input Validation:** Validate all user inputs

---

## Production Deployment

1. **Update Environment Variables:**
   - Set production Google OAuth credentials
   - Use strong JWT secret
   - Update database connection strings

2. **Update CORS:**
   ```python
   allow_origins=["https://yourdomain.com"]
   ```

3. **Add HTTPS:**
   - Use reverse proxy (nginx)
   - Or deploy to platform with HTTPS (Vercel, Railway, etc.)

4. **Database:**
   - Use managed PostgreSQL (AWS RDS, Supabase, etc.)
   - Enable backups
   - Set up monitoring

---

**All features are now integrated and ready to use!**
