import { useState, useEffect } from 'react'
import { 
  Minus, 
  Square, 
  X, 
  Folder, 
  ChatCircle, 
  Terminal,
  Gear,
  MagnifyingGlass,
  FloppyDisk,
  FolderOpen,
  GitBranch,
  Code,
  Bug
} from '@phosphor-icons/react'

interface TitleBarProps {
  onPanelToggle: (panel: 'fileBrowser' | 'chat' | 'terminal') => void
  panels: {
    fileBrowser: boolean
    chat: boolean
    terminal: boolean
  }
  currentFile: string | null
}

export default function TitleBar({ onPanelToggle, panels, currentFile }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && !!window.electronAPI)
    if (window.electronAPI) {
      window.electronAPI.windowIsMaximized().then(setIsMaximized)
    }
  }, [])

  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.windowMinimize()
    }
  }

  const handleMaximize = () => {
    if (window.electronAPI) {
      window.electronAPI.windowMaximize().then(() => {
        window.electronAPI?.windowIsMaximized().then(setIsMaximized)
      })
    }
  }

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.windowClose()
    }
  }

  return (
    <div 
      className="h-8 flex items-center select-none"
      style={{ 
        backgroundColor: 'var(--sidebar)',
        borderBottom: '1px solid var(--border)',
        padding: '0 12px'
      }}
    >
      {/* Left Side - App Logo */}
      <div className="flex items-center" style={{ gap: '8px' }}>
        <Code size={16} style={{ color: 'var(--primary)' }} />
        <span 
          className="text-sm font-medium"
          style={{ color: 'var(--sidebar-foreground)' }}
        >
          Code Editor
        </span>
      </div>

      {/* Center - Current File */}
      <div className="flex-1 flex justify-center items-center drag-region">
        {currentFile && (
          <div className="flex items-center" style={{ gap: '6px' }}>
            <FolderOpen size={14} style={{ color: 'var(--muted-foreground)' }} />
            <span 
              className="text-xs font-medium"
              style={{ color: 'var(--foreground)' }}
            >
              {currentFile.split('/').pop()}
            </span>
          </div>
        )}
      </div>

      {/* Right Side - Panel Toggles and Window Controls */}
      <div className="flex items-center" style={{ gap: '4px' }}>
        {/* Panel Toggles */}
        <button
          onClick={() => onPanelToggle('fileBrowser')}
          className="transition-colors duration-150"
          style={{ 
            padding: '6px',
            backgroundColor: panels.fileBrowser ? 'var(--sidebar-accent)' : 'transparent',
            color: panels.fileBrowser ? 'var(--sidebar-accent-foreground)' : 'var(--muted-foreground)'
          }}
          onMouseEnter={(e) => {
            if (!panels.fileBrowser) {
              e.currentTarget.style.backgroundColor = 'var(--sidebar-accent)'
              e.currentTarget.style.opacity = '0.5'
              e.currentTarget.style.color = 'var(--sidebar-foreground)'
            }
          }}
          onMouseLeave={(e) => {
            if (!panels.fileBrowser) {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.color = 'var(--muted-foreground)'
            }
          }}
          title="Explorer (Ctrl+B)"
          tabIndex={-1}
        >
          <Folder size={14} />
        </button>
        
        <button
          onClick={() => onPanelToggle('terminal')}
          className="transition-colors duration-150"
          style={{ 
            padding: '6px',
            backgroundColor: panels.terminal ? 'var(--sidebar-accent)' : 'transparent',
            color: panels.terminal ? '#10b981' : 'var(--muted-foreground)'
          }}
          onMouseEnter={(e) => {
            if (!panels.terminal) {
              e.currentTarget.style.backgroundColor = 'var(--sidebar-accent)'
              e.currentTarget.style.opacity = '0.5'
              e.currentTarget.style.color = '#10b981'
            }
          }}
          onMouseLeave={(e) => {
            if (!panels.terminal) {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.color = 'var(--muted-foreground)'
            }
          }}
          title="Terminal (Ctrl+`)"
          tabIndex={-1}
        >
          <Terminal size={14} />
        </button>
        
        <button
          onClick={() => onPanelToggle('chat')}
          className="transition-colors duration-150"
          style={{ 
            padding: '6px',
            backgroundColor: panels.chat ? 'var(--sidebar-accent)' : 'transparent',
            color: panels.chat ? '#8b5cf6' : 'var(--muted-foreground)'
          }}
          onMouseEnter={(e) => {
            if (!panels.chat) {
              e.currentTarget.style.backgroundColor = 'var(--sidebar-accent)'
              e.currentTarget.style.opacity = '0.5'
              e.currentTarget.style.color = '#8b5cf6'
            }
          }}
          onMouseLeave={(e) => {
            if (!panels.chat) {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.color = 'var(--muted-foreground)'
            }
          }}
          title="AI Chat (Ctrl+I)"
          tabIndex={-1}
        >
          <ChatCircle size={14} />
        </button>

        {/* Window Controls */}
        {isElectron && (
          <>
            <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border)', margin: '0 8px' }} />
            <button
              onClick={handleMinimize}
              className="transition-colors duration-150 window-control"
              style={{ 
                padding: '6px',
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
              title="Minimize"
              tabIndex={-1}
            >
              <Minus size={12} />
            </button>
            <button
              onClick={handleMaximize}
              className="transition-colors duration-150 window-control"
              style={{ 
                padding: '6px',
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
              title={isMaximized ? "Restore" : "Maximize"}
              tabIndex={-1}
            >
              <Square size={12} />
            </button>
            <button
              onClick={handleClose}
              className="transition-colors duration-150 window-control"
              style={{ 
                padding: '6px',
                color: 'var(--muted-foreground)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f87171'
                e.currentTarget.style.color = 'white'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = 'var(--muted-foreground)'
              }}
              title="Close"
              tabIndex={-1}
            >
              <X size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  )
} 