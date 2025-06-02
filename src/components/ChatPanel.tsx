import { useState, useRef, useEffect } from 'react'
import { PaperPlaneTilt, Robot, User, CaretDown, Lightning, ChatCircle, Gear, X, Trash } from '@phosphor-icons/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  type Provider,
  type ProviderConfig,
  type ToolCallParams,
  type ToolCallResult,
  OpenAIConfig,
  AnthropicConfig,
  GeminiConfig,
  OpenRouterConfig,
  OllamaConfig,
  availableTools,
  executeToolCall,
  OllamaModels
} from '../lib/AIChat'
import { OllamaPrompt } from '../lib/Prompts'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  toolCalls?: ToolCallParams[]
  toolResults?: ToolCallResult[]
  isExecutingTools?: boolean
  executingToolIndex?: number
  continuedContent?: string
  // New structure for multi-round responses
  responseRounds?: Array<{
    content: string
    thinking?: string[]
    toolCalls?: ToolCallParams[]
    toolResults?: ToolCallResult[]
  }>
}

interface ChatSettings {
  provider: Provider
  model: string
  apiKey?: string
}

type ChatMode = 'agent' | 'ask'

const providerModels: Record<Provider, string[]> = {
  'OpenAI': ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  'Anthropic': ['claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'],
  'Gemini': ['gemini-pro', 'gemini-pro-vision'],
  'OpenRouter': ['openai/gpt-4', 'anthropic/claude-3-sonnet', 'google/gemini-pro'],
  'Ollama': []
}

// Fetch Ollama models on component mount

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<ChatMode>('agent')
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [settings, setSettings] = useState<ChatSettings>({
    provider: 'OpenAI',
    model: 'gpt-4',
    apiKey: localStorage.getItem('openai-api-key') || ''
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const settingsMenuRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const fetchOllamaModels = async () => {
      const models = await OllamaModels()
      providerModels.Ollama = models
    }
    fetchOllamaModels()
  }, [])


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Save messages to localStorage
  const saveChat = (messagesToSave: Message[]) => {
    try {
      const chatData = {
        messages: messagesToSave,
        timestamp: new Date().toISOString(),
        settings: settings,
        mode: mode
      }
      localStorage.setItem('recent-chat', JSON.stringify(chatData))
    } catch (error) {
      console.error('Failed to save chat:', error)
    }
  }

  // Load messages from localStorage
  const loadChat = () => {
    try {
      const savedChat = localStorage.getItem('recent-chat')
      if (savedChat) {
        const chatData = JSON.parse(savedChat)
        if (chatData.messages && Array.isArray(chatData.messages)) {
          // Convert timestamp strings back to Date objects
          const restoredMessages = chatData.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
          setMessages(restoredMessages)
          
          // Restore settings and mode if available
          if (chatData.settings) {
            setSettings(chatData.settings)
          }
          if (chatData.mode) {
            setMode(chatData.mode)
          }
          
          return true
        }
      }
    } catch (error) {
      console.error('Failed to load chat:', error)
    }
    return false
  }

  // Clear chat and localStorage
  const clearChat = () => {
    setMessages([{
      id: Date.now().toString(),
      content: 'Hello! I\'m your AI coding assistant. Use the settings menu to configure your AI provider and switch between Agent mode (with tools) or Ask mode (chat only).',
      role: 'assistant',
      timestamp: new Date()
    }])
    localStorage.removeItem('recent-chat')
  }

  // Initialize chat on component mount
  useEffect(() => {
    if (!isInitialized) {
      const loaded = loadChat()
      if (!loaded) {
        // Show welcome message if no saved chat
        setMessages([{
          id: Date.now().toString(),
          content: 'Hello! I\'m your AI coding assistant. Use the settings menu to configure your AI provider and switch between Agent mode (with tools) or Ask mode (chat only).',
          role: 'assistant',
          timestamp: new Date()
        }])
      }
      setIsInitialized(true)
    }
  }, [])

  // Auto-save messages when they change
  useEffect(() => {
    if (isInitialized && messages.length > 0) {
      saveChat(messages)
    }
  }, [messages, isInitialized, settings, mode])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto-resize textarea when input changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  const getProviderConfig = (): ProviderConfig => {
    switch (settings.provider) {
      case 'Anthropic': return AnthropicConfig
      case 'Gemini': return GeminiConfig
      case 'OpenRouter': return OpenRouterConfig
      case 'Ollama': return OllamaConfig
      default: return OpenAIConfig
    }
  }

  const callAI = async (
    messages: Message[], 
    onChunk: (chunk: string) => void
  ): Promise<{ content: string, toolCalls?: ToolCallParams[] }> => {
    const config = getProviderConfig()
    const apiKey = settings.apiKey || config.apiKey

    if (!apiKey && config.provider !== 'Ollama') {
      throw new Error(`API key required for ${config.provider}`)
    }

    let content = ''
    let toolCalls: ToolCallParams[] | undefined

    // Handle Ollama differently - use streaming API
    if (config.provider === 'Ollama') {
      try {
        // Prepare system prompt with replacements
        const currentDate = new Date().toLocaleDateString()
        const currentTime = new Date().toLocaleTimeString()
        const systemPrompt = OllamaPrompt
          .replace('%ai_model%', settings.model)
          .replace('%date%', currentDate)
          .replace('%time%', currentTime)
          .replace('%codebase%', 'Codebase not indexed yet. This will be coming soon')

        // Add system message to the beginning
        const messagesWithSystem = [{ role: 'system', content: systemPrompt }, ...messages]

        const response = await fetch(`${config.apiBase}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: settings.model,
            messages: messagesWithSystem.map(msg => ({
              role: msg.role,
              content: msg.content
            })),
            stream: true
          })
        });
        
        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.statusText}`);
        }
        
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Failed to get response reader from Ollama API");
        }
        
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.message?.content) {
                const chunkContent = parsed.message.content;
                content += chunkContent;
                onChunk(chunkContent);
              }
            } catch (parseError) {
              // Skip invalid JSON lines
              continue;
            }
          }
        }
        
        // For Ollama in agent mode, parse content for tool usage patterns
        if (mode === 'agent') {
          const toolCallMatches = content.match(/\[TOOL_CALL:(\w+)\((.*?)\)\]/g)
          if (toolCallMatches) {
            const parsedToolCalls: ToolCallParams[] = toolCallMatches.map(match => {
              const [, name, argsStr] = match.match(/\[TOOL_CALL:(\w+)\((.*?)\)\]/) || []
              try {
                const args = argsStr ? JSON.parse(argsStr) : {}
                return { name, arguments: args }
              } catch {
                return { name, arguments: {} }
              }
            })
            return { content: content.replace(/\[TOOL_CALL:.*?\]/g, '').trim(), toolCalls: parsedToolCalls }
          }
        }
        
        return { content };
      } catch (error) {
        console.error("Error calling Ollama model:", error);
        throw error instanceof Error ? error : new Error("Unknown error occurred while calling Ollama model");
      }
    }

    // Handle other providers (OpenAI, Anthropic, etc.) with streaming
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (apiKey) {
      if (config.provider === 'OpenAI' || config.provider === 'OpenRouter') {
        headers['Authorization'] = `Bearer ${apiKey}`
      } else if (config.provider === 'Anthropic') {
        headers['x-api-key'] = apiKey
        headers['anthropic-version'] = '2023-06-01'
      }
    }

    // Format messages for API
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    const requestBody: {
      model: string
      messages: Array<{ role: string; content: string }>
      max_tokens: number
      stream: boolean
      tools?: typeof availableTools
    } = {
      model: settings.model,
      messages: formattedMessages,
      max_tokens: 4096,
      stream: true
    }

    // Only include tools in Agent mode (non-Ollama providers)
    if (mode === 'agent') {
      requestBody.tools = availableTools
    }

    const response = await fetch(`${config.apiBase}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error: ${response.status} - ${errorText}`)
    }

    if (!response.body) {
      throw new Error('No response body received')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta

              if (delta?.content) {
                content += delta.content
                onChunk(delta.content)
              }

              // Handle tool calls (first chunk usually contains the tool call info)
              if (delta?.tool_calls && !toolCalls) {
                toolCalls = delta.tool_calls.map((call: any) => ({
                  name: call.function?.name || '',
                  arguments: call.function?.arguments ? JSON.parse(call.function.arguments) : {}
                }))
              }
            } catch (parseError) {
              // Skip invalid JSON
              continue
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return { content, toolCalls }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Create empty assistant message for streaming
    const assistantMessageId = (Date.now() + 1).toString()
    const assistantMessage: Message = {
      id: assistantMessageId,
      content: '',
        role: 'assistant',
        timestamp: new Date()
    }

    setMessages(prev => [...prev, assistantMessage])
    setStreamingMessageId(assistantMessageId)

    try {
      // Stream AI response
      const { content, toolCalls } = await callAI([...messages, userMessage], (chunk: string) => {
        // Update the streaming message with new content
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: msg.content + chunk }
            : msg
        ))
      })

      // Final update with tool calls if any
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content, toolCalls }
          : msg
      ))

      // Execute tool calls iteratively if any (only in agent mode)
      if (mode === 'agent' && toolCalls && toolCalls.length > 0) {
        const maxToolCalls = 20
        let totalToolCallsExecuted = 0
        let responseRounds: Array<{
          content: string
          thinking?: string[]
          toolCalls?: ToolCallParams[]
          toolResults?: ToolCallResult[]
        }> = []

        // Parse initial content for thinking
        const { content: initialCleanContent, thinking: initialThinking } = parseThinkingContent(content)
        
        // Add initial round
        responseRounds.push({
          content: initialCleanContent,
          thinking: initialThinking.length > 0 ? initialThinking : undefined,
          toolCalls: toolCalls,
          toolResults: undefined
        })

        let currentToolCalls = toolCalls
        let roundIndex = 0

        // Iterative tool calling loop
        while (currentToolCalls && currentToolCalls.length > 0 && totalToolCallsExecuted < maxToolCalls) {
          // Check if we're approaching the limit
          if (totalToolCallsExecuted + currentToolCalls.length > maxToolCalls) {
            const remainingCalls = maxToolCalls - totalToolCallsExecuted
            currentToolCalls = currentToolCalls.slice(0, remainingCalls)
          }

          // Update current round with tool calls
          responseRounds[roundIndex].toolCalls = currentToolCalls

          // Show tool execution in real-time
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { 
                  ...msg, 
                  content: initialCleanContent,
                  responseRounds: [...responseRounds],
                  isExecutingTools: true
                }
              : msg
          ))

          const roundResults: ToolCallResult[] = []

          // Execute tools one by one and show progress
          for (let i = 0; i < currentToolCalls.length; i++) {
            const toolCall = currentToolCalls[i]
            const globalToolIndex = totalToolCallsExecuted + i
            
            // Update UI to show current tool being executed
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, executingToolIndex: globalToolIndex }
                : msg
            ))

            try {
              const result = await executeToolCall(toolCall)
              roundResults.push(result)
            } catch (error) {
              roundResults.push({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
            }
          }

          // Update current round with results
          responseRounds[roundIndex].toolResults = roundResults
          totalToolCallsExecuted += currentToolCalls.length

          // Mark current round of tools as completed
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { 
                  ...msg, 
                  responseRounds: [...responseRounds],
                  isExecutingTools: false, 
                  executingToolIndex: undefined 
                }
              : msg
          ))

          // Prepare tool context for this round
          const roundToolContext = roundResults.map((result, i) => {
            const toolName = currentToolCalls[i].name
            const args = JSON.stringify(currentToolCalls[i].arguments)
            if (result.success) {
              return `Tool: ${toolName}(${args})\nResult: ${JSON.stringify(result.data || result)}`
            } else {
              return `Tool: ${toolName}(${args})\nError: ${result.error}`
            }
          }).join('\n\n')

          // Check if we've hit the limit
          if (totalToolCallsExecuted >= maxToolCalls) {
            responseRounds.push({
              content: `*Maximum tool calls (${maxToolCalls}) reached. Please manually continue the conversation if you need more analysis.*`,
              toolCalls: undefined,
              toolResults: undefined
            })
            break
          }

          // Continue the AI conversation with tool results and allow more tool calls
          const continuationPrompt = `Based on the tool execution results, please continue your response. If you need more information to provide a complete answer, feel free to make additional tool calls (e.g., read more files, search different directories, execute commands, etc.). Otherwise, provide your final analysis/conclusion:\n\n${roundToolContext}`

          try {
            let streamingContent = ''
            const { content: newContinuedContent, toolCalls: newToolCalls } = await callAI([
              ...messages, 
              userMessage, 
              { 
                id: assistantMessageId, 
                content: initialCleanContent, 
                role: 'assistant', 
                timestamp: new Date(),
                responseRounds: responseRounds
              },
              {
                id: Date.now().toString(),
                content: continuationPrompt,
                role: 'user',
                timestamp: new Date()
              }
             ], (chunk: string) => {
               // Stream the continued response
               streamingContent += chunk
               const tempRounds = [...responseRounds]
               if (tempRounds.length === roundIndex + 1) {
                 // Add new round for streaming
                 tempRounds.push({
                   content: streamingContent,
                   toolCalls: undefined,
                   toolResults: undefined
                 })
               } else {
                 // Update existing round
                 tempRounds[roundIndex + 1].content = streamingContent
               }
               
               setMessages(prev => prev.map(msg => 
                 msg.id === assistantMessageId 
                   ? { ...msg, responseRounds: tempRounds }
                   : msg
               ))
             })

            // Parse new content for thinking
            const { content: newCleanContent, thinking: newThinking } = parseThinkingContent(newContinuedContent)
            
            // Add new round with results
            responseRounds.push({
              content: newCleanContent,
              thinking: newThinking.length > 0 ? newThinking : undefined,
              toolCalls: newToolCalls,
              toolResults: undefined
            })

            currentToolCalls = newToolCalls || []
            roundIndex++

            // Update message with current progress
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { 
                    ...msg, 
                    responseRounds: [...responseRounds]
                  }
                : msg
            ))

          } catch (error) {
            console.error('Error continuing conversation:', error)
            responseRounds.push({
              content: `*Error continuing conversation: ${error instanceof Error ? error.message : 'Unknown error'}*`,
              toolCalls: undefined,
              toolResults: undefined
            })
            break
          }
        }

        // Final update
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { 
                ...msg, 
                content: initialCleanContent,
                responseRounds: responseRounds,
                isExecutingTools: false,
                executingToolIndex: undefined
              }
            : msg
        ))
      }
    } catch (error) {
      // Update the assistant message with error
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}` }
          : msg
      ))
    } finally {
      setIsLoading(false)
      setStreamingMessageId(null)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const parseThinkingContent = (content: string) => {
    // Parse content sequentially to maintain order of thinking blocks and regular content
    const segments: Array<{type: 'thinking' | 'content', text: string}> = []
    let remainingContent = content
    let hasThinking = false

    while (remainingContent.length > 0) {
      const thinkStart = remainingContent.indexOf('<think>')
      
      if (thinkStart === -1) {
        // No more thinking blocks, add remaining content
        if (remainingContent.trim()) {
          segments.push({type: 'content', text: remainingContent.trim()})
        }
        break
      }

      // Add content before thinking block if any
      if (thinkStart > 0) {
        const beforeThink = remainingContent.substring(0, thinkStart).trim()
        if (beforeThink) {
          segments.push({type: 'content', text: beforeThink})
        }
      }

      // Find the end of thinking block
      const thinkEnd = remainingContent.indexOf('</think>', thinkStart)
      if (thinkEnd === -1) {
        // Unclosed thinking block, treat rest as thinking
        const thinkContent = remainingContent.substring(thinkStart + 7).trim() // +7 for '<think>'
        if (thinkContent) {
          segments.push({type: 'thinking', text: thinkContent})
          hasThinking = true
        }
        break
      }

      // Extract thinking content
      const thinkContent = remainingContent.substring(thinkStart + 7, thinkEnd).trim() // +7 for '<think>'
      if (thinkContent) {
        segments.push({type: 'thinking', text: thinkContent})
        hasThinking = true
      }

      // Continue with content after thinking block
      remainingContent = remainingContent.substring(thinkEnd + 8) // +8 for '</think>'
    }

    // Separate thinking and content segments
    const thinkingSegments = segments.filter(s => s.type === 'thinking').map(s => s.text)
    const contentSegments = segments.filter(s => s.type === 'content').map(s => s.text)
    
    return {
      content: contentSegments.join('\n\n').trim(),
      thinking: thinkingSegments,
      segments: segments, // Keep original order for potential future use
      hasThinking: hasThinking
    }
  }

  const toggleThinking = (messageId: string) => {
    setExpandedThinking(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  const updateSettings = (newSettings: Partial<ChatSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))

    // Save API key to localStorage
    if (newSettings.apiKey !== undefined) {
      const key = `${newSettings.provider || settings.provider}-api-key`.toLowerCase()
      localStorage.setItem(key, newSettings.apiKey)
    }
  }

  const handleProviderChange = (provider: Provider) => {
    const defaultModel = providerModels[provider][0]
    updateSettings({ provider, model: defaultModel })

    // Load API key for new provider
    const apiKey = localStorage.getItem(`${provider.toLowerCase()}-api-key`) || ''
    updateSettings({ apiKey })
  }

  const getProviderColor = (provider: Provider) => {
    const colors = {
      'OpenAI': '#10a37f',
      'Anthropic': '#d4ab5f',
      'Gemini': '#4285f4',
      'OpenRouter': '#6366f1',
      'Ollama': '#1f2937'
    }
    return colors[provider]
  }

  return (
    <div 
      className="h-full flex flex-col"
      style={{ backgroundColor: 'var(--sidebar)' }}
    >
      {/* Compact Header */}
      <div 
        style={{ 
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--sidebar)'
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
          <Robot size={16} style={{ color: '#8b5cf6' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--sidebar-foreground)' }}>
            AI Chat
          </span>
            {/* Compact mode indicator */}
            <div className="flex items-center gap-1">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: getProviderColor(settings.provider) }}
              />
              {mode === 'agent' ? (
                <Lightning size={12} style={{ color: '#f59e0b' }} />
              ) : (
                <ChatCircle size={12} style={{ color: '#6b7280' }} />
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {settings.provider} • {mode === 'agent' ? 'Agent' : 'Ask'}
            </div>
            <button
              onClick={clearChat}
              style={{
                padding: '4px',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--muted-foreground)',
                cursor: 'pointer',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Clear chat"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--sidebar-accent)'
                e.currentTarget.style.color = 'var(--destructive)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = 'var(--muted-foreground)'
              }}
            >
              <Trash size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map((message) => (
            <div
              key={message.id}
              className="flex"
              style={{ 
                gap: '12px',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              {message.role === 'assistant' && (
                <div 
                  className="flex items-center justify-center"
                  style={{ 
                    width: '24px',
                    height: '24px',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}
                >
                  <Robot size={14} style={{ color: '#8b5cf6' }} />
                </div>
              )}
              <div
                style={{
                  maxWidth: message.role === 'user' ? '280px' : '320px',
                  padding: '12px 16px',
                  backgroundColor: message.role === 'user' ? 'var(--primary)' : 'var(--sidebar-accent)',
                  color: message.role === 'user' ? 'var(--primary-foreground)' : 'var(--sidebar-accent-foreground)',
                  borderRadius: '12px'
                }}
              >
                {(() => {
                  const { segments } = parseThinkingContent(message.content)
                  const isThinkingExpanded = expandedThinking.has(message.id)
                  
                  return (
                    <>
                      {/* Render content and thinking blocks in sequential order */}
                      <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
                                        {(() => {
                  const isThinkingExpanded = expandedThinking.has(message.id)
                  
                  // Use new responseRounds structure if available, otherwise fall back to old parsing
                  if (message.responseRounds && message.responseRounds.length > 0) {
                    return message.responseRounds.map((round, roundIndex) => (
                      <div key={`round-${roundIndex}`} style={{ marginBottom: roundIndex < message.responseRounds!.length - 1 ? '16px' : '0' }}>
                        {/* Round Thinking (before tool calls) */}
                        {round.thinking && round.thinking.length > 0 && (
                          <div style={{ margin: '8px 0' }}>
                            <div style={{ marginBottom: '4px' }}>
                              <button
                                onClick={() => toggleThinking(message.id)}
                                style={{
                                  fontSize: '10px',
                                  padding: '3px 6px',
                                  backgroundColor: 'rgba(139, 92, 246, 0.1)',
                                  color: '#8b5cf6',
                                  border: '1px solid rgba(139, 92, 246, 0.3)',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <span>{isThinkingExpanded ? '🧠' : '💭'}</span>
                                <span>{isThinkingExpanded ? 'Hide' : 'Show'} thinking</span>
                              </button>
                            </div>
                            
                            {isThinkingExpanded && (
                              <div style={{
                                padding: '10px',
                                backgroundColor: 'rgba(139, 92, 246, 0.05)',
                                border: '1px solid rgba(139, 92, 246, 0.2)',
                                borderRadius: '6px',
                                borderLeft: '3px solid #8b5cf6',
                                marginBottom: '8px'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  marginBottom: '6px',
                                  fontSize: '10px',
                                  fontWeight: '600',
                                  color: '#8b5cf6'
                                }}>
                                  <span>🧠</span>
                                  <span>AI Thinking</span>
                                </div>
                                {round.thinking.map((thinkBlock, thinkIndex) => (
                                  <div key={thinkIndex} style={{
                                    marginBottom: thinkIndex < round.thinking!.length - 1 ? '8px' : '0',
                                    fontSize: '10px',
                                    lineHeight: '1.3',
                                    color: 'var(--muted-foreground)',
                                    fontStyle: 'italic'
                                  }}>
                                    <ReactMarkdown 
                                      remarkPlugins={[remarkGfm]}
                                      components={{
                                        p: ({children}) => <div style={{ margin: '2px 0', fontSize: '10px' }}>{children}</div>,
                                        code: ({children}) => (
                                          <code style={{
                                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                                            padding: '1px 3px',
                                            borderRadius: '2px',
                                            fontSize: '9px',
                                            fontFamily: 'monospace'
                                          }}>
                                            {children}
                                          </code>
                                        ),
                                        pre: ({children}) => (
                                          <pre style={{
                                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                                            padding: '4px',
                                            borderRadius: '3px',
                                            fontSize: '9px',
                                            overflow: 'auto',
                                            margin: '3px 0'
                                          }}>
                                            {children}
                                          </pre>
                                        )
                                      }}
                                    >
                                      {thinkBlock}
                                    </ReactMarkdown>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Round Content */}
                        {round.content && (
                          <div>
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({children}) => <div style={{ margin: '4px 0', fontSize: '11px' }}>{children}</div>,
                                h1: ({children}) => <h1 style={{ fontSize: '14px', fontWeight: 'bold', margin: '6px 0 4px 0' }}>{children}</h1>,
                                h2: ({children}) => <h2 style={{ fontSize: '13px', fontWeight: 'bold', margin: '6px 0 3px 0' }}>{children}</h2>,
                                h3: ({children}) => <h3 style={{ fontSize: '12px', fontWeight: 'bold', margin: '5px 0 3px 0' }}>{children}</h3>,
                                code: ({className, children, ...props}: any) => {
                                  const match = /language-(\w+)/.exec(className || '')
                                  const language = match ? match[1] : ''
                                  const isInline = !language
                                  
                                  return !isInline ? (
                                    <SyntaxHighlighter
                                      style={vscDarkPlus as any}
                                      language={language}
                                      PreTag="div"
                                      customStyle={{
                                        margin: '6px 0',
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        lineHeight: '1.3',
                                        padding: '8px'
                                      }}
                                    >
                                      {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                  ) : (
                                    <code style={{
                                      backgroundColor: 'var(--sidebar)',
                                      padding: '1px 3px',
                                      borderRadius: '2px',
                                      fontSize: '10px',
                                      fontFamily: 'monospace',
                                      border: '1px solid var(--border)'
                                    }} {...props}>
                                      {children}
                                    </code>
                                  )
                                },
                                pre: ({children}) => (
                                  <div style={{ margin: '6px 0' }}>
                                    {children}
                                  </div>
                                ),
                                ul: ({children}) => <ul style={{ margin: '3px 0', paddingLeft: '14px', fontSize: '11px' }}>{children}</ul>,
                                ol: ({children}) => <ol style={{ margin: '3px 0', paddingLeft: '14px', fontSize: '11px' }}>{children}</ol>,
                                li: ({children}) => <li style={{ margin: '1px 0', fontSize: '11px' }}>{children}</li>,
                                blockquote: ({children}) => (
                                  <blockquote style={{
                                    borderLeft: '2px solid var(--border)',
                                    paddingLeft: '6px',
                                    margin: '4px 0',
                                    fontStyle: 'italic',
                                    color: 'var(--muted-foreground)',
                                    fontSize: '10px'
                                  }}>
                                    {children}
                                  </blockquote>
                                ),
                                table: ({children}) => (
                                  <table style={{
                                    borderCollapse: 'collapse',
                                    margin: '6px 0',
                                    fontSize: '10px'
                                  }}>
                                    {children}
                                  </table>
                                ),
                                th: ({children}) => (
                                  <th style={{
                                    border: '1px solid var(--border)',
                                    padding: '3px 6px',
                                    backgroundColor: 'var(--sidebar)',
                                    fontWeight: 'bold',
                                    fontSize: '10px'
                                  }}>
                                    {children}
                                  </th>
                                ),
                                td: ({children}) => (
                                  <td style={{
                                    border: '1px solid var(--border)',
                                    padding: '3px 6px',
                                    fontSize: '10px'
                                  }}>
                                    {children}
                                  </td>
                                )
                              }}
                            >
                              {round.content}
                            </ReactMarkdown>
                          </div>
                        )}

                        {/* Round Tool Calls */}
                        {round.toolCalls && round.toolCalls.length > 0 && (
                          <div style={{ margin: '8px 0' }}>
                            {round.toolCalls.map((call, i) => {
                              const isCurrentlyExecuting = message.isExecutingTools && message.executingToolIndex === i
                              const isCompleted = round.toolResults && round.toolResults[i]
                              const result = round.toolResults?.[i]
                              
                              return (
                                <div key={i} style={{ 
                                  marginBottom: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '10px',
                                  opacity: isCompleted ? 0.8 : isCurrentlyExecuting ? 1 : 0.6,
                                  padding: '4px 8px',
                                  backgroundColor: 'rgba(139, 92, 246, 0.08)',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(139, 92, 246, 0.2)'
                                }}>
                                  {isCurrentlyExecuting && (
                                    <span style={{ color: '#f59e0b', animation: 'pulse 1s infinite' }}>⚡</span>
                                  )}
                                  {isCompleted && !isCurrentlyExecuting && (
                                    <span style={{ color: result?.success ? '#10b981' : '#ef4444' }}>
                                      {result?.success ? '✅' : '❌'}
                                    </span>
                                  )}
                                  <span style={{ 
                                    fontWeight: isCurrentlyExecuting ? '600' : '400',
                                    color: 'var(--muted-foreground)'
                                  }}>
                                    Used {call.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} tool
                                    {Object.keys(call.arguments).length > 0 && (
                                      <span style={{ opacity: 0.7, fontSize: '9px' }}>
                                        ({Object.entries(call.arguments).map(([key, value]) => 
                                          `${key}: ${typeof value === 'string' && value.length > 15 ? 
                                            value.substring(0, 15) + '...' : JSON.stringify(value)}`
                                        ).join(', ')})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))
                  } else {
                    // Fallback to old parsing for messages without responseRounds
                    const { segments } = parseThinkingContent(message.content)
                    
                    return segments.map((segment, index) => {
                      if (segment.type === 'thinking') {
                        return (
                          <div key={`thinking-${index}`} style={{ margin: '8px 0' }}>
                            <div style={{ marginBottom: '4px' }}>
                              <button
                                onClick={() => toggleThinking(message.id)}
                                style={{
                                  fontSize: '10px',
                                  padding: '3px 6px',
                                  backgroundColor: 'rgba(139, 92, 246, 0.1)',
                                  color: '#8b5cf6',
                                  border: '1px solid rgba(139, 92, 246, 0.3)',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <span>{isThinkingExpanded ? '🧠' : '💭'}</span>
                                <span>{isThinkingExpanded ? 'Hide' : 'Show'} thinking</span>
                              </button>
                            </div>
                            
                            {isThinkingExpanded && (
                              <div style={{
                                padding: '10px',
                                backgroundColor: 'rgba(139, 92, 246, 0.05)',
                                border: '1px solid rgba(139, 92, 246, 0.2)',
                                borderRadius: '6px',
                                borderLeft: '3px solid #8b5cf6'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  marginBottom: '6px',
                                  fontSize: '10px',
                                  fontWeight: '600',
                                  color: '#8b5cf6'
                                }}>
                                  <span>🧠</span>
                                  <span>AI Thinking</span>
                                </div>
                                <div style={{
                                  fontSize: '10px',
                                  lineHeight: '1.3',
                                  color: 'var(--muted-foreground)',
                                  fontStyle: 'italic'
                                }}>
                                  <ReactMarkdown 
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                      p: ({children}) => <div style={{ margin: '2px 0', fontSize: '10px' }}>{children}</div>,
                                      code: ({children}) => (
                                        <code style={{
                                          backgroundColor: 'rgba(139, 92, 246, 0.1)',
                                          padding: '1px 3px',
                                          borderRadius: '2px',
                                          fontSize: '9px',
                                          fontFamily: 'monospace'
                                        }}>
                                          {children}
                                        </code>
                                      ),
                                      pre: ({children}) => (
                                        <pre style={{
                                          backgroundColor: 'rgba(139, 92, 246, 0.1)',
                                          padding: '4px',
                                          borderRadius: '3px',
                                          fontSize: '9px',
                                          overflow: 'auto',
                                          margin: '3px 0'
                                        }}>
                                          {children}
                                        </pre>
                                      )
                                    }}
                                  >
                                    {segment.text}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      } else {
                        return (
                          <div key={`content-${index}`}>
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({children}) => <div style={{ margin: '4px 0', fontSize: '11px' }}>{children}</div>,
                                h1: ({children}) => <h1 style={{ fontSize: '14px', fontWeight: 'bold', margin: '6px 0 4px 0' }}>{children}</h1>,
                                h2: ({children}) => <h2 style={{ fontSize: '13px', fontWeight: 'bold', margin: '6px 0 3px 0' }}>{children}</h2>,
                                h3: ({children}) => <h3 style={{ fontSize: '12px', fontWeight: 'bold', margin: '5px 0 3px 0' }}>{children}</h3>,
                                code: ({className, children, ...props}: any) => {
                                  const match = /language-(\w+)/.exec(className || '')
                                  const language = match ? match[1] : ''
                                  const isInline = !language
                                  
                                  return !isInline ? (
                                    <SyntaxHighlighter
                                      style={vscDarkPlus as any}
                                      language={language}
                                      PreTag="div"
                                      customStyle={{
                                        margin: '6px 0',
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        lineHeight: '1.3',
                                        padding: '8px'
                                      }}
                                    >
                                      {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                  ) : (
                                    <code style={{
                                      backgroundColor: 'var(--sidebar)',
                                      padding: '1px 3px',
                                      borderRadius: '2px',
                                      fontSize: '10px',
                                      fontFamily: 'monospace',
                                      border: '1px solid var(--border)'
                                    }} {...props}>
                                      {children}
                                    </code>
                                  )
                                },
                                pre: ({children}) => (
                                  <div style={{ margin: '6px 0' }}>
                                    {children}
                                  </div>
                                ),
                                ul: ({children}) => <ul style={{ margin: '3px 0', paddingLeft: '14px', fontSize: '11px' }}>{children}</ul>,
                                ol: ({children}) => <ol style={{ margin: '3px 0', paddingLeft: '14px', fontSize: '11px' }}>{children}</ol>,
                                li: ({children}) => <li style={{ margin: '1px 0', fontSize: '11px' }}>{children}</li>,
                                blockquote: ({children}) => (
                                  <blockquote style={{
                                    borderLeft: '2px solid var(--border)',
                                    paddingLeft: '6px',
                                    margin: '4px 0',
                                    fontStyle: 'italic',
                                    color: 'var(--muted-foreground)',
                                    fontSize: '10px'
                                  }}>
                                    {children}
                                  </blockquote>
                                ),
                                table: ({children}) => (
                                  <table style={{
                                    borderCollapse: 'collapse',
                                    margin: '6px 0',
                                    fontSize: '10px'
                                  }}>
                                    {children}
                                  </table>
                                ),
                                th: ({children}) => (
                                  <th style={{
                                    border: '1px solid var(--border)',
                                    padding: '3px 6px',
                                    backgroundColor: 'var(--sidebar)',
                                    fontWeight: 'bold',
                                    fontSize: '10px'
                                  }}>
                                    {children}
                                  </th>
                                ),
                                td: ({children}) => (
                                  <td style={{
                                    border: '1px solid var(--border)',
                                    padding: '3px 6px',
                                    fontSize: '10px'
                                  }}>
                                    {children}
                                  </td>
                                )
                              }}
                            >
                              {segment.text}
                            </ReactMarkdown>
                          </div>
                        )
                      }
                    })
                  }
                })()}


                      </div>
                    </>
                  )
                })()}

                <p
                  className="mt-2"
                  style={{ 
                    opacity: 0.7, 
                    fontSize: '10px'
                  }}
                >
                  {formatTime(message.timestamp)}
                </p>
              </div>
              {message.role === 'user' && (
                <div 
                  className="flex items-center justify-center"
                  style={{ 
                    width: '24px',
                    height: '24px',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}
                >
                  <User size={14} style={{ color: 'var(--primary)' }} />
                </div>
              )}
            </div>
          ))}
          {isLoading && !streamingMessageId && (
            <div className="flex" style={{ gap: '12px', justifyContent: 'flex-start' }}>
              <div 
                className="flex items-center justify-center"
                style={{ 
                  width: '24px',
                  height: '24px',
                  flexShrink: 0,
                  marginTop: '2px'
                }}
              >
                <Robot size={14} style={{ color: '#8b5cf6' }} />
              </div>
              <div 
                style={{
                  backgroundColor: 'var(--sidebar-accent)',
                  color: 'var(--sidebar-accent-foreground)',
                  padding: '12px 16px',
                  borderRadius: '12px'
                }}
              >
                <div className="flex" style={{ gap: '4px' }}>
                  <div 
                    className="rounded-full animate-pulse"
                    style={{ 
                      width: '6px', 
                      height: '6px', 
                      backgroundColor: 'var(--muted-foreground)' 
                    }}
                  ></div>
                  <div 
                    className="rounded-full animate-pulse"
                    style={{ 
                      width: '6px', 
                      height: '6px', 
                      backgroundColor: 'var(--muted-foreground)',
                      animationDelay: '0.2s'
                    }}
                  ></div>
                  <div 
                    className="rounded-full animate-pulse"
                    style={{ 
                      width: '6px', 
                      height: '6px', 
                      backgroundColor: 'var(--muted-foreground)',
                      animationDelay: '0.4s'
                    }}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Compact Input Area with Integrated Settings */}
      <div 
        style={{ 
          padding: '12px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--sidebar)'
        }}
      >
        {/* Settings Menu */}
        {showSettingsMenu && (
          <div
            ref={settingsMenuRef}
            style={{
              marginBottom: '16px',
              padding: '16px',
              backgroundColor: 'var(--sidebar)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '12px' 
            }}>
              <span style={{ 
                fontSize: '14px', 
                fontWeight: '600', 
                color: 'var(--sidebar-foreground)' 
              }}>
                Settings
              </span>
              <button
                onClick={() => setShowSettingsMenu(false)}
                style={{
                  padding: '4px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--muted-foreground)',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Mode Selection */}
              <div>
                <label style={{ 
                  fontSize: '12px', 
                  fontWeight: '500', 
                  color: 'var(--sidebar-foreground)',
                  marginBottom: '4px',
                  display: 'block'
                }}>
                  Mode
                </label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as ChatMode)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    backgroundColor: 'var(--sidebar-accent)',
                    color: 'var(--sidebar-foreground)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    outline: 'none'
                  }}
                >
                  <option value="agent">🤖 Agent (with tools)</option>
                  <option value="ask">💬 Ask (chat only)</option>
                </select>
              </div>

              {/* Provider & Model inline */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: 'var(--sidebar-foreground)',
                    marginBottom: '4px',
                    display: 'block'
                  }}>
                    Provider
                  </label>
                  <select
                    value={settings.provider}
                    onChange={(e) => handleProviderChange(e.target.value as Provider)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      backgroundColor: 'var(--sidebar-accent)',
                      color: 'var(--sidebar-foreground)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      outline: 'none'
                    }}
                  >
                    {Object.keys(providerModels).map((provider) => (
                      <option key={provider} value={provider}>{provider}</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ flex: 1 }}>
                  <label style={{ 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: 'var(--sidebar-foreground)',
                    marginBottom: '4px',
                    display: 'block'
                  }}>
                    Model
                  </label>
                  <select
                    value={settings.model}
                    onChange={(e) => updateSettings({ model: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      backgroundColor: 'var(--sidebar-accent)',
                      color: 'var(--sidebar-foreground)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      outline: 'none'
                    }}
                  >
                    {providerModels[settings.provider].map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* API Key */}
              {settings.provider !== 'Ollama' && (
                <div>
                  <label style={{ 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: 'var(--sidebar-foreground)',
                    marginBottom: '4px',
                    display: 'block'
                  }}>
                    API Key
                  </label>
                  <input
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) => updateSettings({ apiKey: e.target.value })}
                    placeholder={`Enter ${settings.provider} API key...`}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      backgroundColor: 'var(--sidebar-accent)',
                      color: 'var(--sidebar-foreground)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      outline: 'none',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <div
          className="flex flex-col gap-2 p-2 rounded-xl border"
          style={{
            backgroundColor: 'var(--sidebar-accent)',
            borderColor: 'var(--border)'
          }}
        >
          <div className="flex gap-2 p-2 rounded-xl">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                // Auto-resize textarea
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              onKeyPress={handleKeyPress}
              placeholder={mode === 'agent'
                ? "Ask me to read files, run commands, or analyze your code..."
                : "Ask me anything about coding..."
              }
              className="flex-1 text-sm resize-none focus:outline-none bg-transparent overflow-hidden"
              style={{
                color: 'var(--sidebar-accent-foreground)',
                padding: '8px 12px',
                minHeight: '20px',
                maxHeight: '120px',
                height: '20px',
                lineHeight: '1.4'
              }}
              disabled={isLoading}
            />
          </div>

          <div className="flex flex-row gap-2 p-2 rounded-xl justify-between">
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="p-2 rounded-lg transition-all duration-200 hover:scale-105"
              style={{
                backgroundColor: showSettingsMenu ? 'var(--primary)' : 'var(--muted)',
                color: showSettingsMenu ? 'var(--primary-foreground)' : 'var(--muted-foreground)'
              }}
              title="Settings"
            >
              <Gear size={14} />
            </button>
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              className="p-2 rounded-lg transition-all duration-200 hover:scale-105"
              style={{
                backgroundColor: !input.trim() || isLoading ? 'var(--muted)' : 'var(--primary)',
                color: !input.trim() || isLoading ? 'var(--muted-foreground)' : 'var(--primary-foreground)',
                cursor: !input.trim() || isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              <PaperPlaneTilt size={14} />
            </button>
          </div>
        </div>

        {/* Compact Status */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: getProviderColor(settings.provider) }}
            />
            <span>{settings.provider}</span>
            <span>•</span>
            <span>{settings.model}</span>
            {mode === 'agent' && (
              <>
                <span>•</span>
                <Lightning size={10} />
                <span>Tools</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 