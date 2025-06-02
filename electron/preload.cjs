const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File system operations
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  listDirectory: (dirPath) => ipcRenderer.invoke('list-directory', dirPath),
  searchFiles: (query, directory, filePattern) => ipcRenderer.invoke('search-files', query, directory, filePattern),
  
  // Folder selection
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  
  // Path utilities (moved to main process)
  dirname: (filePath) => ipcRenderer.invoke('path-dirname', filePath),
  basename: (filePath) => ipcRenderer.invoke('path-basename', filePath),
  join: (...paths) => ipcRenderer.invoke('path-join', paths),
  
  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  
  // Terminal operations
  terminalCreate: (workingDirectory) => ipcRenderer.invoke('terminal-create', workingDirectory),
  terminalWrite: (terminalId, data) => ipcRenderer.invoke('terminal-write', terminalId, data),
  terminalResize: (terminalId, cols, rows) => ipcRenderer.invoke('terminal-resize', terminalId, cols, rows),
  terminalKill: (terminalId) => ipcRenderer.invoke('terminal-kill', terminalId),
  
  // Terminal event listeners
  onTerminalData: (callback) => {
    ipcRenderer.on('terminal-data', (event, terminalId, data) => callback(terminalId, data))
  },
  onTerminalExit: (callback) => {
    ipcRenderer.on('terminal-exit', (event, terminalId, exitCode) => callback(terminalId, exitCode))
  },
  removeTerminalListeners: () => {
    ipcRenderer.removeAllListeners('terminal-data')
    ipcRenderer.removeAllListeners('terminal-exit')
  },
  
  // Legacy command execution (for backwards compatibility)
  executeCommand: (command, cwd) => ipcRenderer.invoke('execute-command', command, cwd)
}) 