export interface ElectronAPI {
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
  listDirectory: (dirPath: string) => Promise<{ 
    success: boolean; 
    items?: { name: string; type: 'file' | 'directory'; path: string }[]; 
    error?: string 
  }>
  searchFiles: (query: string, directory?: string, filePattern?: string) => Promise<{
    success: boolean;
    results?: {
      file: string;
      matches: {
        lineNumber: number;
        line: string;
        context: string;
      }[];
    }[];
    error?: string;
  }>
  selectFolder: () => Promise<{ success: boolean; folderPath?: string; canceled?: boolean; error?: string }>
  executeCommand: (command: string, cwd?: string) => Promise<{
    success: boolean;
    output: string;
    exitCode: number;
  }>
  // Path utilities (now async)
  dirname: (filePath: string) => Promise<string>
  basename: (filePath: string) => Promise<string>
  join: (...paths: string[]) => Promise<string>
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>
  terminalCreate: (workingDirectory?: string) => Promise<{ success: boolean; terminalId?: string; error?: string }>
  terminalWrite: (terminalId: string, data: string) => Promise<{ success: boolean; error?: string }>
  terminalResize: (terminalId: string, cols: number, rows: number) => Promise<{ success: boolean; error?: string }>
  terminalKill: (terminalId: string) => Promise<{ success: boolean; error?: string }>
  onTerminalData: (callback: (terminalId: string, data: string) => void) => void
  onTerminalExit: (callback: (terminalId: string, exitCode: number) => void) => void
  removeTerminalListeners: () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
} 