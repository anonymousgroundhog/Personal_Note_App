import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface HelpSection {
  title: string
  content: string
  expanded: boolean
}

export default function HelpView() {
  const [sections, setSections] = useState<HelpSection[]>([
    {
      title: 'Basic Git Commands',
      expanded: true,
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
      expanded: false,
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
      expanded: false,
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
      expanded: false,
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
      expanded: false,
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
      expanded: false,
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
      expanded: false,
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
      expanded: false,
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

# Find large files in repo history
git rev-list --all --objects | sed -n '$(git rev-list --objects --all | cut -f1 -d' ' | git cat-file --batch-check | grep blob | sort -k3 -n | tail -10 | while read hash type size; do echo "$size $hash"; done | sort -rn | head -1 | awk '{print $2}')p'
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
    }
  ])

  const toggleSection = (index: number) => {
    setSections(sections.map((s, i) =>
      i === index ? { ...s, expanded: !s.expanded } : s
    ))
  }

  return (
    <div className="flex-1 overflow-auto bg-white dark:bg-surface-900">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Git Help</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">Quick reference for git commands and workflows</p>
        </div>

        <div className="space-y-4">
          {sections.map((section, index) => (
            <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection(index)}
                className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 dark:bg-surface-800 hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors"
              >
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{section.title}</h2>
                <ChevronDown
                  size={20}
                  className={`text-gray-600 dark:text-gray-400 transition-transform ${
                    section.expanded ? 'transform rotate-180' : ''
                  }`}
                />
              </button>

              {section.expanded && (
                <div className="px-6 py-4 bg-white dark:bg-surface-900 border-t border-gray-200 dark:border-gray-700">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {section.content.split('\n').map((line, idx) => {
                      if (line.startsWith('# ')) {
                        return (
                          <h3 key={idx} className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2 first:mt-0">
                            {line.replace('# ', '')}
                          </h3>
                        )
                      } else if (line.startsWith('## ')) {
                        return (
                          <h4 key={idx} className="text-base font-semibold text-gray-800 dark:text-gray-200 mt-3 mb-2">
                            {line.replace('## ', '')}
                          </h4>
                        )
                      } else if (line.startsWith('```')) {
                        return null
                      } else if (line.trim() === '') {
                        return <div key={idx} className="h-2" />
                      } else if (line.startsWith('  ') || line.startsWith('    ')) {
                        // Code block content
                        return null
                      }
                      return (
                        <p key={idx} className="text-gray-700 dark:text-gray-300 my-1">
                          {line}
                        </p>
                      )
                    })}
                  </div>

                  {/* Render code blocks properly */}
                  <div className="space-y-4 mt-4">
                    {section.content.split('```').map((block, idx) => {
                      if (idx % 2 === 1) {
                        // This is a code block
                        const language = block.split('\n')[0]
                        const code = block.split('\n').slice(1).join('\n').trim()
                        return (
                          <pre key={idx} className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                            <code>{code}</code>
                          </pre>
                        )
                      }
                      return null
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Need More Help?</h3>
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
      </div>
    </div>
  )
}
