# Debugging Authentication Issues

## If you see a blank page after clicking "Get Started":

### Step 1: Check Browser Console
1. Open browser DevTools (F12 or Cmd+Option+I)
2. Go to Console tab
3. Look for any red error messages
4. Common errors:
   - "VITE_GOOGLE_CLIENT_ID is not defined"
   - "Failed to load Google Sign-In script"
   - CORS errors

### Step 2: Verify Environment Variables

**Check frontend/.env:**
```bash
cd frontend
cat .env
```

Should show:
```
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
VITE_API_URL=http://localhost:8000
```

**If missing or wrong:**
1. Edit `frontend/.env`
2. Add the Client ID from your backend `.env`
3. Restart the frontend dev server

### Step 3: Restart Frontend Server

After updating `.env`, you MUST restart:
```bash
# Stop the current server (Ctrl+C)
# Then restart:
cd frontend
npm run dev
```

### Step 4: Check Network Tab

1. Open DevTools → Network tab
2. Refresh the page
3. Look for:
   - `https://accounts.google.com/gsi/client` - Should load successfully
   - Any 404 or CORS errors

### Step 5: Verify Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Check OAuth consent screen is configured
3. Check authorized redirect URIs include:
   - `http://localhost:5173`
   - `http://localhost:3000` (if using port 3000)

### Step 6: Test Direct Access

Try accessing the auth page directly:
```
http://localhost:5173
```

Then manually navigate to auth by checking the console for `currentView` state.

### Step 7: Check Component Rendering

Add this to see what's rendering:
```javascript
// In App.jsx, add console.log:
console.log('Current view:', currentView)
console.log('Google Client ID:', import.meta.env.VITE_GOOGLE_CLIENT_ID)
```

---

## Quick Fixes

### Fix 1: Clear Browser Cache
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Or clear browser cache completely

### Fix 2: Check Vite is Reading .env
```bash
# In frontend directory
npm run dev
# Look for: "VITE_GOOGLE_CLIENT_ID" in the output
```

### Fix 3: Verify File Structure
```
frontend/
  ├── .env          ← Should exist here
  ├── src/
  │   ├── App.jsx
  │   ├── Auth.jsx
  │   └── LandingPage.jsx
```

---

## Common Issues

### Issue: "VITE_GOOGLE_CLIENT_ID is undefined"
**Solution:** 
- Make sure variable starts with `VITE_`
- Restart dev server after creating/editing `.env`
- Check file is named exactly `.env` (not `.env.local`)

### Issue: "Failed to load Google script"
**Solution:**
- Check internet connection
- Check browser console for CORS errors
- Try different browser
- Check if ad blocker is blocking Google scripts

### Issue: "Blank page"
**Solution:**
- Check browser console for JavaScript errors
- Verify all components are imported correctly
- Check if React is rendering (look for root div in Elements tab)

---

## Still Not Working?

1. **Check backend is running:**
   ```bash
   curl http://localhost:8000/health
   ```

2. **Check frontend is running:**
   ```bash
   curl http://localhost:5173
   ```

3. **Check for port conflicts:**
   - Make sure port 5173 is not used by another app
   - Try changing port in `vite.config.js`

4. **Check React DevTools:**
   - Install React DevTools browser extension
   - Check component tree to see what's rendering

---

## Expected Flow

1. **Landing Page** → Click "Get Started"
2. **Auth Page** → Shows "Sign in with Google" button
3. **Click Google Button** → Google popup appears
4. **Select Account** → Redirects back
5. **Chat Page** → Shows chat interface

If any step fails, check the console for errors at that step.
