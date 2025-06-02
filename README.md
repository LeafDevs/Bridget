# Bridget

An open-source AI-assisted code editor built with Electron, React, and TypeScript featuring intelligent coding assistance with tool calling capabilities.

## Features

- **Monaco Editor Integration**: Full-featured code editor with syntax highlighting and IntelliSense
- **Integrated Terminal**: Built-in terminal with PTY support for seamless command execution
- **File Explorer**: Tree-view file browser with intuitive folder navigation
- **AI Chat Assistant**: Intelligent coding assistant that can interact with your development environment
- **Multi-Provider AI Support**: Support for OpenAI, Anthropic, Gemini, OpenRouter, and local Ollama models
- **Tool Calling System**: AI can execute actions in your development environment

## AI-Assisted Development

Bridget's AI assistant goes beyond simple chat - it can actively help with your development workflow by:

- Reading and analyzing your code files
- Making code changes and creating new files
- Running commands and scripts
- Searching through your codebase
- Providing contextual assistance based on your project structure

## Contributing

We welcome contributions to Bridget! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated.

### 🚀 Getting Started

Ready to dive into Bridget development? Follow these simple steps to get your local environment up and running:

#### 📦 Prerequisites
- [Bun](https://bun.sh/) - Fast all-in-one JavaScript runtime
- [Node.js](https://nodejs.org/) (v16 or higher)
- [Git](https://git-scm.com/)

#### 🛠️ Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone https://github.com/leafdevs/bridget.git
   cd bridget
   ```

2. **Install Dependencies**
   ```bash
   bun install
   ```

3. **Launch Development Environment**
   ```bash
   bun run electron-dev
   ```
🎉 **That's it!** Bridget should now be running in development mode. The application will automatically reload when you make changes to the source code.

> **Note:** Changes to the Electron main process (backend) will require restarting the development server, while frontend changes will hot-reload automatically.


#### 🔧 Additional Commands

- `bun run build` - Build the application for production
- `bun run test` - Run the test suite
- `bun run lint` - Check code style and formatting


## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=leafdevs/bridget&type=Date)](https://star-history.com/#leafdevs/bridget&Date)

---

**Made with ❤️ by Leaf**

If you find Bridget helpful, please consider giving us a star! ⭐
