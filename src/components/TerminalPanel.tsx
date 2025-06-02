import { useState, useRef, useEffect } from 'react'
import { Terminal, X } from '@phosphor-icons/react'
import CustomTerminal from './CustomTerminal'

interface TerminalEntry {
  id: string
  command: string
  output: string
  timestamp: Date
  isError?: boolean
}

interface TerminalPanelProps {
  workingDirectory?: string | null
}

export default function TerminalPanel({ workingDirectory }: TerminalPanelProps) {
  const [entries, setEntries] = useState<TerminalEntry[]>([])
  const [currentCommand, setCurrentCommand] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [currentDir, setCurrentDir] = useState('~')
  const [isElectron, setIsElectron] = useState(false)
  const [currentTerminalId, setCurrentTerminalId] = useState<string | null>(null)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Check if we're in Electron environment
  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && !!window.electronAPI)
  }, [])

  // Update current directory when workspace folder changes
  useEffect(() => {
    const updateCurrentDir = async () => {
      if (workingDirectory) {
        try {
          if (window.electronAPI && typeof window.electronAPI.basename === 'function') {
            const folderName = await window.electronAPI.basename(workingDirectory)
            setCurrentDir(folderName)
          } else {
            // Fallback for web environment
            const normalizedPath = workingDirectory.replace(/\\/g, '/')
            const parts = normalizedPath.split('/').filter(part => part.length > 0)
            const folderName = parts.length > 0 ? parts[parts.length - 1] : workingDirectory
            setCurrentDir(folderName)
          }
        } catch (error) {
          console.error('Error getting folder name for terminal:', error)
          setCurrentDir('~')
        }
      }
    }

    updateCurrentDir()
  }, [workingDirectory])

  const scrollToBottom = () => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [entries])

  useEffect(() => {
    // Focus input when component mounts (only for mock terminal)
    if (!isElectron) {
      inputRef.current?.focus()
    }
  }, [isElectron])

  const executeCommand = async () => {
    if (!currentCommand.trim() || isExecuting) return

    const command = currentCommand.trim()
    setCurrentCommand('')
    setIsExecuting(true)

    // Add command to entries
    const newEntry: TerminalEntry = {
      id: Date.now().toString(),
      command,
      output: '',
      timestamp: new Date()
    }

    setEntries(prev => [...prev, newEntry])

    // Execute real command if in Electron environment
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.executeCommand(command, workingDirectory || undefined)
        
        setEntries(prev => prev.map(entry => 
          entry.id === newEntry.id 
            ? { ...entry, output: result.output || '', isError: !result.success }
            : entry
        ))
      } catch (error) {
        setEntries(prev => prev.map(entry => 
          entry.id === newEntry.id 
            ? { ...entry, output: `Error: ${error}`, isError: true }
            : entry
        ))
      }
      setIsExecuting(false)
      return
    }

    // Fallback to mock commands for web environment
    setTimeout(() => {
      let output = ''
      let isError = false

      // Mock command responses
      switch (command.toLowerCase()) {
        case 'ls':
        case 'dir':
          output = 'src/\nnode_modules/\npackage.json\ntsconfig.json\nvite.config.ts\nREADME.md'
          break
        case 'pwd':
          output = workingDirectory || '/home/user/CodeEditor'
          break
        case 'clear':
          setEntries([])
          setIsExecuting(false)
          return
        case 'help':
          output = 'Available commands:\n  ls, dir - list files\n  pwd - print working directory\n  clear - clear terminal\n  help - show this help\n\nNote: This is a mock terminal. In a real implementation, it would execute actual shell commands.'
          break
        default:
          if (command.startsWith('cd ')) {
            const path = command.substring(3).trim()
            setCurrentDir(path || '~')
            output = ''
          } else if (command.startsWith('echo ')) {
            output = command.substring(5)
          } else {
            output = `Command not found: ${command}\nType 'help' for available commands.`
            isError = true
          }
      }

      // Update the entry with output
      setEntries(prev => prev.map(entry => 
        entry.id === newEntry.id 
          ? { ...entry, output, isError }
          : entry
      ))
      setIsExecuting(false)
    }, 500)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand()
    }
  }

  const clearTerminal = () => {
    setEntries([])
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const handleTerminalReady = (terminalId: string) => {
    setCurrentTerminalId(terminalId)
  }

  return (
    <div 
      className="h-full flex flex-col"
      style={{ 
        backgroundColor: 'var(--sidebar)',
        color: 'var(--sidebar-foreground)'
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between"
        style={{ 
          padding: '12px 16px',
          backgroundColor: 'var(--sidebar)',
          borderBottom: '1px solid var(--border)'
        }}
      >
        <div className="flex items-center" style={{ gap: '8px' }}>
          <Terminal size={16} style={{ color: '#10b981' }} />
          <span className="text-sm font-medium">Terminal</span>
          {workingDirectory && (
            <span 
              className="text-xs" 
              style={{ 
                color: 'var(--muted-foreground)',
                marginLeft: '8px'
              }}
            >
              {currentDir}
            </span>
          )}
          {isElectron && (
            <span 
              className="text-xs"
              style={{ 
                color: 'var(--primary)',
                marginLeft: '4px'
              }}
            >
              (Real)
            </span>
          )}
        </div>
        <button
          onClick={clearTerminal}
          className="transition-colors duration-150"
          style={{ 
            padding: '4px',
            color: 'var(--muted-foreground)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--sidebar-accent)'
            e.currentTarget.style.color = 'var(--sidebar-foreground)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = 'var(--muted-foreground)'
          }}
          title="Clear Terminal"
        >
          <X size={12} />
        </button>
      </div>

      {/* Terminal Content */}
      {isElectron ? (
        // Real terminal for Electron
        <div className="flex-1 overflow-hidden">
          <CustomTerminal 
            workingDirectory={workingDirectory}
          />
        </div>
      ) : (
        // Mock terminal for web
        <div 
          ref={terminalRef}
          className="flex-1 overflow-y-auto font-mono text-sm"
          style={{ 
            padding: '16px',
            backgroundColor: 'var(--card)'
          }}
          onClick={() => inputRef.current?.focus()}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {entries.map((entry) => (
              <div key={entry.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div className="flex items-center" style={{ gap: '6px' }}>
                  <span className="font-semibold" style={{ color: '#10b981' }}>user@codeeditor</span>
                  <span style={{ color: 'var(--muted-foreground)' }}>:</span>
                  <span className="font-medium" style={{ color: '#8b5cf6' }}>{currentDir}</span>
                  <span style={{ color: 'var(--muted-foreground)' }}>$</span>
                  <span className="font-medium" style={{ color: 'var(--foreground)' }}>{entry.command}</span>
                </div>
                {entry.output && (
                  <div 
                    className="whitespace-pre-wrap text-sm"
                    style={{ 
                      paddingLeft: '8px',
                      color: entry.isError ? '#f87171' : 'var(--muted-foreground)'
                    }}
                  >
                    {entry.output}
                  </div>
                )}
              </div>
            ))}

            {/* Current input line */}
            <div className="flex items-center" style={{ gap: '6px', paddingTop: '4px' }}>
              <span className="font-semibold" style={{ color: '#10b981' }}>user@codeeditor</span>
              <span style={{ color: 'var(--muted-foreground)' }}>:</span>
              <span className="font-medium" style={{ color: '#8b5cf6' }}>{currentDir}</span>
              <span style={{ color: 'var(--muted-foreground)' }}>$</span>
              <input
                ref={inputRef}
                type="text"
                value={currentCommand}
                onChange={(e) => setCurrentCommand(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 bg-transparent outline-none border-none font-medium"
                style={{ 
                  color: 'var(--foreground)',
                  caretColor: 'var(--primary)'
                }}
                disabled={isExecuting}
                placeholder={isExecuting ? 'Executing...' : ''}
              />
              {isExecuting && (
                <div style={{ color: 'var(--primary)' }}>
                  <span className="animate-pulse">▊</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 