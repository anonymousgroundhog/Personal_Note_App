import type { DiagramNode } from './DiagramEditor'

export function nodeShapePath(n: DiagramNode): string {
  const { x, y, w, h, shape } = n
  switch (shape) {
    case 'rect':
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z`
    case 'diamond': {
      const cx = x + w / 2, cy = y + h / 2
      return `M ${cx} ${y} L ${x + w} ${cy} L ${cx} ${y + h} L ${x} ${cy} Z`
    }
    case 'circle': {
      const rx = w / 2, ry = h / 2, cx = x + rx, cy = y + ry
      return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${w} 0 a ${rx} ${ry} 0 1 0 ${-w} 0`
    }
    case 'parallelogram': {
      const off = 16
      return `M ${x + off} ${y} L ${x + w} ${y} L ${x + w - off} ${y + h} L ${x} ${y + h} Z`
    }
    case 'cylinder': {
      const rx = w / 2, ry = 10
      return [
        `M ${x} ${y + ry}`,
        `a ${rx} ${ry} 0 1 1 ${w} 0`,
        `v ${h - ry * 2}`,
        `a ${rx} ${ry} 0 1 1 ${-w} 0`,
        `Z`,
        `M ${x} ${y + ry} a ${rx} ${ry} 0 1 0 ${w} 0`,
      ].join(' ')
    }
    case 'hexagon': {
      const off = w * 0.2
      return [
        `M ${x + off} ${y}`,
        `L ${x + w - off} ${y}`,
        `L ${x + w} ${y + h / 2}`,
        `L ${x + w - off} ${y + h}`,
        `L ${x + off} ${y + h}`,
        `L ${x} ${y + h / 2}`,
        `Z`,
      ].join(' ')
    }
    // Network shapes render as standalone icons — no box path
    case 'server':
    case 'cloud':
    case 'router':
    case 'firewall':
    case 'laptop':
    case 'phone':
      return ''
  }
}
