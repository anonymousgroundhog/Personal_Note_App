import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeReact from 'rehype-react'
import React, { createElement, Fragment } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import MermaidDiagram from '../../components/MermaidDiagram'
import DiagramEmbed from '../../components/DiagramEmbed'

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
// Also handles embed syntax: ![[diagram:ID]]
function remarkWikilinks() {
  return (tree: import('mdast').Root) => {
    const visit = (node: import('mdast').Node) => {
      if (node.type === 'text') {
        const text = (node as import('mdast').Text).value
        // Match both ![[...]] (embed) and [[...]] (link)
        const pattern = /(!?)\[\[([^\]]+)\]\]/g
        let match
        const parts: import('mdast').Node[] = []
        let last = 0
        while ((match = pattern.exec(text)) !== null) {
          if (match.index > last) {
            parts.push({ type: 'text', value: text.slice(last, match.index) } as import('mdast').Text)
          }
          const isEmbed = match[1] === '!'
          const inner = match[2]
          if (isEmbed && inner.startsWith('diagram:')) {
            // Diagram embed: ![[diagram:ID]]
            const diagramId = inner.slice('diagram:'.length).trim()
            parts.push({
              type: 'link',
              url: `diagram-embed:${diagramId}`,
              children: [{ type: 'text', value: diagramId } as import('mdast').Text],
            } as import('mdast').Link)
          } else {
            const [name, alias] = inner.split('|')
            parts.push({
              type: 'link',
              url: `wikilink:${name.trim()}`,
              children: [{ type: 'text', value: (alias || name).trim() } as import('mdast').Text],
            } as import('mdast').Link)
          }
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

// Rehype plugin to add IDs to headings based on their text content
function rehypeHeadingIds() {
  return (tree: any) => {
    const visit = (node: any) => {
      // Add IDs to headings (h1-h6)
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tagName)) {
        if (!node.properties?.id) {
          // Extract text content from heading
          const textContent = getTextContent(node)
          if (textContent) {
            // Generate ID: lowercase, replace spaces with hyphens, remove special chars
            const id = textContent
              .toLowerCase()
              .replace(/\{#[^}]+\}/g, '') // Remove {#id} syntax if present
              .trim()
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9\-]/g, '')
              .replace(/-+/g, '-')
              .replace(/^-+|-+$/g, '')

            if (id) {
              node.properties = node.properties || {}
              node.properties.id = id
            }
          }
        }
      }

      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(visit)
      }
    }

    visit(tree)
  }
}

// Helper to extract text content from a node
function getTextContent(node: any): string {
  if (node.type === 'text') {
    return node.value
  }
  if (node.children && Array.isArray(node.children)) {
    return node.children.map(getTextContent).join('')
  }
  return ''
}

export function buildProcessor(onWikiLink?: (name: string) => void) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkWikilinks)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeHeadingIds)
    .use(rehypeReact, {
      createElement,
      Fragment,
      jsx,
      jsxs,
      components: {
        a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
          if (href?.startsWith('diagram-embed:')) {
            const diagramId = href.slice('diagram-embed:'.length)
            return React.createElement(DiagramEmbed, { diagramId })
          }
          if (href?.startsWith('wikilink:')) {
            const name = href.slice(9)
            return React.createElement('span', {
              className: 'wikilink',
              onClick: () => onWikiLink?.(name),
              ...props,
            }, children)
          }
          // Internal anchor links should not open in new tab
          const isInternalAnchor = href?.startsWith('#')
          const linkProps = isInternalAnchor
            ? { href, ...props }
            : { href, target: '_blank', rel: 'noreferrer', ...props }
          return React.createElement('a', linkProps, children)
        },
        pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => {
          // Intercept mermaid fenced code blocks
          const child = React.Children.toArray(children)[0]
          if (React.isValidElement(child)) {
            const childProps = child.props as { className?: string; children?: React.ReactNode }
            if (childProps.className?.includes('language-mermaid')) {
              const code = String(childProps.children || '').replace(/\n$/, '')
              return React.createElement(MermaidDiagram, { code })
            }
          }
          return React.createElement('pre', props, children)
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
