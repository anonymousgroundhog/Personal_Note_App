export function basename(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1]
}

export function dirname(path: string): string {
  const parts = path.split('/')
  parts.pop()
  return parts.join('/') || '.'
}

export function stripExtension(name: string): string {
  return name.replace(/\.md$/, '')
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}
