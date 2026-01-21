# Fix Google OAuth Redirect URI Error

## Error: `redirect_uri_mismatch`

This error means the redirect URI in your Google Cloud Console doesn't match what your app is sending.

## Solution: Update Google Cloud Console

### Step 1: Go to Google Cloud Console

1. Visit: https://console.cloud.google.com/
2. Select your project
3. Go to **"APIs & Services"** → **"Credentials"**
4. Click on your OAuth 2.0 Client ID

### Step 2: Add Authorized Redirect URIs

In the **"Authorized redirect URIs"** section, add:

**For Development:**
```
http://localhost:5173
http://localhost:3000
http://localhost:5173/
http://localhost:3000/
```

**For Production (when you deploy):**
```
https://yourdomain.com
https://yourdomain.com/
```

### Step 3: Add Authorized JavaScript Origins

In the **"Authorized JavaScript origins"** section, add:

**For Development:**
```
http://localhost:5173
http://localhost:3000
```

**For Production:**
```
https://yourdomain.com
```

### Step 4: Save Changes

Click **"Save"** at the bottom of the page.

### Step 5: Wait a Few Minutes

Google's changes can take 1-5 minutes to propagate. Wait a bit, then try again.

---

## Quick Checklist

- [ ] Added `http://localhost:5173` to Authorized redirect URIs
- [ ] Added `http://localhost:5173` to Authorized JavaScript origins
- [ ] Saved changes in Google Cloud Console
- [ ] Waited 2-3 minutes for changes to propagate
- [ ] Tried signing in again

---

## Common Issues

### Issue: Still getting redirect_uri_mismatch after adding URIs

**Solutions:**
1. Make sure there are NO trailing slashes (or add both with and without)
2. Make sure you're using `http://` not `https://` for localhost
3. Check for typos in the URI
4. Wait longer (up to 5 minutes)
5. Clear browser cache and try again

### Issue: Different port number

If your frontend runs on a different port (like 3000, 5174, etc.):
- Add that exact port to both Authorized redirect URIs and JavaScript origins
- Example: `http://localhost:3000`

### Issue: Production deployment

When deploying to production:
1. Add your production URL to Google Console
2. Update `VITE_API_URL` in your production environment
3. Make sure you're using `https://` for production URLs

---

## Verify Your Settings

Your Google Console should have:

**Authorized JavaScript origins:**
```
http://localhost:5173
http://localhost:3000
```

**Authorized redirect URIs:**
```
http://localhost:5173
http://localhost:3000
http://localhost:5173/
http://localhost:3000/
```

**Note:** Some setups require both with and without trailing slashes.

---

## Test After Fixing

1. Save changes in Google Console
2. Wait 2-3 minutes
3. Hard refresh browser (Cmd+Shift+R)
4. Try signing in again
5. Should work now!

---

If you still get errors after following these steps, check:
- Browser console for any other error messages
- Network tab to see what redirect URI is being sent
- Google Console to verify URIs are saved correctly
