const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const pty = require('node-pty')
const os = require('os')
const isDev = !app.isPackaged || process.env.NODE_ENV === 'development'

// Store active terminal sessions
const terminals = new Map()

function createWindow() {
  // Create the browser window
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.cjs')
    },
    icon: path.join(__dirname, '../public/favicon.ico'),
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    frame: false,
    show: false
  })

  // Load the app
  if (isDev) {
    // Function to try different ports
    const tryPorts = async () => {
      const ports = [5173, 5174, 5175, 3000]
      const http = require('http')
      
      for (const port of ports) {
        try {
          const url = `http://localhost:${port}`
          await new Promise((resolve, reject) => {
            const req = http.get(url, resolve)
            req.on('error', reject)
            req.setTimeout(1000, () => req.destroy())
          })
          console.log(`Found dev server at ${url}`)
          return url
        } catch (e) {
          continue
        }
      }
      throw new Error('No dev server found')
    }
    
    tryPorts()
      .then(url => {
        mainWindow.loadURL(url)
        mainWindow.webContents.openDevTools()
      })
      .catch(() => {
        console.log('Falling back to localhost:5173')
        mainWindow.loadURL('http://localhost:5173')
        mainWindow.webContents.openDevTools()
      })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Handle window closed
  mainWindow.on('closed', () => {
    // Clean up terminals when window closes
    terminals.forEach((terminal) => {
      terminal.kill()
    })
    terminals.clear()
    mainWindow = null
  })
}

// This method will be called when Electron has finished initialization
app.whenReady().then(createWindow)

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // Clean up terminals
  terminals.forEach((terminal) => {
    terminal.kill()
  })
  terminals.clear()
  
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Terminal management
ipcMain.handle('terminal-create', async (event, workingDirectory) => {
  const terminalId = Date.now().toString()
  
  try {
    const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash'
    const cwd = workingDirectory || os.homedir()
    
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: cwd,
      env: process.env
    })

    terminals.set(terminalId, ptyProcess)

    // Handle terminal output
    ptyProcess.onData((data) => {
      const window = BrowserWindow.getFocusedWindow()
      if (window) {
        window.webContents.send('terminal-data', terminalId, data)
      }
    })

    // Handle terminal exit
    ptyProcess.onExit((exitCode) => {
      terminals.delete(terminalId)
      const window = BrowserWindow.getFocusedWindow()
      if (window) {
        window.webContents.send('terminal-exit', terminalId, exitCode)
      }
    })

    return { success: true, terminalId }
  } catch (error) {
    console.error('Failed to create terminal:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('terminal-write', (event, terminalId, data) => {
  const terminal = terminals.get(terminalId)
  if (terminal) {
    terminal.write(data)
    return { success: true }
  }
  return { success: false, error: 'Terminal not found' }
})

ipcMain.handle('terminal-resize', (event, terminalId, cols, rows) => {
  const terminal = terminals.get(terminalId)
  if (terminal) {
    terminal.resize(cols, rows)
    return { success: true }
  }
  return { success: false, error: 'Terminal not found' }
})

ipcMain.handle('terminal-kill', (event, terminalId) => {
  const terminal = terminals.get(terminalId)
  if (terminal) {
    terminal.kill()
    terminals.delete(terminalId)
    return { success: true }
  }
  return { success: false, error: 'Terminal not found' }
})

// IPC handlers for file system operations
ipcMain.handle('read-file', async (event, filePath) => {
  const fs = require('fs').promises
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return { success: true, content }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('write-file', async (event, filePath, content) => {
  const fs = require('fs').promises
  try {
    await fs.writeFile(filePath, content, 'utf-8')
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('list-directory', async (event, dirPath) => {
  const fs = require('fs').promises
  const path = require('path')
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true })
    const result = items.map(item => ({
      name: item.name,
      type: item.isDirectory() ? 'directory' : 'file',
      path: path.join(dirPath, item.name)
    }))
    return { success: true, items: result }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Folder selection dialog
ipcMain.handle('select-folder', async (event) => {
  const window = BrowserWindow.getFocusedWindow()
  try {
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory'],
      title: 'Select Folder'
    })
    
    if (result.canceled) {
      return { success: false, canceled: true }
    }
    
    return { success: true, folderPath: result.filePaths[0] }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Robust command execution using execFile with shell detection
ipcMain.handle('execute-command', async (event, command, cwd) => {
  const { execFile } = require('child_process')
  const { promisify } = require('util')
  const execFileAsync = promisify(execFile)
  
  // Special handling for common commands
  const builtinCommands = {
    'ls': async (args, options) => {
      const fs = require('fs').promises
      const path = require('path')
      try {
        const items = await fs.readdir(options.cwd || process.cwd())
        let output = ''
        
        if (args.includes('-la') || args.includes('-l')) {
          // Detailed listing
          for (const item of items) {
            const itemPath = path.join(options.cwd || process.cwd(), item)
            try {
              const stats = await fs.stat(itemPath)
              const isDir = stats.isDirectory()
              const size = stats.size
              const date = stats.mtime.toLocaleDateString()
              const permissions = isDir ? 'drwxr-xr-x' : '-rw-r--r--'
              output += `${permissions} 1 user user ${size.toString().padStart(8)} ${date} ${item}\n`
            } catch {
              output += `?????????? 1 user user        ? ??? ${item}\n`
            }
          }
        } else {
          // Simple listing
          output = items.join('  ') + '\n'
        }
        
        return { success: true, output, exitCode: 0 }
      } catch (error) {
        return { success: false, output: error.message, exitCode: 1 }
      }
    },
    
    'pwd': async (args, options) => {
      return { 
        success: true, 
        output: options.cwd || process.cwd() + '\n', 
        exitCode: 0 
      }
    },
    
    'echo': async (args, options) => {
      return { 
        success: true, 
        output: args.join(' ') + '\n', 
        exitCode: 0 
      }
    },
    
    'cd': async (args, options) => {
      const path = require('path')
      const fs = require('fs').promises
      
      if (args.length === 0) {
        return { success: true, output: '', exitCode: 0 }
      }
      
      const targetDir = args[0]
      const newPath = path.resolve(options.cwd || process.cwd(), targetDir)
      
      try {
        await fs.access(newPath)
        return { success: true, output: '', exitCode: 0 }
      } catch {
        return { success: false, output: `cd: ${targetDir}: No such file or directory\n`, exitCode: 1 }
      }
    }
  }
  
  return new Promise((resolve) => {
    const commandParts = command.trim().split(/\s+/)
    const program = commandParts[0]
    const args = commandParts.slice(1)
    
    const options = {
      cwd: cwd || process.cwd(),
      env: { ...process.env },
      timeout: 30000,
      maxBuffer: 1024 * 1024
    }
    
    console.log('Executing command:', command)
    console.log('Working directory:', options.cwd)
    
    // Check if it's a builtin command we can handle
    if (builtinCommands[program]) {
      builtinCommands[program](args, options)
        .then(result => resolve(result))
        .catch(error => resolve({
          success: false,
          output: error.message,
          exitCode: 1
        }))
      return
    }
    
    // Try to execute with execFile (more direct than exec)
    execFileAsync(program, args, options)
      .then(({ stdout, stderr }) => {
        resolve({
          success: true,
          output: stdout || stderr,
          exitCode: 0
        })
      })
      .catch((error) => {
        console.error('Command execution error:', error.message)
        
        // If execFile fails, try some common program locations
        const commonLocations = [
          `/usr/bin/${program}`,
          `/bin/${program}`,
          `/usr/local/bin/${program}`
        ]
        
        let attempts = 0
        const tryLocation = (locations) => {
          if (attempts >= locations.length) {
            resolve({
              success: false,
              output: `Command not found: ${program}\nAvailable built-in commands: ${Object.keys(builtinCommands).join(', ')}`,
              exitCode: 127
            })
            return
          }
          
          const location = locations[attempts++]
          execFileAsync(location, args, options)
            .then(({ stdout, stderr }) => {
              resolve({
                success: true,
                output: stdout || stderr,
                exitCode: 0
              })
            })
            .catch(() => tryLocation(locations))
        }
        
        tryLocation(commonLocations)
      })
  })
})

// Window control handlers
ipcMain.handle('window-minimize', () => {
  const window = BrowserWindow.getFocusedWindow()
  if (window) window.minimize()
})

ipcMain.handle('window-maximize', () => {
  const window = BrowserWindow.getFocusedWindow()
  if (window) {
    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
  }
})

ipcMain.handle('window-close', () => {
  const window = BrowserWindow.getFocusedWindow()
  if (window) window.close()
})

ipcMain.handle('window-is-maximized', () => {
  const window = BrowserWindow.getFocusedWindow()
  return window ? window.isMaximized() : false
})

// Path utilities for renderer process
ipcMain.handle('path-dirname', (event, filePath) => {
  const path = require('path')
  return path.dirname(filePath)
})

ipcMain.handle('path-basename', (event, filePath) => {
  const path = require('path')
  return path.basename(filePath)
})

ipcMain.handle('path-join', (event, paths) => {
  const path = require('path')
  return path.join(...paths)
})

// File search functionality for AI tool calls
ipcMain.handle('search-files', async (event, query, directory, filePattern) => {
  const fs = require('fs').promises
  const path = require('path')
  
  try {
    const searchDir = directory || process.cwd()
    
    // Function to recursively search files
    async function searchInDirectory(dir, pattern) {
      const results = []
      
      try {
        const items = await fs.readdir(dir, { withFileTypes: true })
        
        for (const item of items) {
          const fullPath = path.join(dir, item.name)
          
          // Skip common directories we don't want to search
          if (item.isDirectory()) {
            if (['node_modules', '.git', 'dist', 'build', '.next', '.vscode'].includes(item.name)) {
              continue
            }
            // Recursively search subdirectories
            const subResults = await searchInDirectory(fullPath, pattern)
            results.push(...subResults)
          } else if (item.isFile()) {
            // Check if file matches pattern (if provided)
            if (pattern && !item.name.match(new RegExp(pattern.replace('*', '.*')))) {
              continue
            }
            
            // Skip binary files and other files we can't search
            const ext = path.extname(item.name).toLowerCase()
            const textExtensions = ['.txt', '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.css', '.html', '.xml', '.json', '.md', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.sh', '.bash', '.zsh', '.fish', '.sql', '.rs', '.go', '.php', '.rb', '.swift', '.kt', '.scala', '.clj', '.hs', '.elm', '.vue', '.svelte']
            
            if (ext && !textExtensions.includes(ext)) {
              continue
            }
            
            try {
              const content = await fs.readFile(fullPath, 'utf-8')
              const lines = content.split('\n')
              const matches = []
              
              lines.forEach((line, index) => {
                if (line.toLowerCase().includes(query.toLowerCase())) {
                  matches.push({
                    lineNumber: index + 1,
                    line: line.trim(),
                    context: lines.slice(Math.max(0, index - 1), index + 2).join('\n')
                  })
                }
              })
              
              if (matches.length > 0) {
                results.push({
                  file: fullPath,
                  matches: matches
                })
              }
            } catch (readError) {
              // Skip files that can't be read (binary files, permission issues, etc.)
              continue
            }
          }
        }
      } catch (dirError) {
        // Skip directories that can't be accessed
        return results
      }
      
      return results
    }
    
    const results = await searchInDirectory(searchDir, filePattern)
    return { success: true, results }
  } catch (error) {
    return { success: false, error: error.message }
  }
}) 