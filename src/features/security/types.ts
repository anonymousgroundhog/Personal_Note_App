export interface SensitiveApiCall {
  category: string
  api: string
  calledFrom: string
  signature: string
}

export interface InterestingString {
  type: 'URL' | 'IP' | 'Base64' | 'Key' | 'Email' | 'Path' | 'Other'
  value: string
  foundIn: string
}

export interface MethodInfo {
  name: string
  signature: string
  modifiers: string
  returnType: string
  paramTypes: string[]
}

export interface ClassInfo {
  name: string
  packageName: string
  superClass: string
  interfaces: string[]
  methods: MethodInfo[]
  isActivity: boolean
  isService: boolean
  isReceiver: boolean
}

export interface LibraryInfo {
  name: string
  packagePattern: string
  confidence: 'high' | 'medium'
  classCount: number
}

export interface CFGNode {
  id: string
  label: string
  isEntry: boolean
  isExit: boolean
}

export interface CFGEdge {
  from: string
  to: string
  label?: string
}

export interface MethodCFG {
  className: string
  methodName: string
  methodSignature: string
  nodes: CFGNode[]
  edges: CFGEdge[]
}

export interface AnalysisResult {
  apkName?: string
  packageName: string
  targetSdkVersion?: number
  minSdkVersion?: number
  versionName?: string
  sensitiveApis: SensitiveApiCall[]
  strings: InterestingString[]
  classes: ClassInfo[]
  libraries: LibraryInfo[]
  analysisTimeMs: number
  outputDir?: string
}

export interface ApkAnalyzerConfig {
  sootJarPath: string
  androidPlatformsPath: string
  outputDir: string
  outputFormat: 'jimple' | 'apk' | 'none'
}

export const API_CATEGORY_COLORS: Record<string, { color: string; icon: string }> = {
  'Location': { color: '#22c55e', icon: '📍' },
  'Device ID': { color: '#f59e0b', icon: '📱' },
  'Network': { color: '#3b82f6', icon: '🌐' },
  'SMS': { color: '#8b5cf6', icon: '💬' },
  'Camera': { color: '#ec4899', icon: '📸' },
  'Microphone': { color: '#ef4444', icon: '🎤' },
  'Contacts': { color: '#06b6d4', icon: '👤' },
  'Storage': { color: '#f97316', icon: '📂' },
  'Crypto': { color: '#6366f1', icon: '🔐' },
  'Runtime Exec': { color: '#dc2626', icon: '⚡' },
  'Reflection': { color: '#7c3aed', icon: '🪞' },
  'Clipboard': { color: '#0891b2', icon: '📋' },
}
