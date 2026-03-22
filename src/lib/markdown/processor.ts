import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeReact from 'rehype-react'
import React, { createElement, Fragment } from 'react'

// Simple frontmatter parser (YAML block between --- delimiters)
export function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  if (!content.startsWith('---')) {
    return { frontmatter: {}, body: content }
  }
  const end = content.indexOf('\n---', 3)
  if (end === -1) {
    return { frontmatter: {}, body: content }
  }
  const yamlBlock = content.slice(3, end).trim()
  const body = content.slice(end + 4).trim()
  const frontmatter: Record<string, unknown> = {}

  // Simple YAML key:value parser (handles strings, numbers, arrays, booleans)
  const lines = yamlBlock.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) { i++; continue }
    const key = line.slice(0, colonIdx).trim()
    const val = line.slice(colonIdx + 1).trim()
    if (!val) {
      // Check for array items
      const arr: string[] = []
      i++
      while (i < lines.length && lines[i].trimStart().startsWith('-')) {
        arr.push(lines[i].replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, ''))
        i++
      }
      frontmatter[key] = arr
      continue
    }
    if (val === 'true') frontmatter[key] = true
    else if (val === 'false') frontmatter[key] = false
    else if (!isNaN(Number(val)) && val !== '') frontmatter[key] = Number(val)
    else frontmatter[key] = val.replace(/^["']|["']$/g, '')
    i++
  }
  return { frontmatter, body }
}

// Wikilink: [[Note Name]] or [[Note Name|Alias]]
function remarkWikilinks() {
  return (tree: import('mdast').Root) => {
    const visit = (node: import('mdast').Node) => {
      if (node.type === 'text') {
        const text = (node as import('mdast').Text).value
        const pattern = /\[\[([^\]]+)\]\]/g
        let match
        const parts: import('mdast').Node[] = []
        let last = 0
        while ((match = pattern.exec(text)) !== null) {
          if (match.index > last) {
            parts.push({ type: 'text', value: text.slice(last, match.index) } as import('mdast').Text)
          }
          const [name, alias] = match[1].split('|')
          parts.push({
            type: 'link',
            url: `wikilink:${name.trim()}`,
            children: [{ type: 'text', value: (alias || name).trim() } as import('mdast').Text],
          } as import('mdast').Link)
          last = match.index + match[0].length
        }
        if (parts.length > 0) {
          if (last < text.length) {
            parts.push({ type: 'text', value: text.slice(last) } as import('mdast').Text)
          }
          Object.assign(node, { type: 'paragraph', children: parts })
        }
      }
      if ('children' in node && Array.isArray((node as { children: import('mdast').Node[] }).children)) {
        ;(node as { children: import('mdast').Node[] }).children.forEach(visit)
      }
    }
    visit(tree)
  }
}

export function buildProcessor(onWikiLink?: (name: string) => void) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkWikilinks)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeReact, {
      createElement,
      Fragment,
      components: {
        a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
          if (href?.startsWith('wikilink:')) {
            const name = href.slice(9)
            return React.createElement('span', {
              className: 'wikilink',
              onClick: () => onWikiLink?.(name),
              ...props,
            }, children)
          }
          return React.createElement('a', { href, target: '_blank', rel: 'noreferrer', ...props }, children)
        },
        blockquote: ({ children, ...props }: React.BlockquoteHTMLAttributes<HTMLElement>) => {
          const childArray = React.Children.toArray(children)
          const firstChild = childArray[0]
          if (React.isValidElement(firstChild)) {
            const text = String((firstChild.props as { children?: React.ReactNode }).children || '')
            const match = text.match(/^\[!(\w+)\]/)
            if (match) {
              const type = match[1].toLowerCase()
              return React.createElement('div', {
                className: `callout callout-${type}`,
                ...props,
              }, children)
            }
          }
          return React.createElement('blockquote', props, children)
        },
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
}
