import React, { useState } from 'react'
import { ChevronDown, BookOpen, Wrench } from 'lucide-react'

interface HelpSection {
  title: string
  content: string
  expanded: boolean
}

// ── App Guide tab ─────────────────────────────────────────────────────────────
const APP_SECTIONS: Omit<HelpSection, 'expanded'>[] = [
  {
    title: 'Notes & Editor',
    content: `## Overview
The Notes view is the core of the app. Open it from the sidebar to create, search, and edit Markdown notes stored in a local vault folder.

## Opening a Vault
Click **Open Vault** in the sidebar (folder icon). Select a directory on your machine — every \`.md\` file inside becomes a note in the index.

## Creating a Note
Click **+ New Note** in the top-right of the Editor view. Enter a name (the \`.md\` extension is added automatically). A frontmatter template is inserted with today's date.

## Tabs
Each note opens in its own tab. Click a tab to switch notes. Click the **×** on a tab to close it. Closing the last tab returns you to the landing search screen.

## Editing
The editor supports full **Markdown** with live preview toggle. Use the toolbar icons for bold, italic, headings, lists, links, and code blocks.

## AI Panel (per-note)
While a note is open, click the **AI** icon in the editor toolbar to open the in-editor AI chat panel. You can:
- Toggle **"Include note context"** to send the current note's content to the model as context
- Type or **speak** your question (mic button)
- Click **Move to note** on any AI response to append it at the cursor position
- Click the **speaker** icon on any response to have it read aloud (TTS)

## Graph View
Switch to **Graph** in the sub-tab bar to see a visual network of all notes and their \`[[wiki-link]]\` connections.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Vault shows 0 notes | Re-open the folder; ensure files end in \`.md\` |
| Edits not saved | Check folder write permissions |
| Tab won't close | Click × directly on the tab, not the editor area |
| Graph is empty | Add \`[[NoteTitle]]\` links between notes to create edges |`
  },
  {
    title: 'AI Chat',
    content: `## Overview
The **AI Chat** view (brain icon in sidebar) provides a full-screen conversational interface powered by the model configured in Settings.

## Connecting
1. Open **Settings** (gear icon) and enter your API key and choose a model.
2. The status indicator in the AI Chat header turns green when connected.

## Sending Messages
Type in the input box and press **Enter** (or **Shift+Enter** for a new line). Click **Send** or use the keyboard shortcut.

## Voice Input (Mic)
Click the **microphone** button to speak your message. While active:
- The input border turns red and pulses
- Interim transcript appears above the input in real-time
- Final transcript is appended to any existing text
- Click the mic button again (or **Send**) to stop

**Requires:** Chrome, Edge, or Safari. Firefox does not support the Web Speech API.

## Text-to-Speech (TTS)
Each AI response has a **speaker** icon. Click it to read the message aloud. While speaking:
- A **Stop** button appears in the header
- Click the same speaker icon or **Stop** to cancel

**Requires:** A browser with \`speechSynthesis\` support (all major browsers).

## Conversation Management
- Click **Clear** to wipe the current conversation
- Previous messages are kept in session memory but are not persisted between page reloads

## Troubleshooting
| Symptom | Fix |
|---|---|
| "Not connected" status | Verify API key in Settings; check network |
| No response / spinner hangs | Check API quota; try a shorter message |
| Mic button not shown | Browser doesn't support Web Speech API (use Chrome/Edge) |
| TTS speaks too fast/slow | Use browser or OS speech settings to adjust voice rate |
| Voice input cuts off early | Speak without long pauses; the recognizer stops on silence |`
  },
  {
    title: 'Calendar',
    content: `## Overview
The **Calendar** view lets you track events and link them to notes by date.

## Navigating
Use the **< >** arrows to move between months. Click any day cell to view or create events for that day.

## Creating Events
Click a day and fill in the event title and optional note link. Events are stored in the vault as frontmatter metadata.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Events not appearing | Ensure the note's frontmatter includes \`date: YYYY-MM-DD\` |
| Wrong month shown | Use the navigation arrows to move to the correct month |`
  },
  {
    title: 'Tags',
    content: `## Overview
The **Tags** view aggregates all \`tags:\` frontmatter values across every note in your vault into a browsable tag cloud and list.

## Tagging a Note
Add tags in a note's frontmatter:
\`\`\`yaml
---
tags: [project, ideas, 2026]
---
\`\`\`

## Browsing Tags
Click any tag in the Tags view to filter notes that carry that tag.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Tags not appearing | Confirm frontmatter uses YAML array syntax: \`tags: [a, b]\` |
| Tag count seems wrong | Re-open the vault to re-index |`
  },
  {
    title: 'Sync',
    content: `## Overview
The **Sync** view handles pushing and pulling your vault to/from a remote Git repository, giving you version-controlled backups.

## Initial Setup
1. Open a vault that is already a Git repository, or initialise one with \`git init\` in the vault folder.
2. In the Sync view, set the remote URL (e.g. a GitHub repo).
3. Click **Pull** to fetch the latest changes, then **Push** to publish yours.

## Conflict Resolution
If both local and remote have changes, a conflict view appears. Resolve conflicts in the editor and commit again.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Push fails with 403 | Check that your Git credentials/SSH key are configured for the remote |
| Nothing to push | Make sure you've saved notes — unsaved changes aren't committed |
| Merge conflict loop | Resolve all conflict markers (\`<<<<<<<\`) before pushing again |`
  },
  {
    title: 'Diagrams',
    content: `## Overview
The **Diagram** view renders **Mermaid** diagrams from text definitions.

## Creating a Diagram
Type or paste a Mermaid definition in the editor panel, for example:
\`\`\`
graph TD
  A[Start] --> B{Decision}
  B -- Yes --> C[Do it]
  B -- No --> D[Skip]
\`\`\`

## Supported Types
Flowcharts, sequence diagrams, Gantt charts, class diagrams, state diagrams, and more (see Mermaid documentation).

## Exporting
Use the **Export** button to save the diagram as an SVG or PNG.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Blank canvas | Check for Mermaid syntax errors — the error message appears below the editor |
| Export button disabled | Diagram must render successfully before export is enabled |`
  },
  {
    title: 'Code Editor',
    content: `## Overview
The **Code** view provides a Monaco-based code editor for writing and running scripts.

## Language Support
Syntax highlighting is available for TypeScript, JavaScript, Python, Go, Rust, and many more languages via Monaco's built-in language support.

## Running Code
Click **Run** (or press the keyboard shortcut shown in the toolbar) to execute the current script. Output appears in the panel below.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Run button disabled | Select a supported runtime language from the language dropdown |
| No output | Check for runtime errors in the output panel |`
  },
  {
    title: 'GSD (Getting Stuff Done)',
    content: `## Overview
The **GSD** view is a task management board inspired by GTD methodology.

## Adding Tasks
Click **+ Task** and enter a title. Optionally set a due date, priority, and associated note link.

## Board Columns
Tasks move through **Inbox → Next → Active → Done**. Drag a card to a new column or use the status dropdown.

## Filtering
Use the search bar or tag filter at the top to narrow down visible tasks.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Task disappeared | Check if a filter is active — clear the search/tag filter |
| Drag-and-drop not working | Ensure you are dragging the card handle, not text inside the card |`
  },
  {
    title: 'Security Tools',
    content: `## Overview
The **Security** view bundles several defensive security utilities including a CVSS calculator, pentest report generator, APK analyzer, and packet capture viewer.

## CVSS Calculator
Enter individual CVSS metrics to compute a Base, Temporal, and Environmental score with severity label. Scores follow CVSS v3.1.

## Pentest Report Generator
Fill in the report fields (scope, findings, risk ratings) and export a structured Markdown or PDF report.

## APK Analyzer
Upload an Android APK to inspect its manifest, permissions, and embedded strings.

## Packet Capture Viewer
Load a \`.pcap\` or \`.pcapng\` file to inspect captured network packets.

## Troubleshooting
| Symptom | Fix |
|---|---|
| APK analysis fails | Ensure the file is a valid APK (zip-based); files > 50 MB may time out |
| PCAP not loading | Only \`.pcap\` and \`.pcapng\` formats are supported |`
  },
  {
    title: 'Finance',
    content: `## Overview
The **Finance** view provides basic budgeting and expense tracking tools.

## Adding Transactions
Click **+ Transaction**, enter the amount, category, and date. Transactions are stored in the vault.

## Reports
Switch to the **Reports** sub-tab to see spending by category as a chart.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Chart not rendering | Ensure at least one transaction exists in the selected date range |`
  },
  {
    title: 'Communications',
    content: `## Overview
The **Communications** view aggregates messages and notifications from connected integrations.

## Connecting an Integration
Open **Settings** and navigate to the Integrations section. Add API keys or OAuth tokens for the services you want to connect.

## Troubleshooting
| Symptom | Fix |
|---|---|
| No messages shown | Verify that the integration token is valid and has the required scopes |
| Messages not updating | Click the **Refresh** button or re-open the view |`
  },
  {
    title: 'Web Browser',
    content: `## Overview
The **Web** view embeds a simple in-app browser so you can reference web pages without leaving the app.

## Navigating
Type a URL in the address bar and press **Enter**. Use the **← →** buttons for back/forward navigation.

## Saving a Page as a Note
Click **Save to Note** to capture the page title and URL into a new note in your vault.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Page won't load | Some sites block embedding in iframes (X-Frame-Options). Open those in your system browser. |
| Blank white page | Check network connectivity; the URL may be unreachable |`
  },
]

// ── Git Reference tab (original content) ─────────────────────────────────────
const GIT_SECTIONS: Omit<HelpSection, 'expanded'>[] = [
  {
    title: 'Basic Git Commands',
    content: `# Basic Git Commands

## Configuration
\`\`\`bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
git config --list
\`\`\`

## Creating & Cloning
\`\`\`bash
git init                          # Initialize a new git repository
git clone <url>                   # Clone a repository
git clone <url> <directory>       # Clone into a specific directory
\`\`\`

## Checking Status
\`\`\`bash
git status                        # Show working tree status
git diff                          # Show changes in working directory
git diff --staged                 # Show staged changes
git log                           # View commit history
git log --oneline                 # Compact log view
git log --graph --all             # Visual branch graph
\`\`\`

## Staging & Committing
\`\`\`bash
git add <file>                    # Stage a specific file
git add .                         # Stage all changes
git commit -m "message"           # Commit with message
git commit -am "message"          # Stage and commit tracked files
git commit --amend                # Modify the last commit
\`\`\`

## Branches
\`\`\`bash
git branch                        # List local branches
git branch -a                     # List all branches (local + remote)
git branch <branch-name>          # Create a new branch
git checkout <branch-name>        # Switch to a branch
git checkout -b <branch-name>     # Create and switch to new branch
git branch -d <branch-name>       # Delete a branch
git branch -m <old> <new>         # Rename a branch
\`\`\``
  },
  {
    title: 'Remote Operations',
    content: `# Remote Operations

## Working with Remotes
\`\`\`bash
git remote                        # List remote repositories
git remote -v                     # List remotes with URLs
git remote add <name> <url>       # Add a remote
git remote remove <name>          # Remove a remote
git remote set-url <name> <url>   # Change remote URL
\`\`\`

## Pushing & Pulling
\`\`\`bash
git push                          # Push current branch to remote
git push <remote> <branch>        # Push to specific remote and branch
git push origin --all             # Push all branches
git push <remote> --delete <branch>  # Delete remote branch
git push -u origin <branch>       # Push and set upstream

git pull                          # Fetch and merge from remote
git pull --rebase                 # Fetch and rebase instead of merge
git fetch                         # Fetch all remotes without merging
git fetch <remote>                # Fetch from specific remote
\`\`\`

## Tracking Branches
\`\`\`bash
git branch -u <remote>/<branch>   # Set upstream for current branch
git branch --set-upstream-to=<remote>/<branch>  # Set upstream
git branch -vv                    # Show tracking branches
\`\`\``
  },
  {
    title: 'Merging & Rebasing',
    content: `# Merging & Rebasing

## Merging
\`\`\`bash
git merge <branch>                # Merge branch into current branch
git merge --no-ff <branch>        # Merge with merge commit
git merge --squash <branch>       # Squash commits before merging
\`\`\`

## Rebasing
\`\`\`bash
git rebase <branch>               # Rebase current branch onto another
git rebase -i HEAD~<n>            # Interactive rebase last n commits
git rebase --continue             # Continue after resolving conflicts
git rebase --abort                # Cancel the rebase
\`\`\`

## Handling Conflicts
\`\`\`bash
# When a merge/rebase conflicts:
git status                        # See conflicted files
# Edit files to resolve conflicts
git add <resolved-file>
git commit                        # Complete the merge
# or git rebase --continue
\`\`\``
  },
  {
    title: 'Undoing Changes',
    content: `# Undoing Changes

## Discarding Changes
\`\`\`bash
git checkout -- <file>            # Discard changes in working directory
git restore <file>                # Restore file to staged version
git reset HEAD <file>             # Unstage a file
git reset --soft HEAD~1           # Undo last commit, keep changes staged
git reset --mixed HEAD~1          # Undo last commit, keep changes unstaged
git reset --hard HEAD~1           # Undo last commit, discard changes
\`\`\`

## Reverting Commits
\`\`\`bash
git revert <commit>               # Create new commit that undoes changes
git revert -n <commit>            # Revert without committing
\`\`\`

## Finding Commits
\`\`\`bash
git log -p                        # Show changes in commits
git log -S "string"               # Find commits containing string
git log --grep="pattern"          # Find commits by message
git blame <file>                  # Show who changed each line
git show <commit>                 # Show commit details
\`\`\``
  },
  {
    title: 'Stashing',
    content: `# Stashing Changes

## Save Work in Progress
\`\`\`bash
git stash                         # Stash all changes
git stash save "description"      # Stash with a message
git stash list                    # List all stashes
git stash show                    # Show latest stash changes
git stash show -p                 # Show patch of latest stash

git stash pop                     # Apply and remove latest stash
git stash apply                   # Apply stash without removing it
git stash apply stash@{n}         # Apply specific stash by index
git stash drop stash@{n}          # Delete a specific stash
git stash clear                   # Delete all stashes
\`\`\``
  },
  {
    title: 'Git LFS (Large File Storage)',
    content: `# Git LFS (Large File Storage)

## Installation & Setup
\`\`\`bash
git lfs install                   # Install Git LFS hooks
git lfs install --system          # System-wide installation
\`\`\`

## Tracking Large Files
\`\`\`bash
git lfs track "*.psd"             # Track PSD files
git lfs track "*.mp4"             # Track video files
git lfs untrack "*.psd"           # Stop tracking file type
git lfs ls-files                  # List all LFS-tracked files
\`\`\`

## Configuration
\`\`\`bash
cat .gitattributes                # View tracking patterns
git lfs config <key> <value>      # Configure LFS settings
\`\`\`

## Common LFS File Types
\`\`\`bash
# Images
git lfs track "*.psd" "*.ai" "*.png" "*.jpg" "*.jpeg"

# Video
git lfs track "*.mp4" "*.mov" "*.avi" "*.mkv"

# Audio
git lfs track "*.wav" "*.mp3" "*.flac"

# Archives
git lfs track "*.zip" "*.rar" "*.7z"

# Documents
git lfs track "*.docx" "*.xlsx" "*.pdf"
\`\`\`

## Working with LFS
\`\`\`bash
git add large_file.mp4
git commit -m "Add video"
git push                          # Automatically uploads to LFS server

# Cloning repositories with LFS
git clone <url>                   # LFS objects fetched automatically
git lfs pull                      # Download LFS objects
git lfs fetch                     # Fetch LFS objects without updating
\`\`\``
  },
  {
    title: 'Useful Workflows',
    content: `# Useful Git Workflows

## Feature Branch Workflow
\`\`\`bash
# Create feature branch
git checkout -b feature/login-form

# Make changes and commit
git add .
git commit -m "Add login form component"

# Keep branch up to date
git fetch origin
git rebase origin/main

# Push and create pull request
git push -u origin feature/login-form
\`\`\`

## Releasing a Version
\`\`\`bash
# Create release branch
git checkout -b release/v1.0.0

# Make version updates
git add .
git commit -m "Bump version to 1.0.0"

# Merge to main
git checkout main
git merge --no-ff release/v1.0.0
git tag v1.0.0

# Also merge back to develop
git checkout develop
git merge --no-ff release/v1.0.0

# Cleanup
git branch -d release/v1.0.0
git push origin main develop --tags
\`\`\`

## Cleaning Up Branches
\`\`\`bash
# Delete merged local branches
git branch --merged | grep -v '\\*\\|main\\|develop' | xargs -n 1 git branch -d

# Delete merged remote branches
git remote prune origin

# Remove local tracking branches for deleted remote branches
git fetch --prune
\`\`\`

## Interactive Rebase (Clean Up Commits)
\`\`\`bash
# Before pushing, clean up last 5 commits
git rebase -i HEAD~5

# In editor:
# pick     - keep commit
# reword   - change commit message
# squash   - combine with previous
# fixup    - combine, discard message
# drop     - remove commit
\`\`\`

## Cherry-Picking Commits
\`\`\`bash
git cherry-pick <commit>          # Apply commit to current branch
git cherry-pick <commit1> <commit2>  # Apply multiple commits
git cherry-pick <branch>          # Apply latest commit from branch
\`\`\``
  },
  {
    title: 'Advanced Tips',
    content: `# Advanced Git Tips

## Aliases
Create aliases in ~/.gitconfig:
\`\`\`ini
[alias]
  st = status
  co = checkout
  br = branch
  ci = commit
  unstage = reset HEAD --
  last = log -1 HEAD
  visual = log --graph --oneline --all
  amend = commit --amend --no-edit
\`\`\`

Use them:
\`\`\`bash
git st                            # Same as git status
git co main                       # Same as git checkout main
\`\`\`

## Useful One-Liners
\`\`\`bash
# View commits by author
git shortlog -sn

# Find which branches contain a commit
git branch --contains <commit>

# Show files changed in last commit
git show --name-only HEAD

# Undo last push (for unpushed commits)
git push --force-with-lease origin HEAD~1:branch-name

# Count commits
git rev-list --count HEAD
\`\`\`

## Debugging Tools
\`\`\`bash
git bisect start                  # Find commit that introduced bug
git bisect bad HEAD               # Mark current as bad
git bisect good <commit>          # Mark working commit as good
# Test and mark as good/bad until found

git reflog                        # Show reference logs (recover lost commits)
git fsck --lost-found             # Find unreachable objects

git log --follow -- <file>        # Track file through renames
\`\`\``
  },
]

// ── Shared accordion component ────────────────────────────────────────────────
function AccordionSection({
  section,
  index,
  onToggle,
}: {
  section: HelpSection
  index: number
  onToggle: (i: number) => void
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => onToggle(index)}
        className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 dark:bg-surface-800 hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-left">{section.title}</h2>
        <ChevronDown
          size={20}
          className={`text-gray-600 dark:text-gray-400 transition-transform flex-shrink-0 ${
            section.expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {section.expanded && (
        <div className="px-6 py-4 bg-white dark:bg-surface-900 border-t border-gray-200 dark:border-gray-700">
          <div className="prose prose-sm dark:prose-invert max-w-none space-y-2">
            {section.content.split('\n').map((line, idx) => {
              if (line.startsWith('# ') || line.startsWith('## ')) return null
              if (line.startsWith('### ') || line.startsWith('#### ')) {
                const text = line.replace(/^#{3,4}\s+/, '')
                return <h4 key={idx} className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-3 mb-1">{text}</h4>
              }
              if (line.startsWith('```') || line.trim() === '') return null
              // Table rows
              if (line.startsWith('|')) {
                const cells = line.split('|').filter((_, i) => i > 0 && i < line.split('|').length - 1)
                if (cells.every(c => /^[-: ]+$/.test(c))) return null // separator row
                const isHeader = idx > 0 && section.content.split('\n')[idx - 1]?.startsWith('|')
                  ? false
                  : true
                return (
                  <div key={idx} className={`flex gap-2 text-xs border-b border-gray-100 dark:border-gray-800 py-1 ${isHeader ? 'font-semibold text-gray-700 dark:text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>
                    {cells.map((cell, ci) => (
                      <span key={ci} className={ci === 0 ? 'w-56 flex-shrink-0' : 'flex-1'}>{cell.trim()}</span>
                    ))}
                  </div>
                )
              }
              return (
                <p key={idx} className="text-gray-700 dark:text-gray-300 text-sm">{line}</p>
              )
            })}
          </div>

          {/* Code blocks */}
          <div className="space-y-3 mt-3">
            {section.content.split('```').map((block, idx) => {
              if (idx % 2 !== 1) return null
              const code = block.split('\n').slice(1).join('\n').trim()
              return (
                <pre key={idx} className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{code}</code>
                </pre>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
type Tab = 'guide' | 'git'

export default function HelpView() {
  const [activeTab, setActiveTab] = useState<Tab>('guide')

  const [guideSections, setGuideSections] = useState<HelpSection[]>(
    APP_SECTIONS.map((s, i) => ({ ...s, expanded: i === 0 }))
  )
  const [gitSections, setGitSections] = useState<HelpSection[]>(
    GIT_SECTIONS.map((s, i) => ({ ...s, expanded: i === 0 }))
  )

  const toggleGuide = (i: number) =>
    setGuideSections(prev => prev.map((s, idx) => idx === i ? { ...s, expanded: !s.expanded } : s))

  const toggleGit = (i: number) =>
    setGitSections(prev => prev.map((s, idx) => idx === i ? { ...s, expanded: !s.expanded } : s))

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 px-4 flex-shrink-0">
        <button
          onClick={() => setActiveTab('guide')}
          className={`flex items-center gap-1.5 px-3 py-3 text-sm border-b-2 transition-colors ${
            activeTab === 'guide'
              ? 'border-accent-500 text-accent-500 font-medium'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <BookOpen size={14} />
          App Guide & Troubleshooting
        </button>
        <button
          onClick={() => setActiveTab('git')}
          className={`flex items-center gap-1.5 px-3 py-3 text-sm border-b-2 transition-colors ${
            activeTab === 'git'
              ? 'border-accent-500 text-accent-500 font-medium'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Wrench size={14} />
          Git Reference
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          {activeTab === 'guide' ? (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">App Guide & Troubleshooting</h1>
                <p className="text-gray-600 dark:text-gray-400">How to use each tool in the app, and what to do when something isn't working.</p>
              </div>
              <div className="space-y-4">
                {guideSections.map((section, i) => (
                  <AccordionSection key={i} section={section} index={i} onToggle={toggleGuide} />
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Git Reference</h1>
                <p className="text-gray-600 dark:text-gray-400">Quick reference for git commands and workflows.</p>
              </div>
              <div className="space-y-4">
                {gitSections.map((section, i) => (
                  <AccordionSection key={i} section={section} index={i} onToggle={toggleGit} />
                ))}
              </div>
              <div className="mt-12 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Official Documentation</h3>
                <p className="text-blue-800 dark:text-blue-300 text-sm mb-3">
                  For detailed documentation, visit the official Git documentation:
                </p>
                <a
                  href="https://git-scm.com/doc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  https://git-scm.com/doc
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
