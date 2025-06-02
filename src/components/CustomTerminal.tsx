import { useState, useRef, useEffect } from 'react'
import { Terminal as TerminalIcon } from '@phosphor-icons/react'

interface CustomTerminalProps {
  workingDirectory?: string | null
}

interface TerminalLine {
  id: string
  content: string
  timestamp: Date
  type: 'output' | 'input' | 'error'
}

export default function CustomTerminal({ workingDirectory }: CustomTerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [currentInput, setCurrentInput] = useState('')
  const [terminalId, setTerminalId] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [currentDir, setCurrentDir] = useState('~')
  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [lines])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Initialize terminal
  useEffect(() => {
    const initTerminal = async () => {
      if (!window.electronAPI) return

      try {
        const result = await window.electronAPI.terminalCreate(workingDirectory || undefined)
        if (result.success && result.terminalId) {
          setTerminalId(result.terminalId)
          setIsConnected(true)

          // Add welcome message
          setLines([{
            id: Date.now().toString(),
            content: `Terminal started (ID: ${result.terminalId.slice(-6)})`,
            timestamp: new Date(),
            type: 'output'
          }])

          // Set up data listener
          const handleTerminalData = (id: string, data: string) => {
            if (id === result.terminalId) {
              // Process and add terminal output
              const processedData = processAnsiData(data)
              if (processedData.trim()) {
                setLines(prev => [...prev, {
                  id: Date.now().toString() + Math.random(),
                  content: processedData,
                  timestamp: new Date(),
                  type: 'output'
                }])
              }
            }
          }

          const handleTerminalExit = (id: string, exitCode: number) => {
            if (id === result.terminalId) {
              setLines(prev => [...prev, {
                id: Date.now().toString(),
                content: `Process exited with code: ${exitCode}`,
                timestamp: new Date(),
                type: 'error'
              }])
              setIsConnected(false)
            }
          }

          // Set up listeners
          if (window.electronAPI) {
            window.electronAPI.onTerminalData(handleTerminalData)
            window.electronAPI.onTerminalExit(handleTerminalExit)
          }
        }
      } catch (error) {
        console.error('Failed to create terminal:', error)
        setLines([{
          id: Date.now().toString(),
          content: `Failed to create terminal: ${error}`,
          timestamp: new Date(),
          type: 'error'
        }])
      }
    }

    initTerminal()

    // Cleanup
    return () => {
      if (terminalId && window.electronAPI) {
        window.electronAPI.terminalKill(terminalId)
        window.electronAPI.removeTerminalListeners()
      }
    }
  }, [workingDirectory])

  // Simple ANSI escape sequence processor
  const processAnsiData = (data: string): string => {
    // Remove common ANSI escape sequences but keep the text
    let processed = data
      // Remove cursor movement sequences
      .replace(/\x1b\[[0-9;]*[ABCD]/g, '')
      // Remove color codes
      .replace(/\x1b\[[0-9;]*m/g, '')
      // Remove clear screen
      .replace(/\x1b\[2J/g, '')
      // Remove other control sequences
      .replace(/\x1b\[[?]?[0-9;]*[a-zA-Z]/g, '')
      // Remove carriage returns followed by spaces (overwriting)
      .replace(/\r\s+/g, '\r')
      // Handle backspace sequences
      .replace(/.\x08/g, '')

    return processed
  }

  const handleSendCommand = async () => {
    if (!currentInput.trim() || !terminalId || !window.electronAPI) return

    const command = currentInput.trim()
    
    // Add input line to display
    setLines(prev => [...prev, {
      id: Date.now().toString(),
      content: `$ ${command}`,
      timestamp: new Date(),
      type: 'input'
    }])

    // Send to terminal
    try {
      await window.electronAPI.terminalWrite(terminalId, command + '\r')
      setCurrentInput('')
    } catch (error) {
      setLines(prev => [...prev, {
        id: Date.now().toString(),
        content: `Error: ${error}`,
        timestamp: new Date(),
        type: 'error'
      }])
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSendCommand()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle special keys
    if (!terminalId || !window.electronAPI) return

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        window.electronAPI.terminalWrite(terminalId, '\x1b[A')
        break
      case 'ArrowDown':
        e.preventDefault()
        window.electronAPI.terminalWrite(terminalId, '\x1b[B')
        break
      case 'ArrowLeft':
        e.preventDefault()
        window.electronAPI.terminalWrite(terminalId, '\x1b[D')
        break
      case 'ArrowRight':
        e.preventDefault()
        window.electronAPI.terminalWrite(terminalId, '\x1b[C')
        break
      case 'Tab':
        e.preventDefault()
        window.electronAPI.terminalWrite(terminalId, '\t')
        break
    }
  }

  const clearTerminal = () => {
    setLines([])
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div 
      className="h-full flex flex-col"
      style={{ backgroundColor: 'var(--card)' }}
    >

      {/* Terminal Output */}
      <div 
        ref={outputRef}
        className="flex-1 overflow-y-auto"
        style={{ 
          padding: '16px',
          fontFamily: 'JetBrains Mono, Consolas, Monaco, "Lucida Console", monospace',
          fontSize: '13px',
          lineHeight: '1.4'
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((line) => (
          <div key={line.id} className="mb-1">
            <div style={{ 
              color: line.type === 'error' ? 'var(--destructive)' 
                    : line.type === 'input' ? 'var(--primary)'
                    : 'var(--foreground)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {line.content}
            </div>
          </div>
        ))}

        {/* Loading indicator when connected but no recent output */}
        {isConnected && lines.length === 1 && (
          <div style={{ color: 'var(--muted-foreground)', fontSize: '11px' }}>
            Terminal ready. Type commands below...
          </div>
        )}
      </div>

      {/* Input Area */}
      {isConnected && (
        <div 
          style={{ 
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            backgroundColor: 'var(--sidebar)'
          }}
        >
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--primary)', fontSize: '13px' }}>$</span>
            <input
              ref={inputRef}
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyPress={handleKeyPress}
              onKeyDown={handleKeyDown}
              placeholder="Enter command..."
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--foreground)',
                fontSize: '13px',
                fontFamily: 'JetBrains Mono, Consolas, Monaco, "Lucida Console", monospace'
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
} 