import React, { useEffect, useRef, useState, useId } from 'react'
import mermaid from 'mermaid'
import { useUiStore } from '../stores/uiStore'

interface Props {
  code: string
}

// Initialize mermaid once
let initialized = false
function ensureInit(dark: boolean) {
  if (!initialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: dark ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'inherit',
    })
    initialized = true
  }
}

export default function MermaidDiagram({ code }: Props) {
  const { darkMode } = useUiStore()
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string>('')
  const uid = useId().replace(/:/g, '')

  useEffect(() => {
    setError('')
    setSvg('')
    ensureInit(darkMode)
    // Re-init theme on dark mode change
    mermaid.initialize({
      startOnLoad: false,
      theme: darkMode ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'inherit',
    })
    const id = `mermaid-${uid}-${Date.now()}`
    mermaid.render(id, code.trim())
      .then(({ svg }) => setSvg(svg))
      .catch(e => setError(String(e?.message || e)))
  }, [code, darkMode, uid])

  if (error) {
    return (
      <div className="my-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Mermaid diagram error</p>
        <pre className="text-xs text-red-500 whitespace-pre-wrap">{error}</pre>
        <pre className="mt-2 text-xs text-gray-500 whitespace-pre-wrap">{code}</pre>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="my-3 p-4 flex items-center justify-center text-xs text-gray-400 bg-gray-50 dark:bg-surface-800 rounded-lg border border-gray-200 dark:border-gray-700">
        Rendering diagram…
      </div>
    )
  }

  return (
    <div
      className="my-3 flex justify-center overflow-x-auto p-2 bg-white dark:bg-surface-800 rounded-lg border border-gray-200 dark:border-gray-700"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
