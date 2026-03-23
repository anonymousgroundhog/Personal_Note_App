import soot.*;
import soot.options.Options;
import soot.jimple.*;
import soot.util.*;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.regex.*;
import java.util.stream.Collectors;

public class SootApkAnalyzer {
  private static final Map<String, String> SENSITIVE_APIS = new LinkedHashMap<>();
  private static final Map<String, String> LIBRARY_PATTERNS = new LinkedHashMap<>();

  static {
    // Location APIs
    SENSITIVE_APIS.put("android.location.LocationManager.getLastKnownLocation", "Location");
    SENSITIVE_APIS.put("android.location.LocationManager.requestLocationUpdates", "Location");
    SENSITIVE_APIS.put("com.google.android.gms.location.FusedLocationProviderClient.getLastLocation", "Location");

    // Device ID APIs
    SENSITIVE_APIS.put("android.telephony.TelephonyManager.getDeviceId", "Device ID");
    SENSITIVE_APIS.put("android.telephony.TelephonyManager.getSubscriberId", "Device ID");
    SENSITIVE_APIS.put("android.telephony.TelephonyManager.getSimSerialNumber", "Device ID");

    // SMS APIs
    SENSITIVE_APIS.put("android.telephony.SmsManager.sendTextMessage", "SMS");
    SENSITIVE_APIS.put("android.telephony.SmsManager.sendMultipartTextMessage", "SMS");

    // Camera APIs
    SENSITIVE_APIS.put("android.hardware.Camera.open", "Camera");
    SENSITIVE_APIS.put("android.hardware.camera2.CameraManager.openCamera", "Camera");

    // Microphone APIs
    SENSITIVE_APIS.put("android.media.MediaRecorder.setAudioSource", "Microphone");
    SENSITIVE_APIS.put("android.media.AudioRecord.<init>", "Microphone");

    // Contacts APIs
    SENSITIVE_APIS.put("android.content.ContentResolver.query", "Contacts");

    // Network APIs
    SENSITIVE_APIS.put("java.net.URL.openConnection", "Network");
    SENSITIVE_APIS.put("java.net.HttpURLConnection.getInputStream", "Network");
    SENSITIVE_APIS.put("okhttp3.OkHttpClient.newCall", "Network");
    SENSITIVE_APIS.put("com.android.volley.Request.<init>", "Network");

    // Crypto APIs
    SENSITIVE_APIS.put("javax.crypto.Cipher.getInstance", "Crypto");
    SENSITIVE_APIS.put("java.security.MessageDigest.getInstance", "Crypto");
    SENSITIVE_APIS.put("javax.crypto.spec.SecretKeySpec.<init>", "Crypto");

    // Runtime APIs
    SENSITIVE_APIS.put("java.lang.Runtime.exec", "Runtime Exec");
    SENSITIVE_APIS.put("java.lang.ProcessBuilder.start", "Runtime Exec");

    // Reflection APIs
    SENSITIVE_APIS.put("java.lang.reflect.Method.invoke", "Reflection");
    SENSITIVE_APIS.put("java.lang.Class.forName", "Reflection");

    // Clipboard APIs
    SENSITIVE_APIS.put("android.content.ClipboardManager.getPrimaryClip", "Clipboard");

    // Storage APIs
    SENSITIVE_APIS.put("java.io.FileOutputStream.<init>", "Storage");
    SENSITIVE_APIS.put("android.os.Environment.getExternalStorageDirectory", "Storage");

    // Library patterns
    LIBRARY_PATTERNS.put("okhttp3", "OkHttp");
    LIBRARY_PATTERNS.put("retrofit2", "Retrofit");
    LIBRARY_PATTERNS.put("com/google/firebase", "Firebase");
    LIBRARY_PATTERNS.put("com/facebook/android", "Facebook SDK");
    LIBRARY_PATTERNS.put("com/google/android/gms", "Google Play Services");
    LIBRARY_PATTERNS.put("com/google/gson", "Gson");
    LIBRARY_PATTERNS.put("io/reactivex", "RxJava");
    LIBRARY_PATTERNS.put("com/amazonaws", "AWS SDK");
    LIBRARY_PATTERNS.put("com/stripe", "Stripe");
    LIBRARY_PATTERNS.put("com/braintreepayments", "Braintree");
    LIBRARY_PATTERNS.put("com/mixpanel", "Mixpanel");
    LIBRARY_PATTERNS.put("com/amplitude", "Amplitude");
    LIBRARY_PATTERNS.put("org/apache/http", "Apache HttpClient");
    LIBRARY_PATTERNS.put("com/squareup/picasso", "Picasso");
    LIBRARY_PATTERNS.put("com/github/bumptech/glide", "Glide");
    LIBRARY_PATTERNS.put("com/squareup/moshi", "Moshi");
  }

  private static List<SensitiveApiCallData> sensitiveApis = new ArrayList<>();
  private static List<InterestingStringData> interestingStrings = new ArrayList<>();
  private static List<ClassData> classes = new ArrayList<>();
  private static Set<String> detectedLibraries = new HashSet<>();
  private static long startTime;

  public static void main(String[] args) throws Exception {
    startTime = System.currentTimeMillis();

    String apkPath = null, platformsPath = null, outputDir = null, format = "none";

    for (int i = 0; i < args.length; i++) {
      if (args[i].equals("-apk") && i + 1 < args.length) apkPath = args[++i];
      else if (args[i].equals("-platforms") && i + 1 < args.length) platformsPath = args[++i];
      else if (args[i].equals("-output-dir") && i + 1 < args.length) outputDir = args[++i];
      else if (args[i].equals("-format") && i + 1 < args.length) format = args[++i];
    }

    if (apkPath == null) {
      System.err.println("Error: -apk argument required");
      System.exit(1);
    }

    System.err.println("Initializing Soot...");
    G.reset();
    Options opts = Options.v();
    opts.set_src_prec(Options.src_prec_apk);
    opts.set_process_dir(Collections.singletonList(apkPath));

    if (platformsPath != null && !platformsPath.isEmpty()) {
      opts.set_android_jars(platformsPath);
    }

    opts.set_whole_program(true);
    opts.set_allow_phantom_refs(true);

    if (outputDir != null && !outputDir.isEmpty()) {
      opts.set_output_dir(outputDir);
      if (format.equals("jimple")) {
        opts.set_output_format(Options.output_format_jimple);
      } else if (format.equals("apk")) {
        opts.set_output_format(Options.output_format_dex);
      }
    }

    System.err.println("Loading classes...");
    Scene.v().loadNecessaryClasses();

    System.err.println("Analyzing application classes...");
    int classCount = 0;
    for (SootClass sc : Scene.v().getApplicationClasses()) {
      classCount++;
      analyzeClass(sc);
      if (classCount % 100 == 0) {
        System.err.println("Analyzed " + classCount + " classes...");
      }
    }

    System.err.println("Analysis complete. Generating output...");
    outputResults();
  }

  private static void analyzeClass(SootClass sc) {
    String className = sc.getName();
    String packageName = extractPackage(className);

    // Check for library match
    checkLibraryMatch(className);

    // Check if it's an Activity, Service, or BroadcastReceiver
    boolean isActivity = false, isService = false, isReceiver = false;
    try {
      SootClass parent = sc.getSuperclass();
      while (parent != null) {
        String parentName = parent.getName();
        if (parentName.equals("android.app.Activity")) isActivity = true;
        if (parentName.equals("android.app.Service")) isService = true;
        if (parentName.equals("android.content.BroadcastReceiver")) isReceiver = true;
        parent = parent.hasSuperclass() ? parent.getSuperclass() : null;
      }
    } catch (Exception e) {
      // Ignore
    }

    ClassData classData = new ClassData();
    classData.name = className;
    classData.packageName = packageName;
    classData.isActivity = isActivity;
    classData.isService = isService;
    classData.isReceiver = isReceiver;

    try {
      classData.superClass = sc.getSuperclass().getName();
    } catch (Exception e) {
      classData.superClass = "java.lang.Object";
    }

    classData.interfaces = sc.getInterfaces().stream()
      .map(SootClass::getName)
      .collect(Collectors.toList());

    // Analyze methods
    for (SootMethod method : sc.getMethods()) {
      MethodData methodData = new MethodData();
      methodData.name = method.getName();
      methodData.signature = method.getSignature();
      methodData.modifiers = Modifier.toString(method.getModifiers());
      methodData.returnType = method.getReturnType().toString();
      methodData.paramTypes = method.getParameterTypes().stream()
        .map(Type::toString)
        .collect(Collectors.toList());

      classData.methods.add(methodData);

      // Analyze method body for sensitive APIs and strings
      if (method.hasActiveBody()) {
        analyzeMethodBody(method, className);
      }
    }

    classes.add(classData);
  }

  private static void analyzeMethodBody(SootMethod method, String className) {
    Body body = method.getActiveBody();
    String methodSig = method.getSignature();

    for (Unit unit : body.getUnits()) {
      // Check for sensitive API calls
      if (unit instanceof InvokeStmt) {
        InvokeStmt stmt = (InvokeStmt) unit;
        checkInvoke(stmt.getInvokeExpr(), className, methodSig);
      } else if (unit instanceof AssignStmt) {
        AssignStmt stmt = (AssignStmt) unit;
        if (stmt.getRightOp() instanceof InvokeExpr) {
          checkInvoke((InvokeExpr) stmt.getRightOp(), className, methodSig);
        }
      }

      // Extract strings
      extractStrings(unit, className);
    }
  }

  private static void checkInvoke(InvokeExpr expr, String className, String methodSig) {
    SootMethod target = expr.getMethod();
    String targetSig = target.getSignature();

    for (Map.Entry<String, String> entry : SENSITIVE_APIS.entrySet()) {
      if (targetSig.contains(entry.getKey())) {
        SensitiveApiCallData call = new SensitiveApiCallData();
        call.category = entry.getValue();
        call.api = target.getName();
        call.calledFrom = className + "." + methodSig.split("\\(")[0];
        call.signature = targetSig;
        sensitiveApis.add(call);
        break;
      }
    }
  }

  private static void extractStrings(Unit unit, String className) {
    List<ValueBox> boxes = unit.getUseAndDefBoxes();
    for (ValueBox box : boxes) {
      Value val = box.getValue();
      if (val instanceof StringConstant) {
        String str = ((StringConstant) val).value;
        analyzeString(str, className);
      }
    }
  }

  private static void analyzeString(String str, String className) {
    if (str.length() < 4) return;

    // URL pattern
    if (Pattern.matches("https?://[^\\s\"']+", str)) {
      addInterestingString("URL", str, className);
      return;
    }

    // IP pattern
    if (Pattern.matches("\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b", str)) {
      addInterestingString("IP", str, className);
      return;
    }

    // Email pattern
    if (Pattern.matches("[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}", str)) {
      addInterestingString("Email", str, className);
      return;
    }

    // Base64 pattern (long strings only)
    if (str.length() >= 40 && Pattern.matches("[A-Za-z0-9+/]{40,}={0,2}", str)) {
      addInterestingString("Base64", str, className);
      return;
    }

    // Path pattern
    if (Pattern.matches("/[a-zA-Z0-9_/.-]{8,}", str)) {
      addInterestingString("Path", str, className);
      return;
    }
  }

  private static void addInterestingString(String type, String value, String foundIn) {
    for (InterestingStringData s : interestingStrings) {
      if (s.value.equals(value) && s.foundIn.equals(foundIn)) {
        return; // Duplicate
      }
    }
    InterestingStringData data = new InterestingStringData();
    data.type = type;
    data.value = value;
    data.foundIn = foundIn;
    interestingStrings.add(data);
  }

  private static void checkLibraryMatch(String className) {
    String classPath = className.replace(".", "/");
    for (Map.Entry<String, String> entry : LIBRARY_PATTERNS.entrySet()) {
      if (classPath.contains(entry.getKey())) {
        detectedLibraries.add(entry.getValue());
        return;
      }
    }
  }

  private static String extractPackage(String className) {
    int lastDot = className.lastIndexOf(".");
    return lastDot > 0 ? className.substring(0, lastDot) : className;
  }

  private static void outputResults() throws Exception {
    // Group sensitive APIs by category
    Map<String, List<SensitiveApiCallData>> apisGrouped = sensitiveApis.stream()
      .collect(Collectors.groupingBy(a -> a.category));

    // Deduplicate strings
    Set<String> seenStrings = new HashSet<>();
    List<InterestingStringData> uniqueStrings = new ArrayList<>();
    for (InterestingStringData s : interestingStrings) {
      String key = s.type + "|" + s.value;
      if (seenStrings.add(key)) {
        uniqueStrings.add(s);
      }
    }

    // Deduplicate classes
    Set<String> seenClasses = new HashSet<>();
    List<ClassData> uniqueClasses = new ArrayList<>();
    for (ClassData c : classes) {
      if (seenClasses.add(c.name)) {
        uniqueClasses.add(c);
      }
    }

    // Infer libraries and count
    Map<String, Integer> libraryCounts = new HashMap<>();
    for (String lib : detectedLibraries) {
      int count = 0;
      for (ClassData c : uniqueClasses) {
        for (Map.Entry<String, String> entry : LIBRARY_PATTERNS.entrySet()) {
          if (c.name.replace(".", "/").contains(entry.getKey()) && entry.getValue().equals(lib)) {
            count++;
            break;
          }
        }
      }
      libraryCounts.put(lib, count);
    }

    long analysisTime = System.currentTimeMillis() - startTime;

    // Output JSON
    StringBuilder json = new StringBuilder();
    json.append("{");
    json.append("\"apkName\":\"unknown\",");
    json.append("\"packageName\":\"unknown\",");
    json.append("\"sensitiveApis\":[");

    boolean first = true;
    for (Map.Entry<String, List<SensitiveApiCallData>> entry : apisGrouped.entrySet()) {
      for (SensitiveApiCallData call : entry.getValue()) {
        if (!first) json.append(",");
        first = false;
        json.append("{\"category\":\"").append(escape(call.category))
          .append("\",\"api\":\"").append(escape(call.api))
          .append("\",\"calledFrom\":\"").append(escape(call.calledFrom))
          .append("\",\"signature\":\"").append(escape(call.signature)).append("\"}");
      }
    }

    json.append("],\"strings\":[");
    first = true;
    for (InterestingStringData s : uniqueStrings) {
      if (!first) json.append(",");
      first = false;
      json.append("{\"type\":\"").append(s.type)
        .append("\",\"value\":\"").append(escape(s.value))
        .append("\",\"foundIn\":\"").append(escape(s.foundIn)).append("\"}");
    }

    json.append("],\"classes\":[");
    first = true;
    for (ClassData c : uniqueClasses) {
      if (!first) json.append(",");
      first = false;
      json.append("{\"name\":\"").append(escape(c.name))
        .append("\",\"packageName\":\"").append(escape(c.packageName))
        .append("\",\"superClass\":\"").append(escape(c.superClass))
        .append("\",\"interfaces\":[");
      boolean ifirst = true;
      for (String i : c.interfaces) {
        if (!ifirst) json.append(",");
        ifirst = false;
        json.append("\"").append(escape(i)).append("\"");
      }
      json.append("],\"methods\":[");
      boolean mfirst = true;
      for (MethodData m : c.methods) {
        if (!mfirst) json.append(",");
        mfirst = false;
        json.append("{\"name\":\"").append(escape(m.name))
          .append("\",\"signature\":\"").append(escape(m.signature))
          .append("\",\"modifiers\":\"").append(escape(m.modifiers))
          .append("\",\"returnType\":\"").append(escape(m.returnType))
          .append("\",\"paramTypes\":[");
        boolean pfirst = true;
        for (String p : m.paramTypes) {
          if (!pfirst) json.append(",");
          pfirst = false;
          json.append("\"").append(escape(p)).append("\"");
        }
        json.append("]}");
      }
      json.append("],\"isActivity\":").append(c.isActivity)
        .append(",\"isService\":").append(c.isService)
        .append(",\"isReceiver\":").append(c.isReceiver).append("}");
    }

    json.append("],\"libraries\":[");
    first = true;
    int idx = 0;
    for (Map.Entry<String, Integer> entry : libraryCounts.entrySet()) {
      if (!first) json.append(",");
      first = false;
      json.append("{\"name\":\"").append(escape(entry.getKey()))
        .append("\",\"packagePattern\":\"").append(entry.getKey())
        .append("\",\"confidence\":\"").append(entry.getValue() > 50 ? "high" : "medium")
        .append("\",\"classCount\":").append(entry.getValue()).append("}");
    }

    json.append("],\"analysisTimeMs\":").append(analysisTime).append("}");

    System.out.print(json.toString());
  }

  private static String escape(String s) {
    if (s == null) return "";
    return s.replace("\\", "\\\\")
      .replace("\"", "\\\"")
      .replace("\n", "\\n")
      .replace("\r", "\\r")
      .replace("\t", "\\t");
  }

  static class SensitiveApiCallData {
    String category, api, calledFrom, signature;
  }

  static class InterestingStringData {
    String type, value, foundIn;
  }

  static class MethodData {
    String name, signature, modifiers, returnType;
    List<String> paramTypes = new ArrayList<>();
  }

  static class ClassData {
    String name, packageName, superClass;
    List<String> interfaces = new ArrayList<>();
    List<MethodData> methods = new ArrayList<>();
    boolean isActivity, isService, isReceiver;
  }
}
