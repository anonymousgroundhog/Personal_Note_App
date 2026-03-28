import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Settings, RefreshCw, ExternalLink, Map, X, Check, Keyboard, Server, Download, Copy, ChevronDown, ChevronUp, Terminal } from 'lucide-react'

const STORAGE_KEY = 'minecraft-map-config'

interface MapConfig {
  ip: string
  port: string
}

function loadConfig(): MapConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as MapConfig
  } catch {}
  return { ip: '', port: '8123' }
}

function saveConfig(cfg: MapConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)) } catch {}
}

function buildUrl(ip: string, port: string): string {
  const host = ip.trim()
  const p = port.trim()
  if (!host) return ''
  return p ? `http://${host}:${p}` : `http://${host}`
}

// ── Settings panel ────────────────────────────────────────────────────────────

function SettingsPanel({
  config,
  onSave,
  onClose,
}: {
  config: MapConfig
  onSave: (cfg: MapConfig) => void
  onClose: () => void
}) {
  const [ip, setIp] = useState(config.ip)
  const [port, setPort] = useState(config.port)

  const handleSave = () => {
    const cfg = { ip: ip.trim(), port: port.trim() }
    saveConfig(cfg)
    onSave(cfg)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-surface-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-900">
          <div className="flex items-center gap-2">
            <MinecraftIcon className="w-5 h-5 text-green-500" />
            <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Minecraft Map Settings</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-surface-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Enter the address of your Minecraft map viewer. This is typically a
            {' '}<strong className="text-gray-700 dark:text-gray-300">Dynmap</strong>,{' '}
            <strong className="text-gray-700 dark:text-gray-300">BlueMap</strong>, or{' '}
            <strong className="text-gray-700 dark:text-gray-300">Squaremap</strong> web server
            running alongside your Minecraft server.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Server IP / Hostname
              </label>
              <input
                type="text"
                value={ip}
                onChange={e => setIp(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="192.168.1.100  or  mc.example.com"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-700 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-green-500 dark:focus:border-green-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Port
              </label>
              <input
                type="text"
                value={port}
                onChange={e => setPort(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="8123"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-700 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-green-500 dark:focus:border-green-500"
              />
              <p className="mt-1 text-xs text-gray-400">Default: 8123 (Dynmap), 8100 (BlueMap), 8080 (Squaremap)</p>
            </div>

            {ip.trim() && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-surface-700 text-xs text-gray-500 dark:text-gray-400 font-mono">
                <span className="text-gray-400">URL:</span>
                <span className="text-green-600 dark:text-green-400 truncate">{buildUrl(ip, port)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-900">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-surface-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!ip.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            <Check size={14} />
            Save & Load
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Minecraft grass-block icon (SVG) ─────────────────────────────────────────

function MinecraftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Dirt base */}
      <rect x="2" y="14" width="20" height="8" rx="1" fill="#8B6340" />
      {/* Grass top */}
      <rect x="2" y="2" width="20" height="14" rx="1" fill="#5D9E3A" />
      {/* Grass highlight */}
      <rect x="2" y="12" width="20" height="3" fill="#4A8A2A" />
      {/* Pixel details */}
      <rect x="4" y="4" width="3" height="3" fill="#6DB542" opacity="0.6" />
      <rect x="10" y="5" width="2" height="2" fill="#6DB542" opacity="0.6" />
      <rect x="16" y="4" width="3" height="3" fill="#6DB542" opacity="0.6" />
    </svg>
  )
}

// ── Controls reference ────────────────────────────────────────────────────────

interface ControlEntry {
  keys: string[]
  action: string
}

interface ControlSection {
  title: string
  controls: ControlEntry[]
}

const CONTROL_SECTIONS: ControlSection[] = [
  {
    title: 'Movement',
    controls: [
      { keys: ['W'], action: 'Move forward' },
      { keys: ['S'], action: 'Move backward' },
      { keys: ['A'], action: 'Strafe left' },
      { keys: ['D'], action: 'Strafe right' },
      { keys: ['Space'], action: 'Jump / Swim up / Fly up' },
      { keys: ['Shift'], action: 'Sneak / Fly down / Dismount' },
      { keys: ['Ctrl'], action: 'Sprint (hold)' },
      { keys: ['W', 'W'], action: 'Toggle sprint (double-tap)' },
      { keys: ['Space', 'Space'], action: 'Toggle fly (double-tap, Creative)' },
    ],
  },
  {
    title: 'Camera',
    controls: [
      { keys: ['Mouse'], action: 'Look around' },
      { keys: ['F5'], action: 'Cycle camera perspective (1st / 3rd / front)' },
      { keys: ['Scroll'], action: 'Zoom (Spyglass) / Scroll hotbar' },
    ],
  },
  {
    title: 'Interaction',
    controls: [
      { keys: ['LMB'], action: 'Attack / Break block (hold)' },
      { keys: ['RMB'], action: 'Use item / Place block / Interact' },
      { keys: ['MMB'], action: 'Pick block (copies block to hand)' },
      { keys: ['Q'], action: 'Drop held item' },
      { keys: ['Ctrl', 'Q'], action: 'Drop entire stack' },
      { keys: ['F'], action: 'Swap item with off-hand' },
    ],
  },
  {
    title: 'Inventory & UI',
    controls: [
      { keys: ['E'], action: 'Open / close inventory' },
      { keys: ['1–9'], action: 'Select hotbar slot' },
      { keys: ['Shift', 'Click'], action: 'Quick-move stack to/from inventory' },
      { keys: ['Ctrl', 'Click'], action: 'Move all matching items' },
      { keys: ['Drag (LMB)'], action: 'Spread stack across slots' },
      { keys: ['Drag (RMB)'], action: 'Place one item per slot' },
      { keys: ['Esc'], action: 'Open game menu / Close UI' },
    ],
  },
  {
    title: 'Combat',
    controls: [
      { keys: ['LMB'], action: 'Attack (wait for cooldown star)' },
      { keys: ['RMB'], action: 'Block with shield / Draw bow / Charge crossbow' },
      { keys: ['Shift', 'RMB'], action: 'Use item while sneaking' },
      { keys: ['W', 'LMB'], action: 'Sprint-attack (knockback)' },
      { keys: ['↓ + LMB'], action: 'Critical hit (attack while falling)' },
    ],
  },
  {
    title: 'Chat & Commands',
    controls: [
      { keys: ['T'], action: 'Open chat' },
      { keys: ['/'], action: 'Open chat pre-filled with /' },
      { keys: ['↑ / ↓'], action: 'Cycle through chat history' },
      { keys: ['Tab'], action: 'Auto-complete command / username' },
    ],
  },
  {
    title: 'Map & Navigation',
    controls: [
      { keys: ['F3'], action: 'Toggle debug screen (shows coords, biome, FPS)' },
      { keys: ['F3', 'B'], action: 'Toggle hitbox display' },
      { keys: ['F3', 'G'], action: 'Toggle chunk border display' },
      { keys: ['F3', 'H'], action: 'Toggle advanced item tooltips' },
      { keys: ['F3', 'N'], action: 'Toggle Spectator / Creative (if permission)' },
    ],
  },
  {
    title: 'Display & Performance',
    controls: [
      { keys: ['F1'], action: 'Hide HUD' },
      { keys: ['F2'], action: 'Take screenshot' },
      { keys: ['F11'], action: 'Toggle fullscreen' },
      { keys: ['F8'], action: 'Toggle mouse smoothing' },
      { keys: ['F10'], action: 'Release mouse cursor' },
    ],
  },
  {
    title: 'Multiplayer',
    controls: [
      { keys: ['Tab'], action: 'Show player list (hold)' },
      { keys: ['T'], action: 'Chat' },
      { keys: ['/'], action: 'Command prompt' },
    ],
  },
]

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-gray-500 bg-gray-700 text-gray-200 text-xs font-mono leading-none min-w-[1.5rem]">
      {children}
    </kbd>
  )
}

function ControlsTab() {
  return (
    <div className="flex-1 overflow-y-auto p-5 bg-gray-900">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <Keyboard size={18} className="text-green-400" />
          <h1 className="text-base font-semibold text-gray-100">PC Controls Reference</h1>
          <span className="text-xs text-gray-500">Java & Bedrock Edition (default keybinds)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {CONTROL_SECTIONS.map(section => (
            <div
              key={section.title}
              className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden"
            >
              <div className="px-4 py-2.5 bg-gray-750 border-b border-gray-700 bg-gray-900/60">
                <h2 className="text-xs font-semibold text-green-400 uppercase tracking-wider">{section.title}</h2>
              </div>
              <div className="divide-y divide-gray-700/50">
                {section.controls.map((ctrl, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="text-xs text-gray-300 leading-snug">{ctrl.action}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {ctrl.keys.map((k, ki) => (
                        <React.Fragment key={ki}>
                          {ki > 0 && <span className="text-gray-600 text-xs">+</span>}
                          <Kbd>{k}</Kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-600 pb-4">
          Default keybinds — rebind anything in <span className="text-gray-400">Options → Controls → Key Binds</span>.
        </p>
      </div>
    </div>
  )
}

// ── Server Setup Tab ──────────────────────────────────────────────────────────

type ServerSoftware = 'paper' | 'spigot' | 'fabric' | 'forge' | 'vanilla'
type McVersion = '1.21.4' | '1.21.1' | '1.20.6' | '1.20.4' | '1.20.1' | '1.19.4'
type ServerOs = 'linux' | 'windows' | 'macos'

interface Plugin {
  id: string
  name: string
  category: string
  description: string
  url: string
  modrinth?: string
  spigotId?: string
  compatible: ServerSoftware[]
  recommended?: boolean
}

const PLUGINS: Plugin[] = [
  // Admin & Essentials
  {
    id: 'essentialsx', name: 'EssentialsX', category: 'Admin & Essentials',
    description: 'Core commands: /home, /warp, /tp, /kit, economy, chat formatting, and 100+ more essential commands.',
    url: 'https://essentialsx.net/downloads.html', modrinth: 'essentialsx',
    compatible: ['paper', 'spigot'], recommended: true,
  },
  {
    id: 'luckperms', name: 'LuckPerms', category: 'Admin & Essentials',
    description: 'The most powerful permissions plugin. Groups, tracks, prefixes, per-server/world permissions.',
    url: 'https://luckperms.net/download', modrinth: 'luckperms',
    compatible: ['paper', 'spigot', 'fabric', 'forge'], recommended: true,
  },
  {
    id: 'vault', name: 'Vault', category: 'Admin & Essentials',
    description: 'Economy, permissions, and chat API bridge. Required by many other plugins.',
    url: 'https://www.spigotmc.org/resources/vault.34315/', spigotId: '34315',
    compatible: ['paper', 'spigot'], recommended: true,
  },
  {
    id: 'worldedit', name: 'WorldEdit', category: 'Building & World',
    description: 'In-game map editor. Select regions, copy/paste, generate shapes, run brushes.',
    url: 'https://modrinth.com/plugin/worldedit', modrinth: 'worldedit',
    compatible: ['paper', 'spigot', 'fabric', 'forge'], recommended: true,
  },
  {
    id: 'worldguard', name: 'WorldGuard', category: 'Protection',
    description: 'Protect regions, control flags (PvP, mob spawning, fire spread) per region.',
    url: 'https://dev.bukkit.org/projects/worldguard', modrinth: 'worldguard',
    compatible: ['paper', 'spigot'], recommended: true,
  },
  {
    id: 'coreprotect', name: 'CoreProtect', category: 'Admin & Essentials',
    description: 'Fast block logging and rollback. Investigate and undo grief with /co lookup.',
    url: 'https://modrinth.com/plugin/coreprotect', modrinth: 'coreprotect',
    compatible: ['paper', 'spigot'], recommended: true,
  },
  // Economy
  {
    id: 'shopguiplus', name: 'ShopGUI+', category: 'Economy',
    description: 'Fully configurable GUI shop. Buy and sell items via chest GUI menus.',
    url: 'https://www.spigotmc.org/resources/shopgui.6515/', spigotId: '6515',
    compatible: ['paper', 'spigot'],
  },
  {
    id: 'playerwarps', name: 'PlayerWarps', category: 'Economy',
    description: 'Let players create public warp points others can teleport to.',
    url: 'https://www.spigotmc.org/resources/player-warps.66692/', spigotId: '66692',
    compatible: ['paper', 'spigot'],
  },
  // Chat & Social
  {
    id: 'discordsrv', name: 'DiscordSRV', category: 'Chat & Social',
    description: 'Bridge Minecraft chat with a Discord server. Relay messages, show joins/leaves, run commands.',
    url: 'https://modrinth.com/plugin/discordsrv', modrinth: 'discordsrv',
    compatible: ['paper', 'spigot'], recommended: true,
  },
  {
    id: 'chatcontrolred', name: 'ChatControl Red', category: 'Chat & Social',
    description: 'Complete chat management: filters, formats, channels, announcements.',
    url: 'https://www.spigotmc.org/resources/chatcontrol-red.82272/', spigotId: '82272',
    compatible: ['paper', 'spigot'],
  },
  // Performance
  {
    id: 'spark', name: 'Spark', category: 'Performance',
    description: 'Performance profiler. Identify lag spikes, TPS drops, and CPU bottlenecks.',
    url: 'https://modrinth.com/plugin/spark', modrinth: 'spark',
    compatible: ['paper', 'spigot', 'fabric', 'forge'], recommended: true,
  },
  {
    id: 'chunky', name: 'Chunky', category: 'Performance',
    description: 'Pre-generate world chunks to eliminate lag when players explore new areas.',
    url: 'https://modrinth.com/plugin/chunky', modrinth: 'chunky',
    compatible: ['paper', 'spigot', 'fabric', 'forge'], recommended: true,
  },
  {
    id: 'clearlagg', name: 'ClearLagg', category: 'Performance',
    description: 'Remove excess entities and items to reduce lag. Configurable timers and warnings.',
    url: 'https://www.spigotmc.org/resources/clearlagg.68271/', spigotId: '68271',
    compatible: ['paper', 'spigot'],
  },
  // Gameplay
  {
    id: 'dynmap', name: 'Dynmap', category: 'Map',
    description: 'Real-time web map of your world. Renders an interactive browser map.',
    url: 'https://modrinth.com/plugin/dynmap', modrinth: 'dynmap',
    compatible: ['paper', 'spigot', 'fabric', 'forge'], recommended: true,
  },
  {
    id: 'bluemap', name: 'BlueMap', category: 'Map',
    description: '3D browser map with smooth rendering. Modern alternative to Dynmap.',
    url: 'https://modrinth.com/plugin/bluemap', modrinth: 'bluemap',
    compatible: ['paper', 'spigot', 'fabric', 'forge'],
  },
  {
    id: 'grief-prevention', name: 'GriefPrevention', category: 'Protection',
    description: 'Player land claiming system. Players use a golden shovel to protect their builds.',
    url: 'https://www.spigotmc.org/resources/griefprevention.1884/', spigotId: '1884',
    compatible: ['paper', 'spigot'],
  },
  {
    id: 'viaversion', name: 'ViaVersion', category: 'Compatibility',
    description: 'Allow newer Minecraft clients to join older server versions.',
    url: 'https://modrinth.com/plugin/viaversion', modrinth: 'viaversion',
    compatible: ['paper', 'spigot'], recommended: true,
  },
  {
    id: 'multiverse-core', name: 'Multiverse-Core', category: 'World Management',
    description: 'Manage multiple worlds. Create, load, unload, and teleport between worlds.',
    url: 'https://modrinth.com/plugin/multiverse-core', modrinth: 'multiverse-core',
    compatible: ['paper', 'spigot'],
  },
  {
    id: 'placeholderapi', name: 'PlaceholderAPI', category: 'Admin & Essentials',
    description: 'Add placeholders (%player_name%, %vault_eco_balance%) usable in any compatible plugin.',
    url: 'https://modrinth.com/plugin/placeholderapi', modrinth: 'placeholderapi',
    compatible: ['paper', 'spigot'], recommended: true,
  },
  {
    id: 'holographicdisplays', name: 'DecentHolograms', category: 'Gameplay',
    description: 'Create floating text holograms in the world. Good for spawn info, leaderboards, signs.',
    url: 'https://modrinth.com/plugin/decentholograms', modrinth: 'decentholograms',
    compatible: ['paper', 'spigot'],
  },
]

const PLUGIN_CATEGORIES = [...new Set(PLUGINS.map(p => p.category))]

const SOFTWARE_INFO: Record<ServerSoftware, { label: string; desc: string; color: string; pluginSupport: boolean }> = {
  paper:   { label: 'Paper',   color: 'text-blue-400',   desc: 'Best performance & plugin support. Recommended for most servers.', pluginSupport: true },
  spigot:  { label: 'Spigot',  color: 'text-yellow-400', desc: 'Original plugin API. Good compatibility, slightly less optimized than Paper.', pluginSupport: true },
  fabric:  { label: 'Fabric',  color: 'text-green-400',  desc: 'Lightweight mod loader. Use for mods, not Bukkit plugins.', pluginSupport: false },
  forge:   { label: 'Forge',   color: 'text-orange-400', desc: 'Traditional mod loader. Large mod ecosystem but heavier.', pluginSupport: false },
  vanilla: { label: 'Vanilla', color: 'text-gray-400',   desc: 'Official Mojang server. No mods or plugins — pure vanilla experience.', pluginSupport: false },
}

function generateScript(
  software: ServerSoftware,
  version: McVersion,
  os: ServerOs,
  ramGb: number,
  selectedPlugins: string[],
  serverDir: string,
): string {
  const plugins = PLUGINS.filter(p => selectedPlugins.includes(p.id))
  const pluginUrls = plugins.map(p => p.modrinth
    ? `https://modrinth.com/plugin/${p.modrinth}`
    : p.url
  )

  const paperApiBase = `https://api.papermc.io/v2/projects`
  const jarName = `${software}-${version}.jar`

  const isWin = os === 'windows'
  const sh = isWin ? '' : '#!/bin/bash\nset -e\n'
  const mkdir = isWin ? `if not exist "${serverDir}" mkdir "${serverDir}"` : `mkdir -p "${serverDir}"`
  const cd = `cd "${serverDir}"`
  const echo = (msg: string) => isWin ? `echo ${msg}` : `echo "${msg}"`
  const curl = (url: string, out: string) => isWin
    ? `curl -L -o "${out}" "${url}"`
    : `curl -fsSL -o "${out}" "${url}"`
  const startCmd = isWin
    ? `java -Xms${ramGb}G -Xmx${ramGb}G -jar "${jarName}" nogui`
    : `java -Xms${ramGb}G -Xmx${ramGb}G -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -jar "${jarName}" nogui`
  const startFile = isWin ? 'start.bat' : 'start.sh'
  const comment = isWin ? '::' : '#'

  const lines: string[] = []

  if (!isWin) lines.push('#!/bin/bash', 'set -e', '')
  lines.push(
    `${comment} ═══════════════════════════════════════════════════════`,
    `${comment}  Minecraft Server Setup Script`,
    `${comment}  Software : ${SOFTWARE_INFO[software].label}`,
    `${comment}  Version  : ${version}`,
    `${comment}  RAM      : ${ramGb}GB`,
    `${comment}  OS       : ${os}`,
    `${comment}  Generated by Personal Note App`,
    `${comment} ═══════════════════════════════════════════════════════`,
    '',
    `${comment} ── 1. Create server directory ────────────────────────`,
    mkdir,
    cd,
    '',
    `${comment} ── 2. Check Java ─────────────────────────────────────`,
  )

  if (!isWin) {
    lines.push(
      'if ! command -v java &>/dev/null; then',
      '  echo "Java not found. Installing Java 21 (Temurin)..."',
      '  if command -v apt &>/dev/null; then',
      '    sudo apt update && sudo apt install -y wget apt-transport-https',
      '    wget -O - https://packages.adoptium.net/artifactory/api/gpg/key/public | sudo apt-key add -',
      '    echo "deb https://packages.adoptium.net/artifactory/deb $(awk -F= \'/^VERSION_CODENAME/{print$2}\' /etc/os-release) main" | sudo tee /etc/apt/sources.list.d/adoptium.list',
      '    sudo apt update && sudo apt install -y temurin-21-jdk',
      '  elif command -v dnf &>/dev/null; then',
      '    sudo dnf install -y java-21-openjdk',
      '  elif command -v brew &>/dev/null; then',
      '    brew install --cask temurin@21',
      '  else',
      '    echo "Please install Java 21 manually: https://adoptium.net"',
      '    exit 1',
      '  fi',
      'else',
      '  echo "Java found: $(java -version 2>&1 | head -1)"',
      'fi',
      '',
    )
  } else {
    lines.push(
      'java -version >nul 2>&1 || (echo "Java not found. Please install Java 21 from https://adoptium.net" && exit /b 1)',
      '',
    )
  }

  lines.push(`${comment} ── 3. Download server JAR ────────────────────────────`)

  if (software === 'paper') {
    if (!isWin) {
      lines.push(
        `echo "Fetching latest Paper build for ${version}..."`,
        `BUILD=$(curl -fsSL "${paperApiBase}/paper/versions/${version}/builds" | python3 -c "import sys,json; builds=json.load(sys.stdin)['builds']; print(builds[-1]['build'])")`,
        `${curl(`${paperApiBase}/paper/versions/${version}/builds/$BUILD/downloads/paper-${version}-$BUILD.jar`, jarName)}`,
      )
    } else {
      lines.push(
        `echo Downloading Paper ${version}...`,
        `${comment} Visit https://papermc.io/downloads/paper and download paper-${version}-latest.jar`,
        `${comment} Then rename it to "${jarName}" and place it in this folder.`,
        `${comment} Or use: powershell -Command "Invoke-WebRequest -Uri 'https://api.papermc.io/v2/projects/paper/versions/${version}/builds' -OutFile builds.json"`,
      )
    }
  } else if (software === 'spigot') {
    lines.push(
      `${comment} Spigot must be built with BuildTools`,
      `${curl('https://hub.spigotmc.org/jenkins/job/BuildTools/lastSuccessfulBuild/artifact/target/BuildTools.jar', 'BuildTools.jar')}`,
      `java -jar BuildTools.jar --rev ${version}`,
      isWin ? `rename spigot-${version}.jar "${jarName}"` : `mv spigot-${version}.jar "${jarName}"`,
    )
  } else if (software === 'fabric') {
    lines.push(
      `${comment} Download Fabric installer`,
      `${curl('https://maven.fabricmc.net/net/fabricmc/fabric-installer/latest/fabric-installer.jar', 'fabric-installer.jar')}`,
      `java -jar fabric-installer.jar server -mcversion ${version} -downloadMinecraft`,
      isWin ? `rename fabric-server-launch.jar "${jarName}"` : `mv fabric-server-launch.jar "${jarName}"`,
    )
  } else if (software === 'forge') {
    lines.push(
      `${comment} Download Forge installer from https://files.minecraftforge.net`,
      `${comment} Replace the URL below with the correct installer for ${version}`,
      `${curl(`https://maven.minecraftforge.net/net/minecraftforge/forge/${version}-latest/forge-${version}-latest-installer.jar`, 'forge-installer.jar')}`,
      'java -jar forge-installer.jar --installServer',
    )
  } else {
    lines.push(
      `${comment} Download Vanilla server`,
      `${comment} Get the correct URL from https://www.minecraft.net/en-us/download/server`,
      `${curl(`https://piston-data.mojang.com/v1/objects/placeholder/server.jar`, jarName)}`,
    )
  }

  lines.push('')

  if (software === 'paper' || software === 'spigot') {
    lines.push(
      `${comment} ── 4. Accept EULA ────────────────────────────────────`,
      `${comment} Run once to generate eula.txt, then accept it`,
      `java -jar "${jarName}" nogui || true`,
      isWin
        ? `echo eula=true > eula.txt`
        : `echo 'eula=true' > eula.txt`,
      '',
      `${comment} ── 5. Create plugins directory ───────────────────────`,
      isWin ? 'if not exist "plugins" mkdir "plugins"' : 'mkdir -p plugins',
      '',
    )

    if (plugins.length > 0) {
      lines.push(`${comment} ── 6. Download plugins ───────────────────────────────`)
      for (const plugin of plugins) {
        lines.push(`${comment} ${plugin.name} — ${plugin.description.slice(0, 60)}`)
        lines.push(`${echo(`Downloading ${plugin.name}...`)}`)
        if (plugin.modrinth) {
          if (!isWin) {
            lines.push(
              `PURL=$(curl -fsSL "https://api.modrinth.com/v2/project/${plugin.modrinth}/version?game_versions=[\\"${version}\\"]&loaders=[\\"paper\\"]" | python3 -c "import sys,json; v=json.load(sys.stdin); print(next((f['url'] for f in v[0]['files'] if f.get('primary')), v[0]['files'][0]['url']) if v else '')" 2>/dev/null || echo "")`,
              `if [ -n "$PURL" ]; then`,
              `  ${curl('$PURL', `plugins/${plugin.id}.jar`)}`,
              `else`,
              `  echo "  Could not auto-download ${plugin.name}. Visit: ${plugin.url}"`,
              `fi`,
            )
          } else {
            lines.push(`${comment} Download ${plugin.name} from: ${plugin.url}`)
            lines.push(`${comment} Place the .jar file in the plugins\\ folder`)
          }
        } else {
          lines.push(`${comment} Download manually from: ${plugin.url}`)
          lines.push(`${comment} Place the .jar file in the plugins\\ folder`)
        }
        lines.push('')
      }
    }

    lines.push(
      `${comment} ── 7. Recommended server.properties tweaks ──────────`,
      isWin ? '(' : 'cat > server.properties << \'EOF\'',
      'view-distance=10',
      'simulation-distance=8',
      'max-players=20',
      'online-mode=true',
      'difficulty=normal',
      'gamemode=survival',
      'pvp=true',
      'spawn-protection=16',
      isWin ? ') > server.properties' : 'EOF',
      '',
    )
  } else {
    lines.push(
      `${comment} ── 4. Accept EULA ────────────────────────────────────`,
      `java -jar "${jarName}" nogui || true`,
      isWin ? `echo eula=true > eula.txt` : `echo 'eula=true' > eula.txt`,
      '',
    )
  }

  lines.push(
    `${comment} ── Final: Create start script ────────────────────────`,
  )

  if (!isWin) {
    lines.push(
      `cat > ${startFile} << 'EOF'`,
      '#!/bin/bash',
      `cd "$(dirname "$0")"`,
      `${startCmd}`,
      'EOF',
      `chmod +x ${startFile}`,
      '',
      'echo ""',
      'echo "✓ Setup complete!"',
      `echo "  Server directory : ${serverDir}"`,
      `echo "  Start the server : ./${startFile}"`,
      'echo ""',
    )
  } else {
    lines.push(
      `echo ${startCmd} > ${startFile}`,
      '',
      'echo.',
      'echo Setup complete!',
      `echo Start the server with: ${startFile}`,
      'echo.',
    )
  }

  return sh + lines.join('\n')
}

function ServerSetupTab() {
  const [software, setSoftware] = useState<ServerSoftware>('paper')
  const [version, setVersion] = useState<McVersion>('1.21.4')
  const [os, setOs] = useState<ServerOs>('linux')
  const [ramGb, setRamGb] = useState(4)
  const [serverDir, setServerDir] = useState('/opt/minecraft/server')
  const [selectedPlugins, setSelectedPlugins] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [scriptCopied, setScriptCopied] = useState(false)
  const [expandedPlugin, setExpandedPlugin] = useState<string | null>(null)

  const supportsPlugins = SOFTWARE_INFO[software].pluginSupport

  // Auto-select recommended plugins when switching to plugin-compatible software
  useEffect(() => {
    if (supportsPlugins) {
      const recommended = PLUGINS.filter(p => p.recommended && p.compatible.includes(software)).map(p => p.id)
      setSelectedPlugins(recommended)
    } else {
      setSelectedPlugins([])
    }
  }, [software])

  const togglePlugin = (id: string) => {
    setSelectedPlugins(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const script = generateScript(software, version, os, ramGb, selectedPlugins, serverDir)

  const copyScript = useCallback(async () => {
    await navigator.clipboard.writeText(script)
    setScriptCopied(true)
    setTimeout(() => setScriptCopied(false), 2000)
  }, [script])

  const downloadScript = useCallback(() => {
    const ext = os === 'windows' ? '.bat' : '.sh'
    const blob = new Blob([script], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `minecraft-server-setup${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }, [script, os])

  const visiblePlugins = PLUGINS.filter(p =>
    p.compatible.includes(software) &&
    (activeCategory === 'All' || p.category === activeCategory)
  )

  const compatibleCategories = ['All', ...PLUGIN_CATEGORIES.filter(cat =>
    PLUGINS.some(p => p.compatible.includes(software) && p.category === cat)
  )]

  return (
    <div className="flex-1 overflow-y-auto bg-gray-900">
      <div className="max-w-5xl mx-auto p-5 space-y-6">
        <div className="flex items-center gap-3">
          <Server size={18} className="text-green-400" />
          <h1 className="text-base font-semibold text-gray-100">Minecraft Server Setup</h1>
        </div>

        {/* ── Step 1: Server Software ── */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-green-400 uppercase tracking-wider">1. Server Software</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {(Object.keys(SOFTWARE_INFO) as ServerSoftware[]).map(sw => (
              <button
                key={sw}
                onClick={() => setSoftware(sw)}
                className={`flex flex-col items-start p-3 rounded-lg border text-left transition-colors ${
                  software === sw
                    ? 'border-green-500 bg-green-900/20'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                }`}
              >
                <span className={`text-sm font-semibold ${SOFTWARE_INFO[sw].color}`}>{SOFTWARE_INFO[sw].label}</span>
                <span className="text-xs text-gray-400 mt-1 leading-snug">{SOFTWARE_INFO[sw].desc.split('.')[0]}.</span>
                {SOFTWARE_INFO[sw].pluginSupport && (
                  <span className="mt-1.5 text-xs text-emerald-400 font-medium">Plugins ✓</span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* ── Step 2: Configuration ── */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-green-400 uppercase tracking-wider">2. Configuration</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Minecraft Version</label>
              <select value={version} onChange={e => setVersion(e.target.value as McVersion)}
                className="w-full px-3 py-1.5 rounded-lg border border-gray-600 bg-gray-800 text-sm text-gray-200 focus:outline-none focus:border-green-500">
                {(['1.21.4','1.21.1','1.20.6','1.20.4','1.20.1','1.19.4'] as McVersion[]).map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Operating System</label>
              <select value={os} onChange={e => setOs(e.target.value as ServerOs)}
                className="w-full px-3 py-1.5 rounded-lg border border-gray-600 bg-gray-800 text-sm text-gray-200 focus:outline-none focus:border-green-500">
                <option value="linux">Linux</option>
                <option value="windows">Windows</option>
                <option value="macos">macOS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">RAM (GB)</label>
              <select value={ramGb} onChange={e => setRamGb(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg border border-gray-600 bg-gray-800 text-sm text-gray-200 focus:outline-none focus:border-green-500">
                {[1,2,4,6,8,12,16].map(r => (
                  <option key={r} value={r}>{r} GB</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Server Directory</label>
              <input
                value={serverDir}
                onChange={e => setServerDir(e.target.value)}
                placeholder={os === 'windows' ? 'C:\\minecraft\\server' : '/opt/minecraft/server'}
                className="w-full px-3 py-1.5 rounded-lg border border-gray-600 bg-gray-800 text-sm text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:border-green-500"
              />
            </div>
          </div>
        </section>

        {/* ── Step 3: Plugins ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-green-400 uppercase tracking-wider">3. Plugins</h2>
            {supportsPlugins && (
              <span className="text-xs text-gray-500">{selectedPlugins.length} selected</span>
            )}
          </div>

          {!supportsPlugins ? (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-gray-700 bg-gray-800/50 text-sm text-gray-400">
              <span className="text-2xl">🧩</span>
              <span><strong className={SOFTWARE_INFO[software].color}>{SOFTWARE_INFO[software].label}</strong> uses mods, not Bukkit plugins. Browse mods at <span className="text-green-400">modrinth.com</span>.</span>
            </div>
          ) : (
            <>
              {/* Category filter */}
              <div className="flex flex-wrap gap-1.5">
                {compatibleCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      activeCategory === cat
                        ? 'bg-green-700 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Plugin grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {visiblePlugins.map(plugin => {
                  const selected = selectedPlugins.includes(plugin.id)
                  const expanded = expandedPlugin === plugin.id
                  return (
                    <div
                      key={plugin.id}
                      className={`rounded-lg border transition-colors ${
                        selected
                          ? 'border-green-600 bg-green-900/15'
                          : 'border-gray-700 bg-gray-800'
                      }`}
                    >
                      <div className="flex items-start gap-3 p-3">
                        <button
                          onClick={() => togglePlugin(plugin.id)}
                          className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            selected
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-500 hover:border-green-500'
                          }`}
                        >
                          {selected && <Check size={10} className="text-white" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-100">{plugin.name}</span>
                            {plugin.recommended && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-800">recommended</span>
                            )}
                            <span className="text-xs text-gray-500">{plugin.category}</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5 leading-snug">{plugin.description}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <a href={plugin.url} target="_blank" rel="noopener noreferrer"
                            title="Download page"
                            className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors">
                            <ExternalLink size={12} />
                          </a>
                          <button onClick={() => setExpandedPlugin(expanded ? null : plugin.id)}
                            className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors">
                            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        </div>
                      </div>
                      {expanded && (
                        <div className="px-3 pb-3 pt-0 border-t border-gray-700/50">
                          <div className="mt-2 space-y-1 text-xs text-gray-400">
                            <p><span className="text-gray-500">Download:</span>{' '}
                              <a href={plugin.url} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline break-all">{plugin.url}</a>
                            </p>
                            {plugin.modrinth && (
                              <p><span className="text-gray-500">Modrinth ID:</span> <span className="font-mono text-gray-300">{plugin.modrinth}</span></p>
                            )}
                            <p><span className="text-gray-500">Compatible with:</span> {plugin.compatible.map(c => SOFTWARE_INFO[c].label).join(', ')}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </section>

        {/* ── Step 4: Generated Script ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-green-400 uppercase tracking-wider">4. Generated Setup Script</h2>
            <div className="flex items-center gap-2">
              <button onClick={copyScript}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 transition-colors">
                {scriptCopied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                {scriptCopied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={downloadScript}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-xs text-white transition-colors">
                <Download size={12} />
                Download {os === 'windows' ? '.bat' : '.sh'}
              </button>
            </div>
          </div>
          <div className="relative rounded-lg border border-gray-700 bg-gray-950 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700 bg-gray-900">
              <Terminal size={12} className="text-gray-500" />
              <span className="text-xs text-gray-500 font-mono">
                minecraft-server-setup{os === 'windows' ? '.bat' : '.sh'}
              </span>
            </div>
            <pre className="overflow-x-auto overflow-y-auto max-h-96 p-4 text-xs text-green-300 font-mono leading-relaxed">
              {script}
            </pre>
          </div>
          <p className="text-xs text-gray-600">
            Review the script before running it.{' '}
            {os !== 'windows' && 'Make it executable with: '}
            {os !== 'windows' && <code className="bg-gray-800 px-1 rounded text-gray-400">chmod +x minecraft-server-setup.sh</code>}
          </p>
        </section>

      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

type Tab = 'map' | 'controls' | 'setup'

export default function MinecraftView() {
  const [config, setConfig] = useState<MapConfig>(loadConfig)
  const [showSettings, setShowSettings] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)
  const [iframeError, setIframeError] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('map')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const mapUrl = buildUrl(config.ip, config.port)
  const hasConfig = !!mapUrl

  // Open settings immediately if not configured yet
  useEffect(() => {
    if (!hasConfig) setShowSettings(true)
  }, [])

  const handleSave = (cfg: MapConfig) => {
    setConfig(cfg)
    setIframeError(false)
    setIframeKey(k => k + 1)
  }

  const reload = () => {
    setIframeError(false)
    setIframeKey(k => k + 1)
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden bg-gray-900">
      {showSettings && (
        <SettingsPanel
          config={config}
          onSave={handleSave}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-2 px-4 border-b border-gray-700 bg-gray-800">
        {/* Icon + title */}
        <MinecraftIcon className="w-5 h-5 shrink-0" />
        <span className="text-sm font-semibold text-gray-100 shrink-0">Minecraft</span>

        {/* Tabs */}
        <div className="flex items-end gap-0.5 ml-2 self-stretch">
          {([
            { id: 'map' as Tab,      label: 'Map',      icon: <Map size={13} /> },
            { id: 'controls' as Tab, label: 'Controls', icon: <Keyboard size={13} /> },
            { id: 'setup' as Tab,    label: 'Server Setup', icon: <Server size={13} /> },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Map URL */}
        {hasConfig && activeTab === 'map' && (
          <span className="ml-1 text-xs text-gray-500 font-mono truncate max-w-xs">{mapUrl}</span>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1">
          {hasConfig && activeTab === 'map' && (
            <>
              <button onClick={reload} title="Reload map"
                className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors">
                <RefreshCw size={14} />
              </button>
              <a href={mapUrl} target="_blank" rel="noopener noreferrer" title="Open in browser"
                className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors">
                <ExternalLink size={14} />
              </a>
            </>
          )}
          <button onClick={() => setShowSettings(true)} title="Map settings"
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors">
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative min-h-0 flex flex-col">
        {activeTab === 'controls' ? (
          <ControlsTab />
        ) : activeTab === 'setup' ? (
          <ServerSetupTab />
        ) : !hasConfig ? (
          // No config yet
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-gray-400">
            <MinecraftIcon className="w-16 h-16 opacity-40" />
            <p className="text-sm">No map server configured.</p>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white text-sm font-medium transition-colors"
            >
              <Settings size={14} />
              Configure Server
            </button>
          </div>
        ) : iframeError ? (
          // Load error
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-gray-400">
            <Map size={40} className="opacity-30" />
            <p className="text-sm font-medium text-gray-300">Could not load map</p>
            <p className="text-xs text-gray-500 max-w-sm text-center">
              Make sure your Minecraft map server is running at{' '}
              <span className="font-mono text-green-400">{mapUrl}</span> and is reachable from this device.
            </p>
            <div className="flex gap-2">
              <button
                onClick={reload}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm transition-colors"
              >
                <RefreshCw size={13} />
                Retry
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm transition-colors"
              >
                <Settings size={13} />
                Change Server
              </button>
            </div>
          </div>
        ) : (
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={mapUrl}
            title="Minecraft Map"
            className="absolute inset-0 w-full h-full border-0"
            onError={() => setIframeError(true)}
            allow="fullscreen"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock"
          />
        )}
      </div>
    </div>
  )
}
