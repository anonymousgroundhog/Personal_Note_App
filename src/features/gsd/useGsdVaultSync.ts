import { useEffect, useRef, useCallback } from 'react'
import { useVaultStore } from '../../stores/vaultStore'
import { useGsdStore } from './gsdStore'

const GSD_DATA_PATH = 'gsd/data.md'

export function useGsdVaultSync() {
  const { rootHandle, fallbackMode, saveNote, readNote } = useVaultStore()
  const hasVault = !!(rootHandle || fallbackMode)
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initializedRef = useRef(false)

  // Initial load from vault
  useEffect(() => {
    if (!hasVault || initializedRef.current) return
    initializedRef.current = true
    ;(async () => {
      try {
        const raw = await readNote(GSD_DATA_PATH)
        const match = raw.match(/```json\n([\s\S]*?)\n```/)
        if (!match) return
        const parsed = JSON.parse(match[1])
        useGsdStore.getState().hydrate(parsed)
      } catch {
        // File doesn't exist yet — keep localStorage state
      }
    })()
  }, [hasVault, readNote])

  // Cleanup
  useEffect(() => {
    return () => { if (writeTimerRef.current) clearTimeout(writeTimerRef.current) }
  }, [])

  const scheduleWrite = useCallback(() => {
    if (!hasVault) return
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current)
    writeTimerRef.current = setTimeout(() => {
      const { items, projects, contexts } = useGsdStore.getState()
      const payload = JSON.stringify({ items, projects, contexts }, null, 2)
      const content = [
        '# GSD Data',
        '',
        '<!-- Auto-managed by the GSD dashboard. Manual edits will be overwritten. -->',
        '',
        '```json',
        payload,
        '```',
      ].join('\n')
      saveNote(GSD_DATA_PATH, content).catch(console.error)
    }, 600)
  }, [hasVault, saveNote])

  return { scheduleWrite }
}
