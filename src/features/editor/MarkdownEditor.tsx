import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { useUiStore } from '../../stores/uiStore'

export interface MarkdownEditorHandle {
  insertAtCursor: (text: string) => void
  insertOnNewLine: (text: string) => void
}

interface Props {
  value: string
  onChange: (value: string) => void
}

const MarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(function MarkdownEditor({ value, onChange }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const { darkMode } = useUiStore()
  const [internal, setInternal] = useState(value)

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useImperativeHandle(ref, () => ({
    insertAtCursor(text: string) {
      const view = viewRef.current
      if (!view) return
      const { from, to } = view.state.selection.main
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
      })
      view.focus()
    },
    insertOnNewLine(text: string) {
      const view = viewRef.current
      if (!view) return
      const { from, to } = view.state.selection.main
      const line = view.state.doc.lineAt(from)
      const lineText = line.text
      // If cursor is at the very start of an empty line, insert directly
      // Otherwise prepend a newline so the attachment isn't appended mid-line
      const prefix = (from === to && lineText.trim() === '') ? '' : '\n'
      const insert = prefix + text
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + insert.length },
      })
      view.focus()
    },
  }), [])

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
})

export default MarkdownEditor
