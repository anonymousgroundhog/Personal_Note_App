import React, { useState, useRef, useCallback, useEffect } from 'react'
import { BookOpen, AlertCircle, X } from 'lucide-react'
import { useVaultStore } from '../../stores/vaultStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NmapPort {
  protocol: string
  port: number
  state: string
  service: string
  product: string
  version: string
  extrainfo: string
}

interface NmapScript {
  id: string
  output: string
}

interface NmapHost {
  ip: string
  mac: string
  vendor: string
  hostnames: string[]
  state: 'up' | 'down' | 'unknown'
  os: { name: string; accuracy: string } | null
  ports: NmapPort[]
  scripts: NmapScript[]
}

interface ScanSummary {
  command: string
  hostsUp: number
  hostsDown: number
  hostsTotal: number
  elapsed: number | null
}

interface ScanResult {
  hosts: NmapHost[]
  summary: ScanSummary
  rawXml: string
}

type ScanType = 'ping' | 'quick' | 'service' | 'os' | 'full' | 'udp' | 'vuln'

const SCAN_TYPES: { id: ScanType; label: string; description: string }[] = [
  { id: 'ping',    label: 'Ping Sweep',     description: 'Discover live hosts (no port scan)' },
  { id: 'quick',   label: 'Quick Scan',     description: 'Top 100 ports, fast' },
  { id: 'service', label: 'Service Detect', description: 'Version + script detection' },
  { id: 'os',      label: 'OS Detection',   description: 'OS fingerprinting' },
  { id: 'full',    label: 'Full Port Scan', description: 'All 65535 ports' },
  { id: 'udp',     label: 'UDP Scan',       description: 'Top UDP ports' },
  { id: 'vuln',    label: 'Vuln Scripts',   description: 'NSE vulnerability scripts' },
]

const SERVICE_COLORS: Record<string, string> = {
  http:    'text-blue-400',
  https:   'text-blue-300',
  ssh:     'text-green-400',
  ftp:     'text-yellow-400',
  smtp:    'text-orange-400',
  dns:     'text-purple-400',
  rdp:     'text-red-400',
  smb:     'text-red-300',
  mysql:   'text-cyan-400',
  postgres:'text-cyan-300',
  default: 'text-gray-400',
}

function serviceColor(service: string): string {
  return SERVICE_COLORS[service?.toLowerCase()] ?? SERVICE_COLORS.default
}

// ── Device type inference ─────────────────────────────────────────────────────

type DeviceType = 'router' | 'switch' | 'server' | 'windows' | 'linux' | 'macos' | 'android' | 'printer' | 'camera' | 'iot' | 'unknown'

function inferDeviceType(host: NmapHost): DeviceType {
  const hostnames = host.hostnames.map(h => h.toLowerCase())
  const hn        = hostnames.join(' ')   // all hostnames as one searchable string
  const vendor    = (host.vendor ?? '').toLowerCase()
  const ports     = host.ports.map(p => p.port)
  const services  = host.ports.map(p => (p.service ?? '').toLowerCase())
  const serverPorts = [80, 443, 22, 25, 587, 993, 3306, 5432, 6379, 27017, 8080, 8443, 8888, 9000]

  // ── 1. Hostname patterns (highest priority) ───────────────────────────────

  // Router / firewall / gateway
  if (/\b(router|gateway|gw|rtr|fw|firewall|pfsense|openwrt|ddwrt|vyos|unifi-gw|edgerouter|meraki|fortigate|asa|srx|asr|isr)\b/.test(hn) ||
      /^(rt|gw|rtr|fw|cr|br|pe|ce)\d*[-.]/.test(hn)) return 'router'

  // Switch / L2-L3 infrastructure
  if (/\b(switch|sw\d|core-sw|access-sw|dist-sw|nexus|catalyst|procurve|aruba-sw|s\d{4}|ws-c)\b/.test(hn) ||
      /^sw\d*[-.]/.test(hn)) return 'switch'

  // Printer / MFP / plotter
  if (/\b(print|printer|prn|mfp|copier|plotter|cups|laserjet|officejet|pixma|envy|deskjet|bizhub|workcentre|phaser|colorqube|imagerunner|versalink|altalink)\b/.test(hn)) return 'printer'

  // IP camera / NVR / DVR / video surveillance
  if (/\b(cam|camera|ipcam|ipcamera|nvr|dvr|cctv|onvif|hikvision|dahua|foscam|reolink|wyze|arlo|ring-cam|blink|amcrest|axis-cam|milestone|genetec)\b/.test(hn)) return 'camera'

  // IoT / embedded / smart home
  if (/\b(iot|esp8266|esp32|esp\d|arduino|raspi|raspberry|pi\d|rpi|nodemcu|wemos|d1mini|tasmota|esphome|shelly|sonoff|homekit|philips-hue|hue-|nest-|ring-|ecobee|wemo|smartthings|zigbee|zwave|tuya|particle|pycom|micropython|circuitpython)\b/.test(hn)) return 'iot'

  // Mobile / phone / tablet (Android & iOS)
  if (/\b(android|phone|pixel\d|galaxy|oneplus|xiaomi|redmi|poco|huawei|honor|oppo|vivo|realme|motorola|moto[- ]\w|nokia|tablet|nexus\d)\b/.test(hn) ||
      /\b(iphone|ipad|ipod)\b/.test(hn)) return 'android'

  // macOS / Apple desktop & laptop
  if (/\b(macbook|macbook-pro|macbook-air|imac|mac-mini|macmini|mac-pro|macpro|apple-tv|appletv|mac-studio|macstudio)\b/.test(hn) ||
      /-mac\b/.test(hn) || /\bmac\b/.test(hn)) return 'macos'

  // Windows desktop / laptop — AD/NetBIOS patterns and explicit keywords
  if (/\b(desktop|laptop|workstation|thinkpad|thinkcentre|optiplex|inspiron|latitude|precision|elitebook|probook|zbook|envy-pc|spectre|pavilion|surface)\b/.test(hn) ||
      /\b(win\d|windows|pc\d{1,4})\b/.test(hn) ||
      /^(desktop-|laptop-|msedge|win-|wks-|client-)/i.test(hn) ||
      /^[A-Z]{2,8}-[A-Z0-9]{5,}$/.test(hostnames[0] ?? '')) return 'windows'

  // Linux server — service-role and tooling names
  if (/\b(server|srv|node\d|db\d|db-|web\d|web-|app\d|app-|api\d|api-|proxy|lb\d|lb-|cache|queue|mq-|kafka|rabbit|redis|elastic|mongo|postgres|mysql|mariadb|nginx|apache|haproxy|traefik|vault|consul|nomad|k8s|kube|control-plane|worker\d|docker|container|jenkins|gitlab|ci-|cd-|git\d|infra-|ops-|siem|splunk|graylog|prometheus|grafana|nagios|zabbix)\b/.test(hn)) return 'server'

  // Linux workstation / distro hostnames
  if (/\b(ubuntu|debian|fedora|arch|manjaro|mint|linuxmint|elementary|pop-os|popos|zorin|opensuse|suse|tumbleweed|leap|gentoo|slackware|void|alpine|kali|parrot|blackarch|backbox|centos|rhel|almalinux|rockylinux|oracle-linux|scientificlinux|clearlinux|nixos|guix|whonix|tails)\b/.test(hn)) return 'linux'

  // ── 2. Vendor (MAC OUI) ───────────────────────────────────────────────────

  // Network infrastructure vendors
  if (vendor.includes('cisco') || vendor.includes('juniper') || vendor.includes('mikrotik') ||
      vendor.includes('ubiquiti') || vendor.includes('ui.com') || vendor.includes('netgear') ||
      vendor.includes('tp-link') || vendor.includes('zyxel') || vendor.includes('fortinet') ||
      vendor.includes('palo alto') || vendor.includes('check point') || vendor.includes('sonicwall') ||
      vendor.includes('watchguard') || vendor.includes('barracuda') || vendor.includes('meraki') ||
      vendor.includes('arista') || vendor.includes('extreme') || vendor.includes('brocade') ||
      vendor.includes('dell emc networking') || vendor.includes('d-link') || vendor.includes('asus') ||
      vendor.includes('linksys') || vendor.includes('belkin') || vendor.includes('actiontec') ||
      vendor.includes('aruba') || vendor.includes('ruckus') || vendor.includes('aerohive')) return 'router'

  // Apple — always macOS (iPhones/iPads use different OUI prefixes but still Apple Inc.)
  if (vendor.includes('apple')) return 'macos'

  // Android / mobile OUI vendors
  if (vendor.includes('samsung') || vendor.includes('oneplus') || vendor.includes('xiaomi') ||
      vendor.includes('huawei') || vendor.includes('google') || vendor.includes('motorola') ||
      vendor.includes('lg electronics') || vendor.includes('oppo') || vendor.includes('vivo') ||
      vendor.includes('realme') || vendor.includes('zte') || vendor.includes('alcatel') ||
      vendor.includes('tcl') || vendor.includes('wiko') || vendor.includes('fairphone')) return 'android'

  // Printer / MFP vendors
  if (vendor.includes('brother') || vendor.includes('epson') || vendor.includes('canon') ||
      vendor.includes('lexmark') || vendor.includes('xerox') || vendor.includes('kyocera') ||
      vendor.includes('ricoh') || vendor.includes('konica minolta') || vendor.includes('sharp') ||
      vendor.includes('oki data') || vendor.includes('samsung printer') || vendor.includes('toshiba tec') ||
      vendor.includes('pantum') || vendor.includes('sindoh') || vendor.includes('printronix') ||
      // HP: only match as printer when combined with printer-specific ports/services
      (vendor.includes('hewlett') && (ports.includes(9100) || services.includes('ipp'))) ||
      (vendor.includes('hp inc') && (ports.includes(9100) || services.includes('ipp')))) return 'printer'

  // IP camera / surveillance vendors
  if (vendor.includes('hikvision') || vendor.includes('dahua') || vendor.includes('axis') ||
      vendor.includes('vivotek') || vendor.includes('hanwha') || vendor.includes('bosch security') ||
      vendor.includes('pelco') || vendor.includes('genetec') || vendor.includes('mobotix') ||
      vendor.includes('avigilon') || vendor.includes('foscam') || vendor.includes('amcrest') ||
      vendor.includes('reolink') || vendor.includes('wyze') || vendor.includes('arlo')) return 'camera'

  // IoT / embedded vendors
  if (vendor.includes('espressif') || vendor.includes('arduino') || vendor.includes('raspberry') ||
      vendor.includes('particle') || vendor.includes('nordic semiconductor') ||
      vendor.includes('silicon labs') || vendor.includes('texas instruments') ||
      vendor.includes('microchip') || vendor.includes('atmel') || vendor.includes('stmicroelectronics') ||
      vendor.includes('tuya') || vendor.includes('shenzhen') || vendor.includes('pycom') ||
      vendor.includes('adafruit') || vendor.includes('sparkfun')) return 'iot'

  // Dell, HP (non-printer), Lenovo, etc. — could be server or Windows; use ports to decide
  if (vendor.includes('dell') || vendor.includes('lenovo') || vendor.includes('hewlett-packard') ||
      vendor.includes('hp inc') || vendor.includes('hewlett packard') || vendor.includes('intel') ||
      vendor.includes('super micro') || vendor.includes('supermicro') || vendor.includes('acer') ||
      vendor.includes('asus tek') || vendor.includes('gigabyte') || vendor.includes('msi')) {
    if (serverPorts.some(p => ports.includes(p))) return 'server'
    return 'windows'
  }

  // ── 3. Open ports / services (strong signals) ────────────────────────────
  if (ports.includes(9100) || services.includes('ipp') || services.includes('jetdirect')) return 'printer'
  if (services.includes('rtsp') || services.includes('onvif')) return 'camera'
  if (ports.includes(179) /* BGP */ || (ports.includes(161) && ports.includes(23))) return 'router'
  if (ports.includes(3389) || ports.includes(445) || services.includes('microsoft-ds') ||
      services.includes('msrpc')) return 'windows'

  // ── 4. OS detection (fallback — only when hostname/vendor/ports inconclusive) ──
  const os = (host.os?.name ?? '').toLowerCase()

  if (os.includes('router') || os.includes('cisco') || os.includes('juniper') ||
      os.includes('ios xe') || os.includes('ios xr') || os.includes('junos') ||
      os.includes('routeros') || os.includes('vyos') || os.includes('openwrt') ||
      os.includes('pfsense') || os.includes('fortios') || os.includes('pan-os') ||
      os.includes('checkpoint') || os.includes('screenos') || os.includes('sonicwall')) return 'router'

  if (os.includes('mac os') || os.includes('macos') || os.includes('darwin') ||
      os.includes('os x')) return 'macos'

  if (os.includes('windows')) return 'windows'

  if (os.includes('android')) return 'android'

  if (os.includes('printer') || os.includes('jetdirect') || os.includes('printserver')) return 'printer'

  // Linux distros — check server ports first to distinguish server vs workstation
  if (os.includes('linux') || os.includes('ubuntu') || os.includes('debian') ||
      os.includes('centos') || os.includes('rhel') || os.includes('red hat') ||
      os.includes('fedora') || os.includes('arch') || os.includes('manjaro') ||
      os.includes('opensuse') || os.includes('suse') || os.includes('gentoo') ||
      os.includes('slackware') || os.includes('void') || os.includes('alpine') ||
      os.includes('kali') || os.includes('parrot') || os.includes('mint') ||
      os.includes('elementary') || os.includes('pop!_os') || os.includes('nixos') ||
      os.includes('almalinux') || os.includes('rocky') || os.includes('oracle linux') ||
      os.includes('scientific linux') || os.includes('clear linux') ||
      os.includes('raspbian') || os.includes('armbian') || os.includes('openwrt')) {
    if (serverPorts.some(p => ports.includes(p))) return 'server'
    return 'linux'
  }

  if (os.includes('freertos') || os.includes('vxworks') || os.includes('lwip') ||
      os.includes('contiki') || os.includes('riot') || os.includes('zephyr') ||
      os.includes('mbed') || os.includes('threadx') || os.includes('embedded')) return 'iot'

  if (os.includes('vmware') || os.includes('esxi') || os.includes('proxmox') ||
      os.includes('xen') || os.includes('hyper-v') || os.includes('kvm')) return 'server'

  if (os.includes('freebsd') || os.includes('openbsd') || os.includes('netbsd') ||
      os.includes('dragonfly')) {
    if (serverPorts.some(p => ports.includes(p))) return 'server'
    return 'linux'   // BSD — closest visual match
  }

  // ── 5. Last-resort port inference ────────────────────────────────────────
  if (serverPorts.some(p => ports.includes(p))) return 'server'

  return 'unknown'
}

// SVG icon paths for each device type (drawn inside a 32×32 viewBox centred on 0,0)
function DeviceIcon({ type, x, y, r }: { type: DeviceType; x: number; y: number; r: number }) {
  const scale = r / 20
  const iconColor: Record<DeviceType, string> = {
    router:  '#f59e0b',
    switch:  '#8b5cf6',
    server:  '#3b82f6',
    windows: '#60a5fa',
    linux:   '#34d399',
    macos:   '#a78bfa',
    android: '#4ade80',
    printer: '#94a3b8',
    camera:  '#f87171',
    iot:     '#fb923c',
    unknown: '#6b7280',
  }
  const fill = iconColor[type]

  // Each icon is a simple recognisable glyph at the node centre
  switch (type) {
    case 'router':
      return (
        <g transform={`translate(${x},${y}) scale(${scale})`}>
          {/* diamond */}
          <polygon points="0,-10 10,0 0,10 -10,0" fill="none" stroke={fill} strokeWidth={1.8} />
          <circle cx={0} cy={0} r={3} fill={fill} />
        </g>
      )
    case 'server':
      return (
        <g transform={`translate(${x},${y}) scale(${scale})`}>
          {/* stacked rectangles */}
          <rect x={-8} y={-10} width={16} height={5} rx={1} fill="none" stroke={fill} strokeWidth={1.5} />
          <rect x={-8} y={-3}  width={16} height={5} rx={1} fill="none" stroke={fill} strokeWidth={1.5} />
          <rect x={-8} y={4}   width={16} height={5} rx={1} fill="none" stroke={fill} strokeWidth={1.5} />
          <circle cx={5} cy={-7.5} r={1.2} fill={fill} />
          <circle cx={5} cy={-0.5} r={1.2} fill={fill} />
          <circle cx={5} cy={6.5}  r={1.2} fill={fill} />
        </g>
      )
    case 'windows':
      return (
        <g transform={`translate(${x},${y}) scale(${scale})`}>
          {/* Windows flag */}
          <rect x={-9} y={-9} width={7} height={7} rx={0.5} fill={fill} opacity={0.9} />
          <rect x={2}  y={-9} width={7} height={7} rx={0.5} fill={fill} opacity={0.7} />
          <rect x={-9} y={2}  width={7} height={7} rx={0.5} fill={fill} opacity={0.7} />
          <rect x={2}  y={2}  width={7} height={7} rx={0.5} fill={fill} opacity={0.5} />
        </g>
      )
    case 'linux':
      return (
        <g transform={`translate(${x},${y}) scale(${scale})`}>
          {/* Tux outline */}
          <ellipse cx={0} cy={-4} rx={5} ry={6} fill="none" stroke={fill} strokeWidth={1.5} />
          <ellipse cx={0} cy={5}  rx={7} ry={5} fill="none" stroke={fill} strokeWidth={1.5} />
          <line x1={-5} y1={1} x2={-7} y2={8} stroke={fill} strokeWidth={1.5} />
          <line x1={5}  y1={1} x2={7}  y2={8} stroke={fill} strokeWidth={1.5} />
        </g>
      )
    case 'macos':
      return (
        <g transform={`translate(${x},${y}) scale(${scale})`}>
          {/* Apple logo-ish */}
          <path d="M0,-10 C4,-10 8,-6 8,0 C8,6 4,10 0,10 C-4,10 -8,6 -8,0 C-8,-6 -4,-10 0,-10 Z" fill="none" stroke={fill} strokeWidth={1.5} />
          <line x1={0} y1={-10} x2={3} y2={-13} stroke={fill} strokeWidth={1.2} />
        </g>
      )
    case 'android':
      return (
        <g transform={`translate(${x},${y}) scale(${scale})`}>
          {/* Robot head */}
          <rect x={-7} y={-4} width={14} height={10} rx={3} fill="none" stroke={fill} strokeWidth={1.5} />
          <circle cx={-3} cy={0} r={1.5} fill={fill} />
          <circle cx={3}  cy={0} r={1.5} fill={fill} />
          <line x1={-7} y1={-7} x2={-4} y2={-4} stroke={fill} strokeWidth={1.2} />
          <line x1={7}  y1={-7} x2={4}  y2={-4} stroke={fill} strokeWidth={1.2} />
        </g>
      )
    case 'printer':
      return (
        <g transform={`translate(${x},${y}) scale(${scale})`}>
          <rect x={-8} y={-6} width={16} height={10} rx={1} fill="none" stroke={fill} strokeWidth={1.5} />
          <rect x={-5} y={-10} width={10} height={5} rx={1} fill="none" stroke={fill} strokeWidth={1.2} />
          <rect x={-5} y={4}   width={10} height={6} rx={1} fill="none" stroke={fill} strokeWidth={1.2} />
          <line x1={-3} y1={7} x2={3} y2={7} stroke={fill} strokeWidth={1} />
        </g>
      )
    case 'camera':
      return (
        <g transform={`translate(${x},${y}) scale(${scale})`}>
          <rect x={-9} y={-6} width={18} height={12} rx={2} fill="none" stroke={fill} strokeWidth={1.5} />
          <circle cx={0} cy={0} r={4} fill="none" stroke={fill} strokeWidth={1.5} />
          <circle cx={0} cy={0} r={1.5} fill={fill} />
          <rect x={4} y={-8} width={4} height={3} rx={1} fill="none" stroke={fill} strokeWidth={1} />
        </g>
      )
    case 'iot':
      return (
        <g transform={`translate(${x},${y}) scale(${scale})`}>
          {/* Radio waves */}
          <circle cx={0} cy={0} r={3} fill={fill} />
          <path d="M-6,-6 A9,9 0 0,1 6,-6" fill="none" stroke={fill} strokeWidth={1.4} />
          <path d="M-9,-9 A13,13 0 0,1 9,-9" fill="none" stroke={fill} strokeWidth={1.2} />
          <line x1={0} y1={3} x2={0} y2={9} stroke={fill} strokeWidth={1.4} />
        </g>
      )
    default:
      return (
        <g transform={`translate(${x},${y}) scale(${scale})`}>
          <rect x={-8} y={-8} width={16} height={16} rx={2} fill="none" stroke={fill} strokeWidth={1.5} />
          <circle cx={0} cy={0} r={3} fill={fill} />
        </g>
      )
  }
}

// ── Module-level scan state (survives component unmount/remount) ───────────────

interface ScanState {
  scanning: boolean
  elapsed: number
  logs: string[]
  result: ScanResult | null
  error: string | null
  abort: AbortController | null
}

const _state: ScanState = {
  scanning: false,
  elapsed: 0,
  logs: [],
  result: null,
  error: null,
  abort: null,
}

type Listener = () => void
const _listeners = new Set<Listener>()
function notify() { _listeners.forEach(fn => fn()) }

function useScanState() {
  const [, rerender] = useState(0)
  useEffect(() => {
    const fn = () => rerender(n => n + 1)
    _listeners.add(fn)
    return () => { _listeners.delete(fn) }
  }, [])
  return _state
}

// ── Export helpers ────────────────────────────────────────────────────────────

interface ExportOptions {
  summary: boolean
  hosts: boolean
  portDetails: boolean
  scripts: boolean
  scanLog: boolean
  rawXml: boolean
}

function buildMarkdown(result: ScanResult, logs: string[], opts: ExportOptions): string {
  const liveHosts = result.hosts.filter(h => h.state === 'up')
  const date = new Date().toISOString().slice(0, 10)
  const lines: string[] = []

  lines.push('---')
  lines.push(`title: Nmap Scan — ${result.summary.command.replace(/^nmap\s+/, '').split(' ').pop() ?? 'scan'}`)
  lines.push(`date: ${date}`)
  lines.push('tags: [security, nmap, network-map]')
  lines.push('---')
  lines.push('')
  lines.push(`# Nmap Scan Results`)
  lines.push('')
  lines.push(`**Command:** \`${result.summary.command}\``)
  lines.push('')

  if (opts.summary) {
    lines.push('## Summary')
    lines.push('')
    lines.push('| Metric | Value |')
    lines.push('|--------|-------|')
    lines.push(`| Hosts Up | ${result.summary.hostsUp} |`)
    lines.push(`| Hosts Down | ${result.summary.hostsDown} |`)
    lines.push(`| Total Scanned | ${result.summary.hostsTotal} |`)
    if (result.summary.elapsed !== null)
      lines.push(`| Elapsed | ${result.summary.elapsed.toFixed(2)}s |`)
    lines.push('')
  }

  if (opts.hosts) {
    lines.push('## Live Hosts')
    lines.push('')
    lines.push('| IP | Hostname | MAC | Vendor | OS | Open Ports |')
    lines.push('|----|----------|-----|--------|----|------------|')
    for (const h of liveHosts) {
      const openPorts = h.ports.filter(p => p.state === 'open').map(p => `${p.port}/${p.protocol}`).join(', ')
      lines.push(`| \`${h.ip}\` | ${h.hostnames[0] ?? ''} | \`${h.mac}\` | ${h.vendor} | ${h.os?.name ?? ''} | ${openPorts} |`)
    }
    lines.push('')
  }

  if (opts.portDetails) {
    lines.push('## Port Details')
    lines.push('')
    for (const h of liveHosts) {
      const openPorts = h.ports.filter(p => p.state === 'open')
      if (openPorts.length === 0) continue
      lines.push(`### ${h.ip}${h.hostnames[0] ? ` (${h.hostnames[0]})` : ''}`)
      lines.push('')
      lines.push('| Port | Protocol | Service | Product | Version |')
      lines.push('|------|----------|---------|---------|---------|')
      for (const p of openPorts) {
        lines.push(`| ${p.port} | ${p.protocol} | ${p.service} | ${p.product} | ${p.version} |`)
      }
      lines.push('')
    }
  }

  if (opts.scripts) {
    const hostsWithScripts = liveHosts.filter(h => h.scripts.length > 0)
    if (hostsWithScripts.length > 0) {
      lines.push('## Script Results')
      lines.push('')
      for (const h of hostsWithScripts) {
        lines.push(`### ${h.ip}`)
        lines.push('')
        for (const s of h.scripts) {
          lines.push(`**${s.id}**`)
          lines.push('')
          lines.push('```')
          lines.push(s.output)
          lines.push('```')
          lines.push('')
        }
      }
    }
  }

  if (opts.scanLog && logs.length > 0) {
    lines.push('## Scan Log')
    lines.push('')
    lines.push('```')
    lines.push(logs.join('\n'))
    lines.push('```')
    lines.push('')
  }

  if (opts.rawXml) {
    lines.push('## Raw XML Output')
    lines.push('')
    lines.push('```xml')
    lines.push(result.rawXml)
    lines.push('```')
    lines.push('')
  }

  return lines.join('\n')
}

// ── Export Modal ──────────────────────────────────────────────────────────────

function ExportModal({
  result, logs, onClose,
}: { result: ScanResult; logs: string[]; onClose: () => void }) {
  const { index, createNote, saveNote, readNote, refreshIndex, rootHandle, fallbackMode } = useVaultStore()
  const vaultOpen = rootHandle !== null || fallbackMode

  const [mode, setMode]     = useState<'new' | 'append'>('new')
  const [newName, setNewName] = useState('nmap-scan')
  const [selectedPath, setSelectedPath] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState('')

  const [opts, setOpts] = useState<ExportOptions>({
    summary:     true,
    hosts:       true,
    portDetails: true,
    scripts:     true,
    scanLog:     false,
    rawXml:      false,
  })

  const toggle = (key: keyof ExportOptions) =>
    setOpts(o => ({ ...o, [key]: !o[key] }))

  const notes = Array.from(index.entries())
    .map(([path, note]) => ({ path, name: note.name }))
    .filter(({ name, path }) => {
      const q = search.toLowerCase()
      return !q || name.toLowerCase().includes(q) || path.toLowerCase().includes(q)
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const handleSave = async () => {
    if (!vaultOpen) { setError('Open a vault first'); return }
    setSaving(true)
    setError('')
    try {
      const content = buildMarkdown(result, logs, opts)
      if (mode === 'new') {
        const filename = newName.trim().replace(/\.md$/i, '')
        if (!filename) { setError('Enter a file name'); setSaving(false); return }
        await createNote(`Security/Nmap/${filename}.md`, content)
        await refreshIndex()
      } else {
        if (!selectedPath) { setError('Select a note'); setSaving(false); return }
        const existing = await readNote(selectedPath)
        await saveNote(selectedPath, existing + '\n\n---\n\n' + content)
      }
      setSaved(true)
      setTimeout(onClose, 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setSaving(false)
    }
  }

  const OPT_LABELS: { key: keyof ExportOptions; label: string }[] = [
    { key: 'summary',     label: 'Scan Summary' },
    { key: 'hosts',       label: 'Hosts Table' },
    { key: 'portDetails', label: 'Port Details' },
    { key: 'scripts',     label: 'Script Results' },
    { key: 'scanLog',     label: 'Scan Log' },
    { key: 'rawXml',      label: 'Raw XML' },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-surface-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-emerald-500" />
            <span className="font-semibold text-gray-800 dark:text-gray-100">Export Scan to Note</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {!vaultOpen && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-sm">
              <AlertCircle size={14} /> Open a vault first to save notes.
            </div>
          )}

          {/* What to include */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Include in export</p>
            <div className="grid grid-cols-2 gap-1.5">
              {OPT_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={opts[key]}
                    onChange={() => toggle(key)}
                    className="accent-emerald-500 w-3.5 h-3.5"
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* New / Append toggle */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setMode('new')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'new' ? 'bg-emerald-500 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700'}`}
            >New Note</button>
            <button
              onClick={() => setMode('append')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'append' ? 'bg-emerald-500 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700'}`}
            >Append to Existing</button>
          </div>

          {mode === 'new' ? (
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">
                File name <span className="font-normal text-gray-400">(saved under Security/Nmap/)</span>
              </label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="nmap-scan"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search notes..."
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                {notes.length === 0
                  ? <p className="p-3 text-sm text-gray-400">No notes found</p>
                  : notes.map(({ path, name }) => (
                    <button
                      key={path}
                      onClick={() => setSelectedPath(path)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${selectedPath === path ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700'}`}
                    >
                      <div className="font-medium truncate">{name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{path}</div>
                    </button>
                  ))
                }
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving || saved || !vaultOpen}
            className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
              saved ? 'bg-green-500 text-white' : 'bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white'
            } disabled:cursor-not-allowed`}
          >
            {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Interactive Network Topology ──────────────────────────────────────────────

interface NodePos { x: number; y: number }

const NODE_R = 22
const GW_R   = 16

function buildDefaultLayout(hosts: NmapHost[], w: number, h: number): Record<string, NodePos> {
  const cx = w / 2, cy = h / 2
  const radius = Math.min(w, h) * 0.35
  const positions: Record<string, NodePos> = {}
  positions['__gw__'] = { x: cx, y: cy }
  hosts.forEach((host, i) => {
    const angle = (i / Math.max(hosts.length, 1)) * 2 * Math.PI - Math.PI / 2
    positions[host.ip] = {
      x: hosts.length === 1 ? cx : cx + radius * Math.cos(angle),
      y: hosts.length === 1 ? cy + radius * 0.5 : cy + radius * Math.sin(angle),
    }
  })
  return positions
}

function NetworkTopology({ hosts }: { hosts: NmapHost[] }) {
  const svgRef    = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [dims, setDims] = useState({ w: 800, h: 500 })
  const [positions, setPositions] = useState<Record<string, NodePos>>(() =>
    buildDefaultLayout(hosts, 800, 500))
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [dragging, setDragging] = useState<string | null>(null)
  const [panning,  setPanning]  = useState(false)
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)
  const panStart  = useRef<{ mx: number; my: number; tx: number; ty: number } | null>(null)

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDims({ w: width, h: height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Rebuild layout when hosts change
  useEffect(() => {
    setPositions(buildDefaultLayout(hosts, dims.w, dims.h))
    setTransform({ x: 0, y: 0, scale: 1 })
  }, [hosts.map(h => h.ip).join(','), dims.w, dims.h]) // eslint-disable-line react-hooks/exhaustive-deps

  const autoFit = useCallback(() => {
    if (hosts.length === 0) return
    const allPos = Object.values(positions)
    const minX = Math.min(...allPos.map(p => p.x)) - NODE_R - 20
    const maxX = Math.max(...allPos.map(p => p.x)) + NODE_R + 20
    const minY = Math.min(...allPos.map(p => p.y)) - NODE_R - 20
    const maxY = Math.max(...allPos.map(p => p.y)) + NODE_R + 20
    const fw = maxX - minX, fh = maxY - minY
    const scale = Math.min(dims.w / fw, dims.h / fh, 2)
    const x = (dims.w - fw * scale) / 2 - minX * scale
    const y = (dims.h - fh * scale) / 2 - minY * scale
    setTransform({ x, y, scale })
  }, [positions, dims])

  const resetLayout = () => {
    setPositions(buildDefaultLayout(hosts, dims.w, dims.h))
    setTransform({ x: 0, y: 0, scale: 1 })
  }

  // Wheel zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const rect = svgRef.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    setTransform(t => {
      const newScale = Math.max(0.1, Math.min(5, t.scale * factor))
      return {
        scale: newScale,
        x: mx - (mx - t.x) * (newScale / t.scale),
        y: my - (my - t.y) * (newScale / t.scale),
      }
    })
  }

  // Pointer events for node drag and canvas pan
  const onPointerDown = (e: React.PointerEvent, nodeId: string | null) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    if (nodeId) {
      const pos = positions[nodeId]
      dragStart.current = { mx: e.clientX, my: e.clientY, ox: pos.x, oy: pos.y }
      setDragging(nodeId)
    } else {
      panStart.current = { mx: e.clientX, my: e.clientY, tx: transform.x, ty: transform.y }
      setPanning(true)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging && dragStart.current) {
      const dx = (e.clientX - dragStart.current.mx) / transform.scale
      const dy = (e.clientY - dragStart.current.my) / transform.scale
      setPositions(p => ({ ...p, [dragging]: { x: dragStart.current!.ox + dx, y: dragStart.current!.oy + dy } }))
    } else if (panning && panStart.current) {
      setTransform(t => ({
        ...t,
        x: panStart.current!.tx + (e.clientX - panStart.current!.mx),
        y: panStart.current!.ty + (e.clientY - panStart.current!.my),
      }))
    }
  }

  const onPointerUp = () => {
    setDragging(null)
    setPanning(false)
    dragStart.current = null
    panStart.current  = null
  }

  const gw = positions['__gw__'] ?? { x: dims.w / 2, y: dims.h / 2 }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-700 bg-gray-800/40 shrink-0">
        <span className="text-xs text-gray-500 mr-1">Topology</span>
        <button onClick={() => setTransform(t => ({ ...t, scale: Math.min(5, t.scale * 1.2) }))}
          className="px-2 py-0.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300">+</button>
        <button onClick={() => setTransform(t => ({ ...t, scale: Math.max(0.1, t.scale / 1.2) }))}
          className="px-2 py-0.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300">−</button>
        <button onClick={autoFit}
          className="px-2 py-0.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300">Fit</button>
        <button onClick={resetLayout}
          className="px-2 py-0.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300">Reset</button>
        <span className="ml-2 text-xs text-gray-600">{Math.round(transform.scale * 100)}%</span>
        <span className="ml-3 text-xs text-gray-700">scroll=zoom · drag node=move · drag bg=pan</span>
      </div>

      {/* SVG canvas */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          onWheel={onWheel}
          onPointerDown={e => onPointerDown(e, null)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ cursor: panning ? 'grabbing' : 'grab', userSelect: 'none' }}
        >
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
            {/* Edges */}
            {hosts.map(host => {
              const pos = positions[host.ip]
              if (!pos) return null
              return (
                <line key={`edge-${host.ip}`}
                  x1={gw.x} y1={gw.y} x2={pos.x} y2={pos.y}
                  stroke="#374151" strokeWidth={1.5 / transform.scale} />
              )
            })}

            {/* Gateway node */}
            <g onPointerDown={e => onPointerDown(e, '__gw__')}
               style={{ cursor: 'move' }}>
              <circle cx={gw.x} cy={gw.y} r={GW_R} fill="#1f2937" stroke="#6b7280" strokeWidth={1.5} />
              <text x={gw.x} y={gw.y - GW_R - 6} textAnchor="middle" fontSize={10} fill="#9ca3af">Gateway</text>
              {/* Router glyph */}
              <polygon points={`${gw.x},${gw.y - 8} ${gw.x + 8},${gw.y} ${gw.x},${gw.y + 8} ${gw.x - 8},${gw.y}`}
                fill="none" stroke="#f59e0b" strokeWidth={1.5} />
              <circle cx={gw.x} cy={gw.y} r={2.5} fill="#f59e0b" />
            </g>

            {/* Host nodes */}
            {hosts.map(host => {
              const pos = positions[host.ip]
              if (!pos) return null
              const devType = inferDeviceType(host)
              const isDragging = dragging === host.ip
              const openCount = host.ports.filter(p => p.state === 'open').length
              const label = host.ip.split('.').slice(-2).join('.')

              return (
                <g key={host.ip}
                   onPointerDown={e => onPointerDown(e, host.ip)}
                   style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
                  <circle
                    cx={pos.x} cy={pos.y} r={NODE_R}
                    fill="#1f2937"
                    stroke={isDragging ? '#10b981' : '#374151'}
                    strokeWidth={isDragging ? 2 : 1.5}
                  />
                  <DeviceIcon type={devType} x={pos.x} y={pos.y} r={NODE_R} />
                  {/* IP label */}
                  <text x={pos.x} y={pos.y + NODE_R + 12} textAnchor="middle"
                        fontSize={9} fill="#34d399" fontFamily="monospace">
                    {label}
                  </text>
                  {/* Port count badge */}
                  {openCount > 0 && (
                    <text x={pos.x} y={pos.y + NODE_R + 22} textAnchor="middle"
                          fontSize={7} fill="#6b7280">
                      {openCount}p
                    </text>
                  )}
                  {/* Hostname */}
                  {host.hostnames[0] && (
                    <text x={pos.x} y={pos.y - NODE_R - 6} textAnchor="middle"
                          fontSize={7} fill="#6b7280">
                      {host.hostnames[0].length > 18 ? host.hostnames[0].slice(0, 18) + '…' : host.hostnames[0]}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>

        {/* Legend */}
        {hosts.length > 0 && (
          <div className="absolute bottom-2 right-2 bg-gray-900/90 border border-gray-700 rounded p-2 text-xs space-y-0.5">
            {Array.from(new Set(hosts.map(inferDeviceType))).map(dt => (
              <div key={dt} className="flex items-center gap-1.5">
                <svg width={14} height={14} viewBox="-7 -7 14 14">
                  <DeviceIcon type={dt} x={0} y={0} r={7} />
                </svg>
                <span className="text-gray-400 capitalize">{dt}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HostCard({ host, selected, onClick }: { host: NmapHost; selected: boolean; onClick: () => void }) {
  const openPorts = host.ports.filter(p => p.state === 'open')
  const devType   = inferDeviceType(host)
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        selected ? 'border-emerald-500 bg-emerald-900/20' : 'border-gray-600 bg-gray-800 hover:border-gray-500'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <svg width={16} height={16} viewBox="-10 -10 20 20" className="shrink-0">
          <DeviceIcon type={devType} x={0} y={0} r={10} />
        </svg>
        <span className="font-mono text-sm font-semibold text-emerald-400 truncate">{host.ip || '(unknown)'}</span>
        <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 shrink-0">up</span>
      </div>
      {host.hostnames.length > 0 && <div className="text-xs text-gray-400 truncate">{host.hostnames[0]}</div>}
      {host.vendor && <div className="text-xs text-gray-500">{host.vendor}</div>}
      {host.os && <div className="text-xs text-blue-400 truncate mt-0.5">{host.os.name}</div>}
      {openPorts.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {openPorts.slice(0, 6).map(p => (
            <span key={`${p.protocol}-${p.port}`} className={`text-xs font-mono ${serviceColor(p.service)}`}>
              {p.port}/{p.protocol}
            </span>
          ))}
          {openPorts.length > 6 && <span className="text-xs text-gray-500">+{openPorts.length - 6}</span>}
        </div>
      )}
    </button>
  )
}

function HostDetail({ host }: { host: NmapHost }) {
  const openPorts     = host.ports.filter(p => p.state === 'open')
  const filteredPorts = host.ports.filter(p => p.state !== 'open')
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Host Identity</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <span className="text-gray-500">IP</span>
          <span className="font-mono text-emerald-400">{host.ip}</span>
          <span className="text-gray-500">Type</span>
          <span className="text-gray-300 capitalize">{inferDeviceType(host)}</span>
          {host.mac && <><span className="text-gray-500">MAC</span><span className="font-mono text-gray-300">{host.mac}</span></>}
          {host.vendor && <><span className="text-gray-500">Vendor</span><span className="text-gray-300">{host.vendor}</span></>}
          {host.hostnames.length > 0 && <><span className="text-gray-500">Hostname(s)</span><span className="text-gray-300">{host.hostnames.join(', ')}</span></>}
          {host.os && <><span className="text-gray-500">OS</span><span className="text-blue-400">{host.os.name} ({host.os.accuracy}% confidence)</span></>}
        </div>
      </div>
      {openPorts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Open Ports ({openPorts.length})</h3>
          <div className="space-y-1">
            {openPorts.map(p => (
              <div key={`${p.protocol}-${p.port}`} className="flex items-baseline gap-2 text-xs py-1 border-b border-gray-700/50">
                <span className={`font-mono w-16 shrink-0 ${serviceColor(p.service)}`}>{p.port}/{p.protocol}</span>
                <span className="text-gray-300 w-20 shrink-0">{p.service}</span>
                <span className="text-gray-400 truncate">{[p.product, p.version, p.extrainfo].filter(Boolean).join(' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {filteredPorts.length > 0 && (
        <div className="text-xs text-gray-600">{filteredPorts.length} filtered/closed port{filteredPorts.length !== 1 ? 's' : ''}</div>
      )}
      {host.scripts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Script Results</h3>
          <div className="space-y-2">
            {host.scripts.map((s, i) => (
              <div key={i} className="text-xs">
                <div className="text-yellow-400 font-mono mb-0.5">{s.id}</div>
                <pre className="text-gray-400 whitespace-pre-wrap break-all bg-gray-900 rounded p-2">{s.output}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────

function NmapLegalDisclaimer({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-900 p-8">
      <div className="max-w-2xl w-full bg-gray-800 border border-yellow-600/60 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 bg-yellow-900/30 border-b border-yellow-600/40">
          <AlertCircle size={20} className="text-yellow-400 shrink-0" />
          <span className="text-yellow-300 font-semibold text-base">Legal Disclaimer — Nmap Network Scanner</span>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 text-sm text-gray-300 leading-relaxed">
          <p>
            <strong className="text-white">Unauthorized network scanning is illegal.</strong> Using Nmap against
            systems, networks, or IP ranges you do not own or have explicit written permission to test may
            violate the <em>Computer Fraud and Abuse Act (CFAA)</em>, the <em>Computer Misuse Act</em>,
            and equivalent laws in your jurisdiction. Violations can result in criminal prosecution and
            civil liability.
          </p>

          <div className="bg-gray-900/60 rounded p-4 space-y-2 border border-gray-700">
            <p className="text-yellow-300 font-medium">You must only scan:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-300">
              <li>Networks and systems you own</li>
              <li>Systems you have explicit written authorization to test (e.g. a signed pentest agreement)</li>
              <li>Isolated lab or CTF environments intended for testing</li>
            </ul>
          </div>

          <p>
            This tool is provided for <strong className="text-white">authorized security testing, network
            administration, and educational purposes only.</strong> The authors and this application accept
            no liability for misuse. You are solely responsible for ensuring your actions are lawful.
          </p>

          <p className="text-gray-500 text-xs">
            See also: <span className="text-gray-400">nmap.org/book/legal-issues.html</span>
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-900/40 border-t border-gray-700 flex items-center justify-between gap-4">
          <span className="text-xs text-gray-500">By clicking "I Understand" you confirm you have authorization to scan the target(s).</span>
          <button
            onClick={onAccept}
            className="shrink-0 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-sm font-semibold text-white transition-colors"
          >
            I Understand — Continue
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NetworkMapView() {
  const state = useScanState()

  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false)
  const [target, setTarget]   = useState('')
  const [scanType, setScanType] = useState<ScanType>('ping')
  const [ports, setPorts]     = useState('')
  const [timing, setTiming]   = useState('T3')
  const [logOpen, setLogOpen] = useState(true)
  const [selectedHost, setSelectedHost] = useState<NmapHost | null>(null)
  const [activeTab, setActiveTab] = useState<'hosts' | 'topology' | 'raw'>('hosts')
  const [showExport, setShowExport] = useState(false)

  const progressEndRef = useRef<HTMLDivElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (logOpen) progressEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.logs.length, logOpen])

  useEffect(() => {
    if (state.scanning) {
      timerRef.current = setInterval(() => { _state.elapsed += 1; notify() }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [state.scanning])

  const startScan = useCallback(async () => {
    if (!target.trim() || _state.scanning) return
    if (_state.logs.length > 0) _state.logs.push(`── New scan: ${target.trim()} ──────────────────────`)
    _state.scanning = true
    _state.elapsed  = 0
    _state.result   = null
    _state.error    = null
    _state.abort    = new AbortController()
    notify()

    try {
      const resp = await fetch('/security/nmap/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: target.trim(), scanType, ports, timing }),
        signal: _state.abort.signal,
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }))
        _state.error = err.error || 'Scan failed'; notify(); return
      }
      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const msg = JSON.parse(line.slice(6))
            if (msg.type === 'progress') { _state.logs.push(msg.message); notify() }
            else if (msg.type === 'result') { _state.result = { hosts: msg.hosts, summary: msg.summary, rawXml: msg.rawXml }; notify() }
            else if (msg.type === 'error') { _state.error = msg.message; _state.logs.push(`ERROR: ${msg.message}`); notify() }
          } catch {}
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') { _state.error = e.message; _state.logs.push(`ERROR: ${e.message}`); notify() }
    } finally {
      _state.scanning = false; _state.abort = null; notify()
    }
  }, [target, scanType, ports, timing])

  const stopScan = () => {
    _state.abort?.abort()
    _state.scanning = false
    _state.logs.push('── Scan stopped by user ──')
    notify()
  }

  const clearAll = () => {
    if (_state.scanning) return
    _state.logs = []; _state.result = null; _state.error = null; _state.elapsed = 0
    notify()
  }

  const liveHosts = state.result?.hosts.filter(h => h.state === 'up') ?? []

  if (!disclaimerAccepted) {
    return <NmapLegalDisclaimer onAccept={() => setDisclaimerAccepted(true)} />
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-900 text-gray-100">
      {showExport && state.result && (
        <ExportModal result={state.result} logs={state.logs} onClose={() => setShowExport(false)} />
      )}

      {/* ── Config Panel ── */}
      <div className="border-b border-gray-700 p-4 bg-gray-800/50 space-y-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 text-sm font-semibold">nmap</span>
          <span className="text-gray-600 text-xs">Network Map</span>
          {state.scanning && <span className="ml-2 text-xs text-emerald-400 animate-pulse">● scanning {state.elapsed}s</span>}
          {state.result && !state.scanning && (
            <button
              onClick={() => setShowExport(true)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 transition-colors"
            >
              <BookOpen size={12} /> Export to Note
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={target}
            onChange={e => setTarget(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !state.scanning && startScan()}
            placeholder="Target: 192.168.1.0/24, 10.0.0.1, hostname"
            className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-emerald-500"
            disabled={state.scanning}
          />
          {!state.scanning ? (
            <button onClick={startScan} disabled={!target.trim()}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded text-sm font-medium transition-colors">
              Scan
            </button>
          ) : (
            <button onClick={stopScan}
              className="px-4 py-1.5 bg-red-700 hover:bg-red-600 rounded text-sm font-medium transition-colors">
              Stop
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Scan Type</label>
            <div className="flex flex-wrap gap-1">
              {SCAN_TYPES.map(st => (
                <button key={st.id} onClick={() => setScanType(st.id)} title={st.description}
                  disabled={state.scanning}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    scanType === st.id
                      ? 'bg-emerald-700 text-emerald-100 border border-emerald-500'
                      : 'bg-gray-700 text-gray-400 border border-transparent hover:bg-gray-600'
                  }`}>
                  {st.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Ports (optional)</label>
            <input value={ports} onChange={e => setPorts(e.target.value)}
              placeholder="e.g. 80,443,8080-8090" disabled={state.scanning}
              className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-emerald-500 w-40" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Timing</label>
            <select value={timing} onChange={e => setTiming(e.target.value)} disabled={state.scanning}
              className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500">
              <option value="T0">T0 – Paranoid</option>
              <option value="T1">T1 – Sneaky</option>
              <option value="T2">T2 – Polite</option>
              <option value="T3">T3 – Normal</option>
              <option value="T4">T4 – Aggressive</option>
              <option value="T5">T5 – Insane</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* Scan Log */}
        {state.logs.length > 0 && (
          <div className="border-b border-gray-700 shrink-0">
            <button onClick={() => setLogOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-1.5 bg-gray-800/60 hover:bg-gray-800 text-xs text-gray-400 transition-colors">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-300">Scan Log</span>
                <span className="text-gray-600">{state.logs.length} lines</span>
                {state.scanning && <span className="text-emerald-400 animate-pulse">● live</span>}
              </div>
              <div className="flex items-center gap-3">
                {!state.scanning && (
                  <span role="button" onClick={e => { e.stopPropagation(); clearAll() }}
                    className="text-gray-600 hover:text-gray-400 transition-colors" title="Clear log and results">
                    clear
                  </span>
                )}
                <span className="text-gray-600">{logOpen ? '▲' : '▼'}</span>
              </div>
            </button>
            {logOpen && (
              <div className="max-h-52 overflow-y-auto bg-gray-950 p-3 space-y-0.5">
                {state.logs.map((line, i) => {
                  const isSep = line.startsWith('──')
                  const isErr = line.startsWith('ERROR:')
                  return (
                    <div key={i} className={`text-xs font-mono leading-5 ${isSep ? 'text-gray-600 pt-1' : isErr ? 'text-red-400' : 'text-gray-400'}`}>
                      {!isSep && <span className="text-gray-700 select-none">{'> '}</span>}
                      {line}
                    </div>
                  )
                })}
                {state.scanning && <div className="text-xs font-mono text-emerald-500 animate-pulse leading-5">{'> '}&hellip;</div>}
                <div ref={progressEndRef} />
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {state.error && (
          <div className="mx-4 mt-3 p-3 bg-red-900/30 border border-red-700 rounded text-sm text-red-300 shrink-0">
            {state.error}
          </div>
        )}

        {/* Results */}
        {state.result && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-4 py-2 border-b border-gray-700 bg-gray-800/30 flex items-center gap-4 text-xs shrink-0 flex-wrap">
              <span className="text-gray-400 font-mono truncate max-w-xs" title={state.result.summary.command}>
                {state.result.summary.command}
              </span>
              <span className="text-emerald-400">{liveHosts.length} live</span>
              {state.result.summary.hostsDown > 0 && <span className="text-gray-600">{state.result.summary.hostsDown} down (hidden)</span>}
              <span className="text-gray-600">{state.result.summary.hostsTotal} total</span>
              {state.result.summary.elapsed !== null && <span className="text-gray-600">{state.result.summary.elapsed.toFixed(2)}s</span>}

              <div className="ml-auto flex gap-1">
                {(['hosts', 'topology', 'raw'] as const).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)}
                    className={`px-2 py-0.5 rounded text-xs ${activeTab === t ? 'bg-emerald-800 text-emerald-200' : 'text-gray-500 hover:text-gray-300'}`}>
                    {t === 'hosts' ? `Hosts (${liveHosts.length})` : t === 'topology' ? 'Topology' : 'Raw XML'}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'hosts' && (
              <div className="flex-1 overflow-hidden flex">
                <div className="w-64 shrink-0 overflow-y-auto p-3 space-y-2 border-r border-gray-700">
                  {liveHosts.length === 0 && <div className="text-xs text-gray-600 text-center mt-8">No live hosts found</div>}
                  {liveHosts.map((h, i) => (
                    <HostCard key={i} host={h} selected={selectedHost?.ip === h.ip} onClick={() => setSelectedHost(h)} />
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {selectedHost
                    ? <HostDetail host={selectedHost} />
                    : <div className="flex items-center justify-center h-full text-gray-600 text-sm">Select a host to view details</div>
                  }
                </div>
              </div>
            )}

            {activeTab === 'topology' && (
              <div className="flex-1 overflow-hidden">
                {liveHosts.length === 0
                  ? <div className="flex items-center justify-center h-full text-gray-600 text-sm">No live hosts to map</div>
                  : <NetworkTopology hosts={liveHosts} />
                }
              </div>
            )}

            {activeTab === 'raw' && (
              <div className="flex-1 overflow-auto p-4">
                <pre className="text-xs font-mono text-gray-400 whitespace-pre-wrap break-all">{state.result.rawXml}</pre>
              </div>
            )}
          </div>
        )}

        {!state.scanning && !state.result && !state.error && state.logs.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 space-y-3">
            <div className="text-4xl">🗺️</div>
            <div className="text-gray-400 text-sm">Enter a target and click Scan to map the network</div>
            <div className="text-gray-600 text-xs">
              Examples: <code className="font-mono">192.168.1.0/24</code> · <code className="font-mono">10.0.0.1-254</code> · <code className="font-mono">hostname</code>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
