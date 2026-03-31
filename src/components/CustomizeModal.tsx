import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { useSectionVisibility, type SectionDef } from '../hooks/useSectionVisibility'

interface Props {
  title: string
  sections: SectionDef[]
  namespace: string
  onClose: () => void
}

export default function CustomizeModal({ title, sections, namespace, onClose }: Props) {
  const { isVisible, toggle, resetAll } = useSectionVisibility(namespace, sections)

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-surface-800 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
            >
              <X size={16} />
            </button>
          </div>

          {/* Section list */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {sections.map((section) => (
              <label key={section.id} className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-700 p-2 rounded">
                <input
                  type="checkbox"
                  checked={isVisible(section.id)}
                  onChange={() => toggle(section.id)}
                  className="w-4 h-4 mt-0.5 accent-accent-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {section.label}
                  </p>
                  {section.description && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {section.description}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            <button
              onClick={resetAll}
              className="text-xs text-accent-600 dark:text-accent-400 hover:text-accent-700 dark:hover:text-accent-300 font-medium"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
