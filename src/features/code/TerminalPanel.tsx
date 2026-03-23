import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

const WS_URL = `ws://${window.location.hostname}:3001`

export interface TerminalPanelHandle {
  focus: () => void
}

interface Props {
  /** Called when the terminal connection state changes */
  onStatusChange?: (connected: boolean) => void
}

const TerminalPanel = forwardRef<TerminalPanelHandle, Props>(function TerminalPanel({ onStatusChange }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState < WebSocket.CLOSING) return

    setStatus('connecting')
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      onStatusChange?.(true)
      // Send initial size
      if (xtermRef.current && fitRef.current) {
        fitRef.current.fit()
        ws.send(JSON.stringify({ type: 'resize', cols: xtermRef.current.cols, rows: xtermRef.current.rows }))
      }
    }

    ws.onmessage = e => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'output') xtermRef.current?.write(msg.data)
        else if (msg.type === 'exit') {
          xtermRef.current?.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n')
          setStatus('disconnected')
          onStatusChange?.(false)
        }
      } catch { /* ignore */ }
    }

    ws.onerror = () => {
      setStatus('disconnected')
      onStatusChange?.(false)
    }

    ws.onclose = () => {
      setStatus('disconnected')
      onStatusChange?.(false)
    }
  }, [onStatusChange])

  // Mount xterm
  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#aeafad',
        black: '#1e1e1e', red: '#f44747', green: '#4ec94e', yellow: '#dcdcaa',
        blue: '#569cd6', magenta: '#c586c0', cyan: '#4ec9b0', white: '#d4d4d4',
        brightBlack: '#808080', brightRed: '#f48771', brightGreen: '#89d185',
        brightYellow: '#e9e9aa', brightBlue: '#9cdcfe', brightMagenta: '#c586c0',
        brightCyan: '#56d8d8', brightWhite: '#ffffff',
        selectionBackground: '#264f78',
      },
      fontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true,
    })

    const fit = new FitAddon()
    const links = new WebLinksAddon()
    term.loadAddon(fit)
    term.loadAddon(links)
    term.open(containerRef.current)
    fit.fit()

    xtermRef.current = term
    fitRef.current = fit

    // Forward user input to server
    term.onData(data => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }))
      }
    })

    // Handle resize
    const ro = new ResizeObserver(() => {
      try {
        fit.fit()
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
        }
      } catch { /* ignore during teardown */ }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      term.dispose()
      xtermRef.current = null
      fitRef.current = null
    }
  }, [])

  // Auto-connect on mount
  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  useImperativeHandle(ref, () => ({
    focus: () => xtermRef.current?.focus(),
  }))

  return (
    <div className="flex flex-col h-full" style={{ background: '#1e1e1e' }}>
      {/* Status bar */}
      {status !== 'connected' && (
        <div className="flex items-center justify-between px-3 py-1.5 shrink-0 text-xs"
          style={{ background: '#252526', borderBottom: '1px solid #1e1e1e', color: '#969696' }}>
          <span>
            {status === 'connecting' ? '⏳ Connecting to terminal server…' : '✗ Terminal disconnected'}
          </span>
          {status === 'disconnected' && (
            <button onClick={connect}
              className="px-2 py-0.5 rounded text-xs hover:text-white"
              style={{ background: '#3c3c3c', color: '#cccccc' }}>
              Reconnect
            </button>
          )}
        </div>
      )}
      <div ref={containerRef} className="flex-1 overflow-hidden px-1 py-1" />
    </div>
  )
})

export default TerminalPanel
