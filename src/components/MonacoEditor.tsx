import { useRef, useEffect } from 'react'
import Editor from '@monaco-editor/react'

interface MonacoEditorProps {
  value: string
  onChange: (value: string) => void
  language: string
}

// Helper function to get the computed background color from our CSS variable
function getCardBackgroundColor(): string {
  const tempElement = document.createElement('div')
  tempElement.style.position = 'absolute'
  tempElement.style.visibility = 'hidden'
  tempElement.style.backgroundColor = 'var(--card)'
  document.body.appendChild(tempElement)
  
  const computedStyle = window.getComputedStyle(tempElement)
  const backgroundColor = computedStyle.backgroundColor
  document.body.removeChild(tempElement)
  
  // Convert RGB to hex
  const rgbaMatch = backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/)
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1])
    const g = parseInt(rgbaMatch[2])
    const b = parseInt(rgbaMatch[3])
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
  }
  
  // Fallback to a dark color if conversion fails
  return '#1e1e1e'
}

export default function MonacoEditor({ value, onChange, language }: MonacoEditorProps) {
  const editorRef = useRef<any>(null)

  function handleEditorDidMount(editor: any, monaco: any) {
    editorRef.current = editor
    
    // Create a custom theme that inherits from vs-dark but fixes all gutter backgrounds
    const cardBackground = getCardBackgroundColor()
    
    monaco.editor.defineTheme('vs-dark-custom', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': cardBackground,
        'editorGutter.background': cardBackground,
        'editorGutter.modifiedBackground': cardBackground,
        'editorGutter.addedBackground': cardBackground,
        'editorGutter.deletedBackground': cardBackground,
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#c6c6c6',
        'editorOverviewRuler.background': cardBackground,
        'editorOverviewRuler.border': cardBackground,
        'minimap.background': cardBackground,
      }
    })
    
    monaco.editor.setTheme('vs-dark-custom')
  }

  function handleEditorChange(value: string | undefined) {
    onChange(value || '')
  }

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={language}
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme="vs-dark-custom"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          wordWrap: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          renderWhitespace: 'selection',
          tabSize: 2,
          insertSpaces: true,
          folding: true,
          lineNumbersMinChars: 3,
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible'
          },
          fontFamily: 'var(--font-mono)',
          fontLigatures: true,
          renderLineHighlight: 'line',
          cursorStyle: 'line',
          cursorBlinking: 'smooth',
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false
        }}
      />
    </div>
  )
} 