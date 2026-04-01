import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useSettingsStore } from '../stores/settingsStore'

interface GlobalSettingsModalProps {
  onClose: () => void
}

export default function GlobalSettingsModal({ onClose }: GlobalSettingsModalProps) {
  const { gitConfig, setGitConfig } = useSettingsStore()
  const [userName, setUserName] = useState(gitConfig.userName)
  const [userEmail, setUserEmail] = useState(gitConfig.userEmail)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setGitConfig({ userName, userEmail })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const isValid = userName.trim() && userEmail.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-surface-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-sm">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            Global Settings
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Git User Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g., John Doe"
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Used for git commits in the repository
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Git Email
            </label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="e.g., john@example.com"
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Email address associated with commits
            </p>
          </div>

          {saved && (
            <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs text-green-700 dark:text-green-300">
              Settings saved successfully
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="flex-1 px-3 py-2 text-xs font-medium bg-accent-500 text-white rounded hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Settings
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-50 dark:hover:bg-surface-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
