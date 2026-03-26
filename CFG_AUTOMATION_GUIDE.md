# CFG Automation - Load CFG Data Implementation

## What's Implemented ✅

The "Load CFG Data" button now automatically works with a two-stage fallback approach:

### Stage 1: Try Backend Endpoint
When the user clicks "Load CFG Data":
```
POST /security/soot/extract-cfg
{
  "jimpleDir": "/path/to/sootOutput"
}
```

Expected response:
```json
{
  "cfgData": [
    {
      "className": "com.example.Activity",
      "methodName": "onCreate",
      "methodSignature": "onCreate(Bundle)",
      "nodes": [...],
      "edges": [...]
    }
  ]
}
```

If this endpoint is available and returns CFG data, it displays immediately in the CFG tab.

### Stage 2: Fallback to Sample Data
If the backend endpoint is not available, the button automatically:
1. Shows a message explaining the backend isn't configured
2. Loads **sample CFG data** for demonstration
3. Displays the CFG visualization with example methods
4. Allows the user to explore the CFG feature

## Sample Data Provided 📊

The fallback loads 2 sample methods:
- `MainActivity.onCreate(Bundle)` - Shows typical activity initialization
- `MainActivity.onResume()` - Shows simple method flow

This lets users immediately see how the CFG visualization works.

## How to Integrate Real CFG Data 🔌

### Option 1: Implement Backend Endpoint (Recommended)

Create this endpoint in your backend:

```javascript
const express = require('express');
const { execSync } = require('child_process');

app.post('/security/soot/extract-cfg', (req, res) => {
  const { jimpleDir } = req.body;
  
  try {
    // Run the Java analyzer that now outputs CFG data
    const javaOutput = execSync(
      `java -cp "soot_jar/*:commons-io.jar" SootApkAnalyzer ` +
      `-apk ${originalApkPath} ` +
      `-platforms ${androidPlatformsPath} ` +
      `-output-dir ${jimpleDir} ` +
      `-format jimple`,
      { encoding: 'utf-8' }
    );
    
    // Parse the JSON output from SootApkAnalyzer
    const result = JSON.parse(javaOutput);
    
    // Return just the CFG data
    res.json({
      cfgData: result.cfgData || [],
      success: true
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      success: false
    });
  }
});
```

**Key points:**
- The Java analyzer (`SootApkAnalyzer.java`) already outputs `cfgData` in JSON
- Your endpoint just needs to parse and forward it
- The `cfgData` array contains all extracted method CFGs

### Option 2: Call Backend in Initial Soot Run

Modify `/security/soot/run` to send CFG data as part of completion:

```javascript
// After Soot finishes, parse the output and send result event:

const result = JSON.parse(javaOutput);

res.write(`data: ${JSON.stringify({
  "type": "result",
  "data": result  // Includes cfgData automatically
})}\n\n`);

res.write(`data: ${JSON.stringify({"type":"done"})}\n\n`);
res.end();
```

The frontend will automatically extract and display the CFG data.

## Testing the Feature

### With Sample Data (Works Now)
1. Open Soot Compiler
2. Run Soot on an APK
3. Click "Load CFG Data" button
4. Sample CFGs appear immediately
5. Browse methods and explore CFG visualization

### With Real Data (After Backend Implementation)
Once the backend endpoint is implemented:
1. Click "Load CFG Data"
2. Frontend requests CFG data from backend
3. Backend runs analyzer and returns real CFG data
4. Real method CFGs display with actual program flow
5. User explores actual application control flow

## File Modifications

### Frontend Changes
- `SootCompilerView.tsx`:
  - Added `DisplayTab` type for 'output' and 'cfg'
  - Added `loadCFGFromBackend()` function
  - Added `createSampleCFGData()` for fallback
  - Added tab interface for switching between Output and CFG
  - Added "Load CFG Data" button in success message

### Backend Changes Needed
- Implement `/security/soot/extract-cfg` endpoint
- OR modify `/security/soot/run` to forward CFG data
- Both approaches work - choose based on your architecture

## Current Status

✅ **Frontend:** Fully functional with automatic fallback
⏳ **Backend:** Needs implementation of one endpoint
✅ **Java Analyzer:** Already outputs CFG data in JSON
✅ **Sample Data:** Available for immediate testing

## Next Steps

1. **Test with sample data** - Verify CFG visualization works
2. **Implement backend endpoint** - Use one of the two approaches above
3. **Replace sample data** - Real CFG data automatically replaces samples
4. **Explore CFGs** - Users can browse and analyze method flows

## Java Analyzer Details

The modified `SootApkAnalyzer.java`:
- Extracts CFG for each method with active body
- Outputs as JSON with `cfgData` field
- Includes nodes (statements) and edges (control flow)
- Marks entry/exit nodes and labels branches
- Runs during normal Soot analysis with no additional overhead
