# CodeEditor

A modern code editor built with Electron, React, and TypeScript featuring AI-powered assistance with tool calling capabilities.

## Features

- **Monaco Editor Integration**: Full-featured code editor with syntax highlighting
- **Integrated Terminal**: Built-in terminal with PTY support
- **File Explorer**: Tree-view file browser with folder navigation
- **AI Chat Assistant**: AI-powered coding assistant with tool calling capabilities
- **Multi-Provider AI Support**: Support for OpenAI, Anthropic, Gemini, OpenRouter, and local Ollama models

## AI Tool Calling System

The AI chat assistant has access to several tools that allow it to interact with your development environment:

### Available Tools

1. **File Operations**
   - `readFile`: Read the contents of any file
   - `writeFile`: Create or modify files
   - `listDirectory`: Browse directory contents

2. **Code Analysis**
   - `searchFiles`: Search for text patterns across your codebase
   - Support for various file types (JS, TS, Python, etc.)

3. **System Commands**
   - `executeCommand`: Run shell commands and scripts
   - Full access to your development tools

### Example Usage

You can ask the AI assistant to:

```
"Read the package.json file and show me the dependencies"
"Search for all TODO comments in my TypeScript files"
"Run npm install in the current directory"
"Create a new React component called UserProfile"
"Show me all files in the src/components directory"
```

### Supported AI Providers

- **OpenAI**: GPT-4, GPT-3.5, etc.
- **Anthropic**: Claude models
- **Google Gemini**: Gemini Pro models
- **OpenRouter**: Access to various models
- **Ollama**: Local LLM execution

### Configuration

1. Click the gear icon in the AI Chat panel
2. Select your preferred AI provider
3. Enter the appropriate model name
4. Add your API key (not required for Ollama)

API keys are stored locally and securely in your browser's localStorage.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run electron-dev

# Build for production
npm run dist
```

## Architecture

### Electron Security

The application follows Electron security best practices:
- Context isolation enabled
- Node integration disabled in renderer
- Secure IPC communication between main and renderer processes

### Tool Calling Flow

1. User sends message to AI chat
2. AI processes the request and may call tools
3. Tool calls are executed in the main Electron process
4. Results are returned to AI for final response
5. Complete response with tool execution results shown to user

### File Structure

```
src/
├── components/          # React components
│   ├── ChatPanel.tsx   # AI chat interface
│   ├── FileBrowser.tsx # File explorer
│   └── ...
├── lib/
│   └── AIChat.ts       # AI and tool calling logic
└── types/
    └── electron.d.ts   # TypeScript definitions
```

## Security Considerations

- All file operations are sandboxed to your project directory
- API keys are stored locally and never transmitted except to the chosen AI provider
- Tool execution happens in the main process with appropriate permissions
- Command execution respects system permissions and working directory

## License

MIT License
