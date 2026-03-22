import React, { useMemo } from 'react'
import { buildProcessor } from '../../lib/markdown/processor'
import { useUiStore } from '../../stores/uiStore'

interface Props {
  content: string
}

export default function MarkdownPreview({ content }: Props) {
  const { setActiveNote } = useUiStore()

  const rendered = useMemo(() => {
    try {
      const processor = buildProcessor((name) => {
        // Find note by name and navigate to it
        setActiveNote(name + '.md')
      })
      const file = processor.processSync(content)
      return file.result as React.ReactNode
    } catch (e) {
      return <pre className="text-red-500">{String(e)}</pre>
    }
  }, [content, setActiveNote])

  return (
    <div className="prose-content px-6 py-4 overflow-y-auto h-full scrollbar-thin">
      {rendered}
    </div>
  )
}
