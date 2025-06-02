import { useState, useEffect, useCallback } from 'react'
import './App.css'
import MonacoEditor from './components/MonacoEditor'
import ChatPanel from './components/ChatPanel'
import TerminalPanel from './components/TerminalPanel'
import FileBrowser from './components/FileBrowser'
import TitleBar from './components/TitleBar'
import ResizablePanel from './components/ResizablePanel'

interface PanelState {
  chat: boolean
  terminal: boolean
  fileBrowser: boolean
}

function App() {
  const [panels, setPanels] = useState<PanelState>({
    chat: false,
    terminal: false,
    fileBrowser: true // Start with file browser open like VS Code
  })

  const [currentFile, setCurrentFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [workspaceFolder, setWorkspaceFolder] = useState<string | null>(null)

  const togglePanel = useCallback((panel: keyof PanelState) => {
    setPanels(prev => ({
      ...prev,
      [panel]: !prev[panel]
    }))
  }, [])

  useEffect(() => {
    document.documentElement.classList.add('dark')
  })

  // Update workspace folder when a file is selected
  useEffect(() => {
    const updateWorkspaceFolder = async () => {
      if (currentFile && window.electronAPI) {
        try {
          if (typeof window.electronAPI.dirname === 'function') {
            const folderPath = await window.electronAPI.dirname(currentFile)
            setWorkspaceFolder(folderPath)
          }
        } catch (error) {
          console.error('Error getting workspace folder:', error)
          // Fallback - try to extract folder from file path
          const lastSlashIndex = Math.max(currentFile.lastIndexOf('/'), currentFile.lastIndexOf('\\'))
          if (lastSlashIndex > 0) {
            setWorkspaceFolder(currentFile.substring(0, lastSlashIndex))
          }
        }
      }
    }
    updateWorkspaceFolder()
  }, [currentFile])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        switch (e.key) {
          case 'i':
            e.preventDefault()
            togglePanel('chat')
            break
          case '`':
            e.preventDefault()
            togglePanel('terminal')
            break
          case 'b':
            e.preventDefault()
            togglePanel('fileBrowser')
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePanel])

  return (
    <div 
      className="h-screen flex flex-col dark"
      style={{ 
        backgroundColor: 'var(--background)',
        color: 'var(--foreground)'
      }}
    >
      {/* Custom Title Bar */}
      <TitleBar 
        onPanelToggle={togglePanel}
        panels={panels}
        currentFile={currentFile}
      />

      {/* Main Content - VS Code Style Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - File Browser */}
        {panels.fileBrowser && (
          <ResizablePanel
            direction="horizontal"
            initialSize={280}
            minSize={200}
            maxSize={500}
            style={{ 
              backgroundColor: 'var(--sidebar)'
            }}
          >
            <FileBrowser
              onFileSelect={(file: string, content: string) => {
                setCurrentFile(file)
                setFileContent(content)
              }}
            />
          </ResizablePanel>
        )}

        {/* Center Area - Editor + Terminal */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Editor Area */}
          <div 
            className="flex-1 min-h-0"
            style={{ backgroundColor: 'var(--card)' }}
          >
            <MonacoEditor
              value={fileContent}
              onChange={setFileContent}
              language={currentFile ? getLanguageFromFile(currentFile) : 'typescript'}
            />
          </div>

          {/* Bottom Panel - Terminal */}
          {panels.terminal && (
            <ResizablePanel
              direction="vertical"
              initialSize={250}
              minSize={150}
              maxSize={400}
              style={{ 
                backgroundColor: 'var(--sidebar)'
              }}
            >
              <TerminalPanel workingDirectory={workspaceFolder} />
            </ResizablePanel>
          )}
        </div>

        {/* Right Sidebar - Chat Panel */}
        {panels.chat && (
          <ResizablePanel
            direction="horizontal"
            initialSize={350}
            minSize={300}
            maxSize={600}
            style={{ 
              backgroundColor: 'var(--sidebar)'
            }}
          >
            <ChatPanel />
          </ResizablePanel>
        )}
      </div>
    </div>
  )
}

function getLanguageFromFile(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const languageMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'json': 'json',
    'md': 'markdown',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'sql': 'sql',
    'sh': 'shell'
  }
  return languageMap[ext || ''] || 'plaintext'
}

export default App
