import React, { useMemo } from 'react'
import { buildProcessor } from '../../lib/markdown/processor'
import { useUiStore } from '../../stores/uiStore'
import { useVaultStore } from '../../stores/vaultStore'

interface Props {
  content: string
}

export default function MarkdownPreview({ content }: Props) {
  const { setActiveNote } = useUiStore()
  const { attachmentUrls } = useVaultStore()

  const rendered = useMemo(() => {
    try {
      const processor = buildProcessor(
        (name) => setActiveNote(name + '.md'),
        (path) => attachmentUrls.get(path),
      )
      const file = processor.processSync(content)
      return file.result as React.ReactNode
    } catch (e) {
      return <pre className="text-red-500">{String(e)}</pre>
    }
  }, [content, setActiveNote, attachmentUrls])

  return (
    <div className="prose-content px-6 py-4 overflow-y-auto h-full scrollbar-thin">
      {rendered}
    </div>
  )
}
