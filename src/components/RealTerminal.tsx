import { useEffect, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import 'xterm/css/xterm.css'

interface RealTerminalProps {
  workingDirectory?: string | null
  onTerminalReady?: (terminalId: string) => void
}

export default function RealTerminal({ workingDirectory, onTerminalReady }: RealTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstance = useRef<Terminal | null>(null)
  const fitAddon = useRef<FitAddon | null>(null)
  const [terminalId, setTerminalId] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!terminalRef.current || !window.electronAPI) return

    // Create terminal instance
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Consolas, Monaco, "Lucida Console", monospace',
      theme: {
        background: 'var(--card)',
        foreground: 'var(--foreground)',
        cursor: 'var(--primary)',
        black: '#000000',
        red: '#e74c3c',
        green: '#2ecc71',
        yellow: '#f39c12',
        blue: '#3498db',
        magenta: '#9b59b6',
        cyan: '#1abc9c',
        white: '#ecf0f1',
        brightBlack: '#34495e',
        brightRed: '#c0392b',
        brightGreen: '#27ae60',
        brightYellow: '#e67e22',
        brightBlue: '#2980b9',
        brightMagenta: '#8e44ad',
        brightCyan: '#16a085',
        brightWhite: '#bdc3c7'
      },
      allowProposedApi: true,
      allowTransparency: true
    })

    // Create fit addon
    const fit = new FitAddon()
    terminal.loadAddon(fit)

    // Open terminal in DOM
    terminal.open(terminalRef.current)
    
    // Wait for element to have dimensions before fitting
    const waitForDimensions = () => {
      if (terminalRef.current) {
        const rect = terminalRef.current.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          try {
            fit.fit()
          } catch (error) {
            console.warn('Failed to fit terminal:', error)
          }
        } else {
          requestAnimationFrame(waitForDimensions)
        }
      }
    }
    
    requestAnimationFrame(waitForDimensions)

    // Store references
    terminalInstance.current = terminal
    fitAddon.current = fit

    // Create terminal session
    const createTerminal = async () => {
      if (!window.electronAPI) return

      try {
        const result = await window.electronAPI.terminalCreate(workingDirectory || undefined)
        if (result.success && result.terminalId) {
          setTerminalId(result.terminalId)
          setIsConnected(true)
          onTerminalReady?.(result.terminalId)

          // Handle terminal input
          terminal.onData((data) => {
            if (result.terminalId && window.electronAPI) {
              window.electronAPI.terminalWrite(result.terminalId, data)
            }
          })

          // Set up data listener for this specific terminal
          const handleTerminalData = (id: string, data: string) => {
            if (id === result.terminalId) {
              terminal.write(data)
            }
          }

          const handleTerminalExit = (id: string, exitCode: number) => {
            if (id === result.terminalId) {
              terminal.write(`\r\n\x1b[31mProcess exited with code: ${exitCode}\x1b[0m\r\n`)
              setIsConnected(false)
            }
          }

          // Set up listeners
          if (window.electronAPI) {
            window.electronAPI.onTerminalData(handleTerminalData)
            window.electronAPI.onTerminalExit(handleTerminalExit)
          }

          // Handle terminal resize
          const resizeObserver = new ResizeObserver(() => {
            if (fitAddon.current && result.terminalId && window.electronAPI && terminalRef.current) {
              const rect = terminalRef.current.getBoundingClientRect()
              if (rect.width > 0 && rect.height > 0) {
                try {
                  fitAddon.current.fit()
                  const dimensions = fitAddon.current.proposeDimensions()
                  if (dimensions && result.terminalId && window.electronAPI) {
                    window.electronAPI.terminalResize(result.terminalId, dimensions.cols, dimensions.rows)
                  }
                } catch (error) {
                  console.warn('Failed to resize terminal:', error)
                }
              }
            }
          })

          if (terminalRef.current) {
            resizeObserver.observe(terminalRef.current)
          }

          // Clean up function
          return () => {
            resizeObserver.disconnect()
            if (result.terminalId && window.electronAPI) {
              window.electronAPI.terminalKill(result.terminalId)
            }
            if (window.electronAPI) {
              window.electronAPI.removeTerminalListeners()
            }
          }
        } else {
          terminal.write('\x1b[31mFailed to create terminal session\x1b[0m\r\n')
          console.error('Failed to create terminal:', result.error)
        }
      } catch (error) {
        terminal.write('\x1b[31mError creating terminal\x1b[0m\r\n')
        console.error('Error creating terminal:', error)
      }
    }

    const cleanup = createTerminal()

    // Cleanup function
    return () => {
      cleanup.then(cleanupFn => cleanupFn?.())
      terminal.dispose()
      terminalInstance.current = null
      fitAddon.current = null
    }
  }, [workingDirectory, onTerminalReady])

  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddon.current && terminalId && window.electronAPI && terminalRef.current) {
        const rect = terminalRef.current.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          try {
            fitAddon.current.fit()
            const dimensions = fitAddon.current.proposeDimensions()
            if (dimensions && terminalId && window.electronAPI) {
              window.electronAPI.terminalResize(terminalId, dimensions.cols, dimensions.rows)
            }
          } catch (error) {
            console.warn('Failed to resize terminal on window resize:', error)
          }
        }
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [terminalId])

  return (
    <div className="h-full w-full relative">
      <div 
        ref={terminalRef} 
        className="h-full w-full"
        style={{ 
          backgroundColor: 'var(--card)',
          padding: '8px'
        }}
      />
      {!isConnected && terminalId && (
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: 'var(--foreground)'
          }}
        >
          <div className="text-sm">Terminal disconnected</div>
        </div>
      )}
    </div>
  )
} 