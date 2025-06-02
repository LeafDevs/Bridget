import { useState, useEffect } from 'react'
import { 
  Folder, 
  FolderOpen, 
  File, 
  FileText,
  FileJs,
  FilePy,
  FileHtml,
  FileCss,
  FileImage,
  FolderPlus
} from '@phosphor-icons/react'

interface FileItem {
  name: string
  type: 'file' | 'directory'
  path: string
  children?: FileItem[]
  isExpanded?: boolean
}

interface FileBrowserProps {
  onFileSelect: (filePath: string, content: string) => void
}

export default function FileBrowser({ onFileSelect }: FileBrowserProps) {
  const [fileTree, setFileTree] = useState<FileItem[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [currentFolderName, setCurrentFolderName] = useState<string>('')
  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && !!window.electronAPI)
    
    // Load mock data if not in Electron environment
    if (typeof window !== 'undefined' && !window.electronAPI) {
      const mockFileTree: FileItem[] = [
        {
          name: 'src',
          type: 'directory',
          path: 'src',
          isExpanded: true,
          children: [
            {
              name: 'components',
              type: 'directory',
              path: 'src/components',
              isExpanded: false,
              children: [
                { name: 'App.tsx', type: 'file', path: 'src/components/App.tsx' },
                { name: 'Button.tsx', type: 'file', path: 'src/components/Button.tsx' },
                { name: 'Modal.tsx', type: 'file', path: 'src/components/Modal.tsx' }
              ]
            },
            { name: 'App.tsx', type: 'file', path: 'src/App.tsx' },
            { name: 'main.tsx', type: 'file', path: 'src/main.tsx' },
            { name: 'index.css', type: 'file', path: 'src/index.css' }
          ]
        },
        { name: 'package.json', type: 'file', path: 'package.json' },
        { name: 'README.md', type: 'file', path: 'README.md' }
      ]
      setFileTree(mockFileTree)
      setCurrentFolder('Demo Project')
      setCurrentFolderName('Demo Project')
    }
  }, [])

  // Update folder name when currentFolder changes
  useEffect(() => {
    const updateFolderName = async () => {
      if (!currentFolder) {
        setCurrentFolderName('')
        return
      }
      
      try {
        // In Electron environment, use the API
        if (window.electronAPI && typeof window.electronAPI.basename === 'function') {
          const folderName = await window.electronAPI.basename(currentFolder)
          setCurrentFolderName(folderName)
        } else {
          // Fallback for web environment - handle both Windows and Unix paths safely
          const normalizedPath = currentFolder.replace(/\\/g, '/')
          const parts = normalizedPath.split('/').filter(part => part.length > 0)
          const folderName = parts.length > 0 ? parts[parts.length - 1] : currentFolder
          setCurrentFolderName(folderName)
        }
      } catch (error) {
        console.error('Error getting folder name:', error)
        // Final fallback - just return the folder name as-is
        setCurrentFolderName(currentFolder)
      }
    }

    updateFolderName()
  }, [currentFolder])

  // Load folder contents
  const loadFolder = async (folderPath: string) => {
    if (!window.electronAPI) return

    try {
      const result = await window.electronAPI.listDirectory(folderPath)
      if (result.success && result.items) {
        const items = result.items.map((item) => ({
          name: item.name,
          type: item.type,
          path: item.path,
          isExpanded: false,
          children: item.type === 'directory' ? [] : undefined
        }))
        setFileTree(items)
        setCurrentFolder(folderPath)
      } else {
        console.error('Failed to load folder:', result.error)
      }
    } catch (error) {
      console.error('Error loading folder:', error)
    }
  }

  // Handle folder selection
  const handleSelectFolder = async () => {
    if (!window.electronAPI) return

    try {
      const result = await window.electronAPI.selectFolder()
      if (result.success && result.folderPath) {
        await loadFolder(result.folderPath)
      }
    } catch (error) {
      console.error('Error selecting folder:', error)
    }
  }

  // Load directory contents for expansion
  const loadDirectoryContents = async (dirPath: string): Promise<FileItem[]> => {
    if (!window.electronAPI) return []

    try {
      const result = await window.electronAPI.listDirectory(dirPath)
      if (result.success && result.items) {
        return result.items.map((item) => ({
          name: item.name,
          type: item.type,
          path: item.path,
          isExpanded: false,
          children: item.type === 'directory' ? [] : undefined
        }))
      }
    } catch (error) {
      console.error('Error loading directory:', error)
    }
    return []
  }

  const toggleDirectory = async (path: string) => {
    const toggleInTree = async (items: FileItem[]): Promise<FileItem[]> => {
      const result = []
      for (const item of items) {
        if (item.path === path && item.type === 'directory') {
          const newItem = { ...item, isExpanded: !item.isExpanded }
          if (newItem.isExpanded && (!newItem.children || newItem.children.length === 0)) {
            // Load directory contents
            newItem.children = await loadDirectoryContents(path)
          }
          result.push(newItem)
        } else if (item.children) {
          result.push({ ...item, children: await toggleInTree(item.children) })
        } else {
          result.push(item)
        }
      }
      return result
    }
    setFileTree(await toggleInTree(fileTree))
  }

  const handleFileClick = async (item: FileItem) => {
    if (item.type === 'directory') {
      await toggleDirectory(item.path)
    } else {
      setSelectedFile(item.path)
      
      // Read file content if it's a text file
      if (window.electronAPI) {
        try {
          const result = await window.electronAPI.readFile(item.path)
          if (result.success && result.content !== undefined) {
            onFileSelect(item.path, result.content)
          } else {
            console.error('Failed to read file:', result.error)
            onFileSelect(item.path, `// Could not read file: ${result.error || 'Unknown error'}`)
          }
        } catch (error) {
          console.error('Error reading file:', error)
          onFileSelect(item.path, `// Error reading file: ${error}`)
        }
      } else {
        // Mock file content for web environment
        const mockContent = generateMockContent(item.name)
        onFileSelect(item.path, mockContent)
      }
    }
  }

  const generateMockContent = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase()
    
    switch (ext) {
      case 'tsx':
      case 'jsx':
        return `import React from 'react'\n\ninterface Props {\n  // Add your props here\n}\n\nexport default function ${filename.replace(/\.(tsx|jsx)$/, '')}({ }: Props) {\n  return (\n    <div>\n      <h1>Hello from ${filename}</h1>\n    </div>\n  )\n}`
      case 'ts':
      case 'js':
        return `// ${filename}\n\nexport function example() {\n  console.log('Hello from ${filename}')\n}\n\nexport default example`
      case 'css':
        return `/* ${filename} */\n\n.container {\n  display: flex;\n  flex-direction: column;\n  padding: 1rem;\n}\n\n.title {\n  font-size: 2rem;\n  color: #333;\n}`
      case 'json':
        return `{\n  "name": "${filename}",\n  "version": "1.0.0",\n  "description": "A sample JSON file"\n}`
      case 'md':
        return `# ${filename}\n\nThis is a sample markdown file.\n\n## Features\n\n- Feature 1\n- Feature 2\n- Feature 3\n\n## Usage\n\n\`\`\`bash\nnpm install\nnpm start\n\`\`\``
      case 'html':
        return `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Document</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>`
      default:
        return `// ${filename}\n\n// This is a sample file content for ${filename}\n// In the Electron version, this would show real file contents.`
    }
  }

  const getFileIcon = (filename: string, type: 'file' | 'directory') => {
    if (type === 'directory') {
      return { icon: Folder, color: 'var(--primary)' }
    }

    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'tsx':
      case 'jsx':
      case 'ts':
      case 'js':
        return { icon: FileJs, color: '#f59e0b' }
      case 'py':
        return { icon: FilePy, color: '#3b82f6' }
      case 'html':
        return { icon: FileHtml, color: '#f97316' }
      case 'css':
      case 'scss':
        return { icon: FileCss, color: '#06b6d4' }
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return { icon: FileImage, color: '#10b981' }
      case 'md':
        return { icon: FileText, color: 'var(--muted-foreground)' }
      default:
        return { icon: File, color: 'var(--muted-foreground)' }
    }
  }

  const renderFileTree = (items: FileItem[], depth = 0) => {
    return items.map((item) => {
      const { icon: Icon, color } = getFileIcon(item.name, item.type)
      const isSelected = selectedFile === item.path
      
      return (
        <div key={item.path}>
          <div
            className="flex items-center cursor-pointer transition-colors duration-150"
            style={{
              gap: '6px',
              padding: '4px 8px',
              paddingLeft: `${depth * 16 + 8}px`,
              backgroundColor: isSelected ? 'var(--sidebar-accent)' : 'transparent',
              color: isSelected ? 'var(--sidebar-accent-foreground)' : 'var(--sidebar-foreground)'
            }}
            onClick={() => handleFileClick(item)}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.backgroundColor = 'var(--sidebar-accent)'
                e.currentTarget.style.opacity = '0.5'
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.opacity = '1'
              }
            }}
          >
            {item.type === 'directory' ? (
              item.isExpanded ? (
                <FolderOpen size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              ) : (
                <Folder size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              )
            ) : (
              <Icon size={14} style={{ color, flexShrink: 0 }} />
            )}
            <span 
              className="text-sm font-normal truncate"
              style={{
                color: isSelected ? 'var(--sidebar-accent-foreground)' : 'var(--sidebar-foreground)'
              }}
            >
              {item.name}
            </span>
          </div>
          {item.isExpanded && item.children && renderFileTree(item.children, depth + 1)}
        </div>
      )
    })
  }

  return (
    <div 
      className="h-full flex flex-col"
      style={{ backgroundColor: 'var(--sidebar)' }}
    >
      {/* Header */}
      <div 
        style={{ 
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)'
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: '8px' }}>
            <Folder size={16} style={{ color: 'var(--primary)' }} />
            <span 
              className="text-sm font-medium"
              style={{ color: 'var(--sidebar-foreground)' }}
            >
              Explorer
            </span>
          </div>
          {isElectron && (
            <button
              onClick={handleSelectFolder}
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
              title="Open Folder"
            >
              <FolderPlus size={14} />
            </button>
          )}
        </div>
        {currentFolder && (
          <div 
            className="text-xs truncate" 
            style={{ 
              color: 'var(--muted-foreground)', 
              marginTop: '4px' 
            }}
            title={currentFolder}
          >
            {currentFolderName}
          </div>
        )}
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '4px 0' }}>
        {fileTree.length > 0 ? (
          renderFileTree(fileTree)
        ) : (
          <div 
            className="flex flex-col items-center justify-center h-full"
            style={{ color: 'var(--muted-foreground)', padding: '32px 16px' }}
          >
            <Folder size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
            <p className="text-sm text-center" style={{ marginBottom: '8px' }}>
              {isElectron ? 'No folder opened' : 'File browsing not available'}
            </p>
            {isElectron && (
              <button
                onClick={handleSelectFolder}
                className="text-xs transition-colors duration-150"
                style={{ 
                  padding: '8px 16px',
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1'
                }}
              >
                Open Folder
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 