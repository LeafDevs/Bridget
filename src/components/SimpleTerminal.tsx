import { useState, useRef, useEffect } from 'react'
import { Terminal, CaretRight } from '@phosphor-icons/react'

interface Command {
  id: string
  command: string
  output: string
  timestamp: Date
  exitCode?: number
}

interface SimpleTerminalProps {
  workingDirectory?: string | null
}

export default function SimpleTerminal({ workingDirectory }: SimpleTerminalProps) {
  const [commands, setCommands] = useState<Command[]>([])
  const [currentInput, setCurrentInput] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [currentDir, setCurrentDir] = useState(workingDirectory || '~')
  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when new output is added
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [commands])

  // Update current directory when workingDirectory prop changes
  useEffect(() => {
    if (workingDirectory) {
      setCurrentDir(workingDirectory)
    }
  }, [workingDirectory])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const executeCommand = async (command: string) => {
    if (!command.trim() || !window.electronAPI) return

    const commandId = Date.now().toString()
    const newCommand: Command = {
      id: commandId,
      command: command.trim(),
      output: '',
      timestamp: new Date()
    }

    setCommands(prev => [...prev, newCommand])
    setCurrentInput('')
    setIsExecuting(true)

    try {
      const result = await window.electronAPI.executeCommand(command.trim(), currentDir)
      
      if (result.success) {
        // Update the command with the output
        setCommands(prev => prev.map(cmd => 
          cmd.id === commandId 
            ? { ...cmd, output: result.output, exitCode: result.exitCode }
            : cmd
        ))

        // Update current directory if command was 'cd'
        if (command.trim().startsWith('cd ')) {
          try {
            const newDir = await window.electronAPI.executeCommand('pwd', currentDir)
            if (newDir.success) {
              setCurrentDir(newDir.output.trim())
            }
          } catch (error) {
            console.error('Failed to get new directory:', error)
          }
        }
      } else {
        setCommands(prev => prev.map(cmd => 
          cmd.id === commandId 
            ? { ...cmd, output: result.output || 'Command failed', exitCode: result.exitCode }
            : cmd
        ))
      }
    } catch (error) {
      setCommands(prev => prev.map(cmd => 
        cmd.id === commandId 
          ? { ...cmd, output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, exitCode: 1 }
          : cmd
      ))
    } finally {
      setIsExecuting(false)
      // Refocus input after command execution
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isExecuting) {
      executeCommand(currentInput)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const getShortPath = (path: string) => {
    if (path.length > 30) {
      return '...' + path.slice(-27)
    }
    return path
  }

  return (
    <div 
      className="h-full flex flex-col"
      style={{ backgroundColor: 'var(--card)' }}
    >
      {/* Header */}
      <div 
        style={{ 
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--sidebar)'
        }}
      >
        <div className="flex items-center gap-2">
          <Terminal size={16} style={{ color: 'var(--primary)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--sidebar-foreground)' }}>
            Terminal
          </span>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {getShortPath(currentDir)}
          </span>
        </div>
      </div>

      {/* Command History */}
      <div 
        ref={outputRef}
        className="flex-1 overflow-y-auto"
        style={{ 
          padding: '16px',
          fontFamily: 'JetBrains Mono, Consolas, Monaco, "Lucida Console", monospace'
        }}
      >
        {commands.length === 0 && (
          <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Welcome to the terminal. Type commands below.
          </div>
        )}
        
        {commands.map((cmd) => (
          <div key={cmd.id} className="mb-4">
            {/* Command header */}
            <div className="flex items-center gap-2 mb-1">
              <span style={{ color: 'var(--primary)', fontSize: '12px' }}>
                {getShortPath(currentDir)}
              </span>
              <CaretRight size={12} style={{ color: 'var(--muted-foreground)' }} />
              <span style={{ color: 'var(--foreground)', fontSize: '12px' }}>
                {cmd.command}
              </span>
              <span style={{ color: 'var(--muted-foreground)', fontSize: '10px' }}>
                {formatTime(cmd.timestamp)}
              </span>
            </div>
            
            {/* Command output */}
            {cmd.output && (
              <pre 
                style={{ 
                  fontSize: '11px',
                  lineHeight: '1.4',
                  color: cmd.exitCode === 0 ? 'var(--foreground)' : 'var(--destructive)',
                  backgroundColor: 'var(--sidebar)',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0
                }}
              >
                {cmd.output}
              </pre>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isExecuting && (
          <div className="flex items-center gap-2 mb-4">
            <div className="flex gap-1">
              <div 
                className="w-1 h-1 rounded-full animate-pulse"
                style={{ backgroundColor: 'var(--primary)' }}
              />
              <div 
                className="w-1 h-1 rounded-full animate-pulse"
                style={{ backgroundColor: 'var(--primary)', animationDelay: '0.2s' }}
              />
              <div 
                className="w-1 h-1 rounded-full animate-pulse"
                style={{ backgroundColor: 'var(--primary)', animationDelay: '0.4s' }}
              />
            </div>
            <span style={{ color: 'var(--muted-foreground)', fontSize: '11px' }}>
              Executing...
            </span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div 
        style={{ 
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--sidebar)'
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--primary)', fontSize: '12px' }}>
            {getShortPath(currentDir)}
          </span>
          <CaretRight size={12} style={{ color: 'var(--muted-foreground)' }} />
          <input
            ref={inputRef}
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isExecuting}
            placeholder="Enter command..."
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--foreground)',
              fontSize: '12px',
              fontFamily: 'JetBrains Mono, Consolas, Monaco, "Lucida Console", monospace'
            }}
          />
        </div>
      </div>
    </div>
  )
} 