# Control Flow Graph (CFG) Feature - Backend Implementation Guide

## Overview
The Soot Compiler now includes a CFG visualization feature. This requires backend updates to extract and forward CFG data to the frontend.

## What's Changed

### Frontend (✅ Complete)
- Added CFG tab that appears when CFG data is available
- Added "Load CFG Data" button for manual extraction
- Displays control flow graphs with interactive method selector
- Shows entry (green), exit (red), and regular (gray) nodes

### Java Analyzer (✅ Complete)
- `SootApkAnalyzer.java` now extracts CFGs for all methods
- Outputs CFG data in JSON format with complete graph structure
- CFG data includes nodes, edges, and edge labels for branches

### Backend (❌ Needs Implementation)
Two approaches:

## Approach 1: Forward CFG Data in Initial Analysis (Recommended)

When Soot completes, the backend's `/security/soot/run` endpoint should:

1. **Capture** the Java analyzer's JSON output
2. **Parse** it to extract cfgData
3. **Send** SSE event with full result:

```javascript
// In your Soot handler
const { execSync } = require('child_process');

// Run the Java analyzer
const javaOutput = execSync(
  `java -cp ... SootApkAnalyzer -apk ${apkPath} -platforms ${platformsPath} -output-dir ${outputDir} -format jimple`,
  { encoding: 'utf-8' }
);

try {
  const result = JSON.parse(javaOutput);
  
  // Send the result with CFG data to frontend
  res.write(`data: ${JSON.stringify({
    "type": "result",
    "data": result  // Contains cfgData array
  })}\n\n`);
  
  res.write(`data: ${JSON.stringify({"type":"done"})}\n\n`);
  res.end();
} catch (e) {
  res.write(`data: ${JSON.stringify({"type":"error","message":e.message})}\n\n`);
  res.end();
}
```

## Approach 2: Create Separate CFG Extraction Endpoint (Current Frontend Implementation)

The frontend has a "Load CFG Data" button that calls `/security/soot/extract-cfg`. Implement this endpoint:

```javascript
app.post('/security/soot/extract-cfg', (req, res) => {
  const { jimpleDir } = req.body;
  
  try {
    // Re-run the analyzer or parse existing jimple files
    const javaOutput = execSync(
      `java -cp ... SootApkAnalyzer -apk ${originalApkPath} -platforms ${platformsPath} -output-dir ${jimpleDir} -format jimple`,
      { encoding: 'utf-8' }
    );
    
    const result = JSON.parse(javaOutput);
    res.json({
      cfgData: result.cfgData || [],
      success: true
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
      success: false
    });
  }
});
```

## CFG Data Structure

The Java analyzer now outputs:

```json
{
  "sensitiveApis": [...],
  "strings": [...],
  "classes": [...],
  "libraries": [...],
  "cfgData": [
    {
      "className": "com.example.Activity",
      "methodName": "onCreate",
      "methodSignature": "...",
      "nodes": [
        {
          "id": "unit_0",
          "label": "$r1 := @this: com.example.Activity",
          "isEntry": true,
          "isExit": false
        },
        {
          "id": "unit_1",
          "label": "$r2 = invoke $r1.<android.app.Activity...",
          "isEntry": false,
          "isExit": false
        },
        {
          "id": "unit_2",
          "label": "return",
          "isEntry": false,
          "isExit": true
        }
      ],
      "edges": [
        {
          "from": "unit_0",
          "to": "unit_1",
          "label": null
        },
        {
          "from": "unit_1",
          "to": "unit_2",
          "label": null
        }
      ]
    }
  ],
  "analysisTimeMs": 5000
}
```

## Frontend Button Flow

When user clicks "Load CFG Data":
1. Frontend sends POST to `/security/soot/extract-cfg` with jimpleDir
2. Backend extracts CFG data and returns it
3. Frontend populates CFG tab and displays visualization
4. User can browse methods and view control flow

## Testing

```bash
# Test the Java analyzer directly
java -cp "soot_jar/*:commons-io.jar:polyglot.jar" SootApkAnalyzer \
  -apk /path/to/app.apk \
  -platforms /path/to/Android/Sdk/platforms \
  -output-dir /tmp/jimple_output \
  -format jimple

# Check output includes cfgData
# The JSON output should have a "cfgData" field with method CFGs
```

## Troubleshooting

- **No CFG data in output**: Ensure methods have active bodies (not native/abstract)
- **Empty nodes/edges**: Some methods may have minimal code; that's normal
- **Performance**: CFG extraction for large APKs may take additional time

## Frontend Expectations

The frontend is ready for:
- ✅ SSE stream with "result" event containing cfgData
- ✅ POST endpoint at `/security/soot/extract-cfg`
- ✅ JSON response with cfgData array
- ✅ Real-time CFG visualization and browsing
