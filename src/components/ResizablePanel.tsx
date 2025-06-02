import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'

interface ResizablePanelProps {
  children: ReactNode
  direction: 'horizontal' | 'vertical'
  initialSize: number
  minSize?: number
  maxSize?: number
  className?: string
  resizerClassName?: string
  style?: React.CSSProperties
}

export default function ResizablePanel({
  children,
  direction,
  initialSize,
  minSize = 200,
  maxSize = 600,
  className = '',
  resizerClassName = '',
  style = {}
}: ResizablePanelProps) {
  const [size, setSize] = useState(initialSize)
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return

      const rect = panelRef.current.getBoundingClientRect()
      let newSize: number

      if (direction === 'horizontal') {
        newSize = e.clientX - rect.left
      } else {
        newSize = rect.bottom - e.clientY
      }

      // Constrain size within bounds
      newSize = Math.max(minSize, Math.min(maxSize, newSize))
      setSize(newSize)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = direction === 'horizontal' ? 'ew-resize' : 'ns-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, direction, minSize, maxSize])

  const handleMouseDown = () => {
    setIsResizing(true)
  }

  const sizeStyle = direction === 'horizontal' 
    ? { width: `${size}px` }
    : { height: `${size}px` }

  const resizerStyle = direction === 'horizontal'
    ? {
        position: 'absolute' as const,
        right: '0',
        top: '0',
        width: '1px',
        height: '100%',
        backgroundColor: 'var(--border)',
        cursor: 'ew-resize',
        zIndex: 10
      }
    : {
        position: 'absolute' as const,
        bottom: '0',
        left: '0',
        width: '100%',
        height: '1px',
        backgroundColor: 'var(--border)',
        cursor: 'ns-resize',
        zIndex: 10
      }

  return (
    <div
      ref={panelRef}
      className={`relative flex-shrink-0 ${className}`}
      style={{ ...sizeStyle, ...style }}
    >
      {children}
      <div
        className={resizerClassName}
        style={resizerStyle}
        onMouseDown={handleMouseDown}
      />
    </div>
  )
} 