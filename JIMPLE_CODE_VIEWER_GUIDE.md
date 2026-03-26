# Jimple Code Viewer — Backend Implementation Guide

## Overview
The new **Jimple Code** tab in the Jimple Analyzer allows users to view and browse the actual Jimple source code for any analyzed class with syntax highlighting and hover tooltips.

For this feature to work, you need to implement a new backend endpoint to read `.jimple` files from the filesystem.

---

## Required Backend Endpoint

### Endpoint: `POST /security/jimple/read-file`

**Request:**
```json
{
  "folderPath": "/path/to/jimple/output",
  "className": "com.example.MainActivity"
}
```

**Response (200 OK):**
```json
{
  "content": "public class com.example.MainActivity extends android.app.Activity {\n  ...(full Jimple code content)...\n}"
}
```

**Error Response (400/500):**
```json
{
  "error": "File not found"
}
```

---

## Implementation

The endpoint should:

1. **Receive** `folderPath` (string) and `className` (string) from request body
2. **Resolve** the full file path:
   - Convert className from dot notation to path notation: `com.example.MainActivity` → `com/example/MainActivity`
   - Look for the file at: `{folderPath}/{className_path}.jimple`
   - Example: `/home/user/jimple_output/com/example/MainActivity.jimple`
3. **Read** the entire file as text (UTF-8)
4. **Return** the raw content in the response JSON under the `content` field
5. **Handle errors** gracefully — if file doesn't exist or can't be read, return a 400/500 error

---

## Example Implementation (Node.js/Express)

```javascript
const path = require('path')
const fs = require('fs').promises

app.post('/security/jimple/read-file', async (req, res) => {
  try {
    const { folderPath, className } = req.body

    if (!folderPath || !className) {
      return res.status(400).json({ error: 'Missing folderPath or className' })
    }

    // Convert dot notation to path: com.example.MainActivity → com/example/MainActivity
    const classPath = className.replace(/\./g, '/')
    const filePath = path.join(folderPath, `${classPath}.jimple`)

    // Security: ensure the resolved path is within folderPath
    const resolvedPath = path.resolve(filePath)
    const resolvedFolder = path.resolve(folderPath)
    if (!resolvedPath.startsWith(resolvedFolder)) {
      return res.status(400).json({ error: 'Invalid path' })
    }

    // Read the file
    const content = await fs.readFile(filePath, 'utf-8')
    res.json({ content })
  } catch (error) {
    console.error('Error reading Jimple file:', error)
    res.status(500).json({ error: error.message || 'Failed to read file' })
  }
})
```

---

## Example Implementation (Python/Flask)

```python
import os
import json
from pathlib import Path

@app.route('/security/jimple/read-file', methods=['POST'])
def read_jimple_file():
    try:
        data = request.json
        folder_path = data.get('folderPath')
        class_name = data.get('className')

        if not folder_path or not class_name:
            return {'error': 'Missing folderPath or className'}, 400

        # Convert dot notation to path
        class_path = class_name.replace('.', '/')
        file_path = os.path.join(folder_path, f'{class_path}.jimple')

        # Security: ensure path is within folder
        resolved_path = os.path.abspath(file_path)
        resolved_folder = os.path.abspath(folder_path)
        if not resolved_path.startswith(resolved_folder):
            return {'error': 'Invalid path'}, 400

        # Read the file
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        return {'content': content}, 200
    except FileNotFoundError:
        return {'error': 'File not found'}, 400
    except Exception as e:
        return {'error': str(e)}, 500
```

---

## Frontend Behavior

Once the endpoint is implemented:

1. User navigates to **Jimple Code** tab
2. Class selector sidebar populates with all analyzed classes
3. User clicks a class or filters by name/package
4. Frontend calls `POST /security/jimple/read-file` with `{ folderPath, className }`
5. Code is displayed with:
   - **Line numbers** on the left (gray, non-selectable)
   - **Syntax highlighting** for Jimple constructs:
     - Purple: `staticinvoke`, `specialinvoke`, `virtualinvoke`, `interfaceinvoke`
     - Blue: `if`, `goto`, `return`, `throw`, `nop`, `new`, `instanceof`, `cast`, etc.
     - Green: `<ClassName: methodSignature>` format references
     - Orange: local variable names (`r0`, `l1`, `$stack2`, etc.)
     - Cyan: primitive types (`void`, `int`, `boolean`, etc.)
     - Amber: string literals (`"..."`)
     - Gray: comments (`//...`)
   - **Hover tooltips** on keywords explaining what they mean

If the endpoint is missing or fails, a helpful error message is shown in the code viewer.

---

## Security Considerations

- **Path traversal**: Validate that the resolved file path is within the requested `folderPath`
- **File permissions**: Ensure the backend process has read access to the Jimple folder
- **Large files**: Consider setting a reasonable file size limit (e.g., 10MB) to prevent loading huge files
- **Caching**: Consider caching read files in memory for repeated requests (optional)

---

## Testing

After implementing the endpoint:

1. Run Jimple analysis on an APK (use Soot Compiler tab)
2. Note the output folder path
3. Switch to **Jimple Analyzer** → **Jimple Code** tab
4. Click any class in the left sidebar
5. Verify code appears with syntax highlighting
6. Hover over keywords like `staticinvoke` to see tooltips

If the endpoint is not implemented, you'll see an error message with these instructions.
