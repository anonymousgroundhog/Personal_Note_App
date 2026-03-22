import { create } from 'zustand'

export interface AiConfig {
  serverUrl: string       // e.g. http://localhost:3000 or https://openwebui.example.com
  apiKey: string          // Bearer token / API key
  selectedModel: string   // model id string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface AiModel {
  id: string
  name: string
  owned_by?: string
}

interface AiState {
  config: AiConfig
  models: AiModel[]
  modelsLoading: boolean
  modelsError: string | null
  messages: ChatMessage[]
  streaming: boolean
  streamingContent: string

  setConfig: (config: Partial<AiConfig>) => void
  fetchModels: () => Promise<void>
  sendMessage: (userContent: string, context?: string) => Promise<void>
  clearChat: () => void
  abortStream: () => void
}

const STORAGE_KEY = 'aiStore_config'

function loadConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as AiConfig
  } catch {}
  return { serverUrl: '', apiKey: '', selectedModel: '' }
}

function saveConfig(config: AiConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {}
}

let abortController: AbortController | null = null

export const useAiStore = create<AiState>((set, get) => ({
  config: loadConfig(),
  models: [],
  modelsLoading: false,
  modelsError: null,
  messages: [],
  streaming: false,
  streamingContent: '',

  setConfig: (partial) => {
    const config = { ...get().config, ...partial }
    saveConfig(config)
    set({ config })
  },

  fetchModels: async () => {
    const { config } = get()
    if (!config.serverUrl) {
      set({ modelsError: 'Server URL is required', models: [] })
      return
    }
    set({ modelsLoading: true, modelsError: null })
    try {
      const base = config.serverUrl.replace(/\/$/, '')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`

      const res = await fetch(`${base}/api/models`, { headers })
      if (!res.ok) {
        // Fallback: try OpenAI-compat /v1/models endpoint
        const res2 = await fetch(`${base}/v1/models`, { headers })
        if (!res2.ok) throw new Error(`HTTP ${res2.status}: ${res2.statusText}`)
        const data2 = await res2.json()
        const models: AiModel[] = (data2.data ?? []).map((m: { id: string; owned_by?: string }) => ({
          id: m.id,
          name: m.id,
          owned_by: m.owned_by,
        }))
        set({ models, modelsLoading: false })
        if (models.length > 0 && !get().config.selectedModel) {
          get().setConfig({ selectedModel: models[0].id })
        }
        return
      }
      const data = await res.json()
      // OpenWebUI returns { data: [...] } or direct array
      const raw: { id: string; name?: string; owned_by?: string }[] = data.data ?? data
      const models: AiModel[] = raw.map(m => ({
        id: m.id,
        name: m.name || m.id,
        owned_by: m.owned_by,
      }))
      set({ models, modelsLoading: false })
      if (models.length > 0 && !get().config.selectedModel) {
        get().setConfig({ selectedModel: models[0].id })
      }
    } catch (err) {
      set({ modelsError: err instanceof Error ? err.message : String(err), modelsLoading: false })
    }
  },

  sendMessage: async (userContent: string, context?: string) => {
    const { config, messages } = get()
    if (!config.serverUrl || !config.selectedModel) return

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userContent,
      timestamp: Date.now(),
    }

    set({ messages: [...messages, userMsg], streaming: true, streamingContent: '' })

    const base = config.serverUrl.replace(/\/$/, '')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`

    // Build message list for the API — include note context as a system message if provided
    const apiMessages: { role: string; content: string }[] = []
    if (context) {
      apiMessages.push({
        role: 'system',
        content: `You are a helpful assistant. The user has provided the following notes as context:\n\n${context}\n\nUse these notes to answer questions accurately. When referencing specific notes, mention the note name.`,
      })
    }
    // Include prior conversation (last 20 messages, skip system)
    const history = [...messages, userMsg].slice(-20)
    history.forEach(m => {
      if (m.role !== 'system') apiMessages.push({ role: m.role, content: m.content })
    })

    abortController = new AbortController()

    try {
      // Try OpenAI-compat streaming endpoint (works for OpenWebUI, Ollama, LM Studio, etc.)
      const endpoint = `${base}/api/chat/completions`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        signal: abortController.signal,
        body: JSON.stringify({
          model: config.selectedModel,
          messages: apiMessages,
          stream: true,
        }),
      })

      if (!res.ok) {
        // Fallback to /v1/chat/completions
        const res2 = await fetch(`${base}/v1/chat/completions`, {
          method: 'POST',
          headers,
          signal: abortController.signal,
          body: JSON.stringify({
            model: config.selectedModel,
            messages: apiMessages,
            stream: true,
          }),
        })
        if (!res2.ok) {
          const errText = await res2.text()
          throw new Error(`HTTP ${res2.status}: ${errText}`)
        }
        await processStream(res2, set, get)
        return
      }

      await processStream(res, set, get)
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // Finalize whatever we got
        const partial = get().streamingContent
        if (partial) {
          const assistantMsg: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: partial,
            timestamp: Date.now(),
          }
          set(s => ({ messages: [...s.messages, assistantMsg], streaming: false, streamingContent: '' }))
        } else {
          set({ streaming: false, streamingContent: '' })
        }
      } else {
        const errMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: Date.now(),
        }
        set(s => ({ messages: [...s.messages, errMsg], streaming: false, streamingContent: '' }))
      }
    }
  },

  clearChat: () => set({ messages: [], streamingContent: '' }),

  abortStream: () => {
    abortController?.abort()
  },
}))

async function processStream(
  res: Response,
  set: (partial: Partial<AiState> | ((s: AiState) => Partial<AiState>)) => void,
  get: () => AiState,
) {
  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')
  const decoder = new TextDecoder()
  let accumulated = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content ?? ''
          if (delta) {
            accumulated += delta
            set({ streamingContent: accumulated })
          }
        } catch {
          // skip malformed JSON chunks
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  const assistantMsg: ChatMessage = {
    id: `msg-${Date.now()}`,
    role: 'assistant',
    content: accumulated || '(empty response)',
    timestamp: Date.now(),
  }
  set((s: AiState) => ({ messages: [...s.messages, assistantMsg], streaming: false, streamingContent: '' }))
}
