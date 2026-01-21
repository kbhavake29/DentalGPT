# Google OAuth Setup Guide

## Step-by-Step Instructions to Get Google Client ID

### Step 1: Go to Google Cloud Console

1. Visit: https://console.cloud.google.com/
2. Sign in with your Google account

### Step 2: Create a New Project (or Select Existing)

1. Click on the project dropdown at the top
2. Click **"New Project"**
3. Enter project name: `DentalGPT` (or any name you prefer)
4. Click **"Create"**
5. Wait for project creation, then select it

### Step 3: Enable Google+ API

1. In the left sidebar, go to **"APIs & Services"** → **"Library"**
2. Search for **"Google+ API"** or **"People API"**
3. Click on it and click **"Enable"**

### Step 4: Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Select **"External"** (unless you have Google Workspace)
3. Click **"Create"**
4. Fill in the required information:
   - **App name:** DentalGPT
   - **User support email:** Your email
   - **Developer contact information:** Your email
5. Click **"Save and Continue"**
6. On **Scopes** page, click **"Save and Continue"** (no need to add scopes)
7. On **Test users** page, click **"Save and Continue"** (optional for testing)
8. Review and click **"Back to Dashboard"**

### Step 5: Create OAuth 2.0 Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"OAuth client ID"**
4. If prompted, select **"Web application"** as application type
5. Fill in the form:
   - **Name:** DentalGPT Web Client
   - **Authorized JavaScript origins:**
     - `http://localhost:5173` (for development)
     - `http://localhost:3000` (if using port 3000)
     - Your production URL (when deploying)
   - **Authorized redirect URIs:**
     - `http://localhost:5173` (for development)
     - `http://localhost:3000` (if using port 3000)
     - Your production URL (when deploying)
6. Click **"Create"**

### Step 6: Copy Your Credentials

After creating, you'll see a popup with:
- **Your Client ID** (looks like: `123456789-abcdefghijklmnop.apps.googleusercontent.com`)
- **Your Client Secret** (looks like: `GOCSPX-abcdefghijklmnop`)

**IMPORTANT:** Copy both of these!

---

## Step 7: Add to Environment Variables

### Backend `.env` file (in project root):

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
JWT_SECRET=your-random-secret-key-here-change-this

# Existing variables...
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_LLM_MODEL=llama3.2:3b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX_NAME=dental-gpt
RDS_HOST=localhost
RDS_PORT=5432
RDS_DATABASE=dentalgpt
RDS_USER=postgres
RDS_PASSWORD=your_password
```

### Frontend `.env` file (in `frontend/` directory):

**Create this file if it doesn't exist:**

```bash
cd frontend
touch .env
```

**Add this content:**

```env
VITE_GOOGLE_CLIENT_ID=your_client_id_here
VITE_API_URL=http://localhost:8000
```

**Note:** 
- Frontend only needs the **Client ID** (not the secret)
- The `VITE_` prefix is required for Vite to expose it to the frontend
- Client Secret should NEVER be in frontend code (it's only in backend)

---

## Step 8: Verify Setup

### Check Backend `.env`:
```bash
cd "/Users/komalbhavake/Desktop/github projects/DentalGPT"
cat .env | grep GOOGLE
```

Should show:
```
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
JWT_SECRET=your_secret
```

### Check Frontend `.env`:
```bash
cd "/Users/komalbhavake/Desktop/github projects/DentalGPT/frontend"
cat .env
```

Should show:
```
VITE_GOOGLE_CLIENT_ID=your_client_id
VITE_API_URL=http://localhost:8000
```

---

## Step 9: Restart Your Servers

After updating `.env` files:

1. **Restart Backend:**
   ```bash
   cd backend
   source venv/bin/activate
   python3 main.py
   ```

2. **Restart Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

---

## Troubleshooting

### Issue: "Invalid client" error
- **Solution:** Make sure Client ID matches exactly in both `.env` files
- Check for extra spaces around the ID

### Issue: "Redirect URI mismatch"
- **Solution:** 
  - Go back to Google Cloud Console
  - Check that your redirect URI in OAuth settings matches exactly:
    - `http://localhost:5173` (not `https://` or trailing slash)
  - Wait a few minutes for changes to propagate

### Issue: "OAuth consent screen" error
- **Solution:** 
  - Make sure you completed the OAuth consent screen setup
  - If testing, add your email as a test user

### Issue: Frontend can't access VITE_GOOGLE_CLIENT_ID
- **Solution:**
  - Make sure file is named `.env` (not `.env.local` or `.env.production`)
  - Make sure variable starts with `VITE_`
  - Restart the dev server after creating/updating `.env`

---

## Security Notes

1. **Never commit `.env` files to Git** (they should be in `.gitignore`)
2. **Client Secret** should only be in backend `.env`
3. **Client ID** can be in frontend (it's public)
4. **JWT Secret** should be a strong, random string
5. **In production:** Use environment variables from your hosting platform

---

## Quick Checklist

- [ ] Created Google Cloud Project
- [ ] Enabled Google+ API
- [ ] Configured OAuth consent screen
- [ ] Created OAuth 2.0 credentials
- [ ] Added Client ID and Secret to backend `.env`
- [ ] Added Client ID to frontend `.env`
- [ ] Added JWT_SECRET to backend `.env`
- [ ] Restarted both servers
- [ ] Tested authentication flow

---

## Example `.env` Files

### Backend `.env` (project root):
```env
# Google OAuth
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnop
JWT_SECRET=my-super-secret-jwt-key-change-this-in-production

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_LLM_MODEL=llama3.2:3b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Pinecone
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=dental-gpt

# PostgreSQL
RDS_HOST=localhost
RDS_PORT=5432
RDS_DATABASE=dentalgpt
RDS_USER=postgres
RDS_PASSWORD=your_password
```

### Frontend `.env` (`frontend/.env`):
```env
VITE_GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
VITE_API_URL=http://localhost:8000
```

---

**Once you've completed these steps, your Google OAuth should work!**

If you encounter any issues, check the browser console and backend logs for error messages.
