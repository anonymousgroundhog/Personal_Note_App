import React, { useEffect, useRef, useState, useCallback } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { useUiStore } from '../../stores/uiStore'

interface Props {
  value: string
  onChange: (value: string) => void
}

export default function MarkdownEditor({ value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const { darkMode } = useUiStore()
  const [internal, setInternal] = useState(value)

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current) return

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      markdown(),
      keymap.of([...defaultKeymap, indentWithTab]),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newValue = update.state.doc.toString()
          setInternal(newValue)
          onChangeRef.current(newValue)
        }
      }),
      darkMode ? oneDark : [],
    ].flat()

    const state = EditorState.create({
      doc: value,
      extensions,
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [darkMode])

  // Sync external value changes (e.g., loading a new note)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value && value !== internal) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
      setInternal(value)
    }
  }, [value, internal])

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-auto [&_.cm-editor]:h-full [&_.cm-editor]:text-sm [&_.cm-scroller]:h-full"
    />
  )
}
