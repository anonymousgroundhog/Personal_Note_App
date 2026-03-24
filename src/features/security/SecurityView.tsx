import React, { useState } from 'react'
import JimpleAnalyzerView from './JimpleAnalyzerView'

type SecurityTool = 'jimple-analyzer'

interface Tool {
  id: SecurityTool
  label: string
  icon: string
}

const TOOLS: Tool[] = [
  { id: 'jimple-analyzer', label: 'Jimple Analyzer', icon: '🔍' }
]

export default function SecurityView() {
  const [activeTool, setActiveTool] = useState<SecurityTool>('jimple-analyzer')

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-surface-900 overflow-hidden">
      {/* Header with tool tabs */}
      <div className="flex items-center gap-1 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800">
        <div className="flex items-center gap-0.5">
          {TOOLS.map(tool => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                activeTool === tool.id
                  ? 'bg-emerald-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span className="mr-1.5">{tool.icon}</span>
              {tool.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tool content area */}
      <div className="flex-1 overflow-hidden">
        {activeTool === 'jimple-analyzer' && <JimpleAnalyzerView />}
      </div>
    </div>
  )
}
