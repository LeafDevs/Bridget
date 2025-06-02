type Provider = "OpenAI" | "Anthropic" | "Gemini" | "OpenRouter" | "Ollama"

interface ProviderConfig {
    apiKey?: string
    apiBase: string
    provider: Provider
}

const OpenAIConfig: ProviderConfig = {
    apiKey: localStorage.getItem("openai-api-key") || "",
    apiBase: "https://api.openai.com/v1",
    provider: "OpenAI"
}

const AnthropicConfig: ProviderConfig = {
    apiKey: localStorage.getItem("anthropic-api-key") || "",
    apiBase: "https://api.anthropic.com/v1",
    provider: "Anthropic"
}

const GeminiConfig: ProviderConfig = {
    apiKey: localStorage.getItem("gemini-api-key") || "",
    apiBase: "https://api.gemini.com/v1",
    provider: "Gemini"
}

const OpenRouterConfig: ProviderConfig = {
    apiKey: localStorage.getItem("openrouter-api-key") || "",
    apiBase: "https://openrouter.ai/api/v1",
    provider: "OpenRouter"
}

const OllamaConfig: ProviderConfig = {
    apiBase: "http://localhost:11434",
    provider: "Ollama"
}

const OllamaModels = async (): Promise<string[]> => {
    try {
        const resp = await fetch(`${OllamaConfig.apiBase}/api/tags`, {
            method: "GET",
            headers: {
                "Accept": "application/json"
            }
        });
        const data = await resp.json();
        if (data.models && Array.isArray(data.models)) {
            return data.models.map((model: any) => model.name);
        }
        return [];
    } catch {
        return [];
    }
}

// Tool calling interfaces and types
interface ToolCallResult {
    success: boolean
    data?: unknown
    error?: string
}

interface ToolCallParams {
    name: string
    arguments: Record<string, unknown>
}

interface Tool {
    name: string
    description: string
    parameters: {
        type: string
        properties: Record<string, {
            type: string
            description: string
        }>
        required?: string[]
    }
}

// Available tools for AI models
const availableTools: Tool[] = [
    {
        name: "readFile",
        description: "Read the contents of a file",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "The path to the file to read"
                }
            },
            required: ["filePath"]
        }
    },
    {
        name: "writeFile",
        description: "Write content to a file",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "The path to the file to write"
                },
                content: {
                    type: "string",
                    description: "The content to write to the file"
                }
            },
            required: ["filePath", "content"]
        }
    },
    {
        name: "listDirectory",
        description: "List the contents of a directory",
        parameters: {
            type: "object",
            properties: {
                dirPath: {
                    type: "string",
                    description: "The path to the directory to list"
                }
            },
            required: ["dirPath"]
        }
    },
    {
        name: "executeCommand",
        description: "Execute a shell command",
        parameters: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    description: "The command to execute"
                },
                workingDirectory: {
                    type: "string",
                    description: "The working directory to execute the command in"
                }
            },
            required: ["command"]
        }
    },
    {
        name: "searchFiles",
        description: "Search for files containing specific text",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The text to search for"
                },
                directory: {
                    type: "string",
                    description: "The directory to search in"
                },
                filePattern: {
                    type: "string",
                    description: "File pattern to match (e.g., '*.ts', '*.js')"
                }
            },
            required: ["query"]
        }
    }
]

// Tool call executor
const executeToolCall = async (params: ToolCallParams): Promise<ToolCallResult> => {
    if (!window.electronAPI) {
        return {
            success: false,
            error: "Electron API not available - tool calls only work in Electron environment"
        }
    }

    try {
        switch (params.name) {
            case "readFile": {
                const readResult = await window.electronAPI.readFile(params.arguments.filePath as string)
                return readResult
            }

            case "writeFile": {
                const writeResult = await window.electronAPI.writeFile(
                    params.arguments.filePath as string,
                    params.arguments.content as string
                )
                return writeResult
            }

            case "listDirectory": {
                const listResult = await window.electronAPI.listDirectory(params.arguments.dirPath as string)
                return listResult
            }

            case "executeCommand": {
                const execResult = await window.electronAPI.executeCommand(
                    params.arguments.command as string,
                    params.arguments.workingDirectory as string | undefined
                )
                return execResult
            }

            case "searchFiles": {
                const searchResult = await window.electronAPI.searchFiles(
                    params.arguments.query as string,
                    params.arguments.directory as string | undefined,
                    params.arguments.filePattern as string | undefined
                )
                return searchResult
            }

            default:
                return {
                    success: false,
                    error: `Unknown tool: ${params.name}`
                }
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred"
        }
    }
}



// const callOllamaModel = async (model: string, prompt: string, onChunk?: (chunk: string) => void): Promise<string> => {
//     try {
//         const response = await fetch(`${OllamaConfig.apiBase}/api/chat`, {
//             method: "POST",
//             headers: {
//                 "Content-Type": "application/json"
//             },
//             body: JSON.stringify({
//                 model,
//                 messages: [{ role: "user", content: prompt }],
//                 stream: true
//             })
//         });
//         if (!response.ok) {
//             throw new Error(`Ollama API error: ${response.statusText}`);
//         }
//         const reader = response.body?.getReader();
//         if (!reader) {
//             throw new Error("Failed to get response reader from Ollama API");
//         }
//         let result = "";
//         const decoder = new TextDecoder();
//         while (true) {
//             const { done, value } = await reader.read();
//             if (done) break;
            
//             const chunk = decoder.decode(value, { stream: true });
//             const lines = chunk.split('\n').filter(line => line.trim());
            
//             for (const line of lines) {
//                 try {
//                     const parsed = JSON.parse(line);
//                     if (parsed.message?.content) {
//                         const content = parsed.message.content;
//                         result += content;
//                         if (onChunk) {
//                             onChunk(content);
//                         }
//                     }
//                 } catch (parseError) {
//                     // Skip invalid JSON lines
//                     continue;
//                 }
//             }
//         }
//         return result;
//     } catch (error) {
//         console.error("Error calling Ollama model:", error);
//         throw error instanceof Error ? error : new Error("Unknown error occurred while calling Ollama model");
//     }
// }



// Export for use in AI chat components
export {
    type Provider,
    type ProviderConfig,
    type ToolCallResult,
    type ToolCallParams,
    type Tool,
    OpenAIConfig,
    AnthropicConfig,
    GeminiConfig,
    OpenRouterConfig,
    OllamaConfig,
    availableTools,
    OllamaModels,
    // callOllamaModel,
    executeToolCall
}







