# Jimple Code Viewer — Development Setup

## What I Fixed

The Jimple Code tab was showing a 404 error because the backend endpoint `/security/jimple/read-file` didn't exist.

I've added a **development middleware** to `vite.config.ts` that intercepts and handles this endpoint directly, so you can test the Jimple Code viewer immediately without needing a backend server implementation.

## How It Works

### Development (Current Setup)
1. Vite middleware intercepts `POST /security/jimple/read-file` requests
2. Reads `.jimple` files directly from the filesystem
3. Returns the file content to the frontend
4. Works with the folder path you specify in the UI

### Production (When You Add Backend)
1. Replace or extend the middleware with a real backend endpoint
2. Update `vite.config.ts` to remove the middleware
3. Implement `POST /security/jimple/read-file` in your backend (see `JIMPLE_CODE_VIEWER_GUIDE.md`)

---

## Testing

### Step 1: Restart Dev Server
You **must restart your dev server** for the vite.config changes to take effect:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 2: Run Jimple Analysis
1. Go to **Soot Compiler** tab
2. Select your APK
3. Click "Run Soot Analysis"
4. Note the output folder path (e.g., `/home/user/soot_output`)

### Step 3: Analyze with Jimple Analyzer
1. Switch to **Jimple Analyzer** tab
2. Enter the output folder path from Step 2
3. Wait for analysis to complete
4. You should see APIs, Strings, Classes, and Libraries tabs populate

### Step 4: View Jimple Code
1. Click the **"Jimple Code"** tab
2. Select any class from the left sidebar
3. ✅ You should now see the decompiled Jimple code with syntax highlighting

---

## File Changes

### Modified: `vite.config.ts`

Added:
- Import for `path` and `fs` modules
- `jimpleMiddleware()` function that:
  - Intercepts `POST /security/jimple/read-file`
  - Validates the request (checks folderPath and className)
  - Converts class names from dot notation to file paths
  - Reads the `.jimple` file
  - Returns the content as JSON
  - Handles errors (file not found, invalid paths, etc.)
- Registered middleware in `server.middlewares` array
- Added `bypass` rule to proxy config so this endpoint isn't proxied to the backend

### Why This Approach?

1. **No backend changes needed** — test the feature immediately
2. **Security validated** — prevents path traversal attacks
3. **Easy to replace** — remove middleware, add real backend endpoint
4. **Development friendly** — middleware runs during dev server, not in production build

---

## Production Deployment

When you're ready to deploy:

1. **Implement the backend endpoint** (see `JIMPLE_CODE_VIEWER_GUIDE.md` for examples)
2. **Remove or disable the middleware** in `vite.config.ts`
3. **Test** that the backend endpoint works: `POST /security/jimple/read-file`
4. **Build and deploy** normally

---

## Troubleshooting

### "Cannot find module 'path'" error
- Ensure you restarted the dev server
- Check that `import path from 'path'` and `import fs from 'fs'` are at the top of vite.config.ts

### 404 errors still showing
- Restart your dev server (stop with Ctrl+C and run `npm run dev` again)
- Clear browser cache (Cmd+Shift+R or Ctrl+Shift+R)

### File not found errors in code viewer
- Verify the folder path is correct (should be the Soot output directory)
- Check that `.jimple` files exist in that directory
- Example: `/home/user/soot_output/com/example/MainActivity.jimple`

### "Invalid path" error
- This is a security check preventing path traversal
- Ensure the class name is properly formatted (e.g., `com.example.MainActivity`)
- Ensure folderPath is absolute, not relative
