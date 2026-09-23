import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import type { DrawEvent, DrawEventType } from '../../types/game';
import './Canvas.css';

interface CanvasProps {
  isDrawing: boolean;  // Whether this player is the drawer
  onDrawEvent: (event: DrawEvent) => void;  // Callback to send event to server
  color: string;
  brushSize: number;
  tool: 'pen' | 'fill';
}

export interface CanvasHandle {
  applyDrawEvent: (event: DrawEvent) => void;
  clearCanvas: () => void;
}

const Canvas = forwardRef<CanvasHandle, CanvasProps>(
  ({ isDrawing, onDrawEvent, color, brushSize, tool }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isMouseDown = useRef(false);
    const lastPos = useRef<{ x: number; y: number } | null>(null);

    // ── Canvas setup ──────────────────────────────────────────────

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }, []);

    // Resize canvas on container resize
    useEffect(() => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const resizeObserver = new ResizeObserver(() => {
        const rect = container.getBoundingClientRect();
        // Save current image
        const imageData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
        canvas.width = rect.width;
        canvas.height = rect.height;
        // Restore
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(imageData, 0, 0);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      });

      resizeObserver.observe(container);
      // Initial sizing
      const rect = container.getBoundingClientRect();
      if (rect.width > 0) {
        const ctx = canvas.getContext('2d')!;
        canvas.width = rect.width;
        canvas.height = rect.height;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      return () => resizeObserver.disconnect();
    }, []);

    // ── Draw locally ──────────────────────────────────────────────

    const drawOnCanvas = useCallback((event: DrawEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;

      if (event.type === 'CLEAR') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
      }

      if (event.type === 'FILL') {
        floodFill(ctx, canvas, Math.round(event.x * canvas.width), Math.round(event.y * canvas.height), event.color);
        return;
      }

      const x = event.x * canvas.width;
      const y = event.y * canvas.height;

      ctx.strokeStyle = event.color;
      ctx.lineWidth = event.brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (event.type === 'START') {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, event.brushSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = event.color;
        ctx.fill();
        lastPos.current = { x: event.x, y: event.y };
      } else if (event.type === 'DRAW') {
        ctx.beginPath();
        if (lastPos.current) {
          ctx.moveTo(lastPos.current.x * canvas.width, lastPos.current.y * canvas.height);
        } else {
          ctx.moveTo(x, y);
        }
        ctx.lineTo(x, y);
        ctx.stroke();
        lastPos.current = { x: event.x, y: event.y };
      } else if (event.type === 'END') {
        lastPos.current = null;
      }
    }, []);

    // ── Expose handle to parent ───────────────────────────────────

    useImperativeHandle(ref, () => ({
      applyDrawEvent: drawOnCanvas,
      clearCanvas: () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      },
    }));

    // Track cursor position for custom brush cursor
    const [cursorPos, setCursorPos] = useState<{ x: number, y: number } | null>(null);
    const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const updateCursorPos = (e: React.MouseEvent | React.TouchEvent) => {
      if ('touches' in e) return; // Hide custom cursor for touch devices
      setCursorPos({ x: e.clientX, y: e.clientY });
      
      // Clear cursor after 1s of inactivity to hide it when mouse leaves window
      if (cursorTimer.current) clearTimeout(cursorTimer.current);
      cursorTimer.current = setTimeout(() => setCursorPos(null), 1000);
    };

    // ── Mouse/Touch helpers ───────────────────────────────────────

    const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      let clientX: number, clientY: number;
      if ('touches' in e) {
        if (e.touches.length === 0) return null;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      return {
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height,
      };
    };

    const emit = useCallback((type: DrawEventType, pos: { x: number; y: number }) => {
      const event: DrawEvent = { type, x: pos.x, y: pos.y, color, brushSize };
      drawOnCanvas(event);
      if (type !== 'END') lastPos.current = pos;
      onDrawEvent(event);
    }, [color, brushSize, drawOnCanvas, onDrawEvent]);

    // ── Event handlers ────────────────────────────────────────────

    const onMouseDown = useCallback((e: React.MouseEvent) => {
      updateCursorPos(e);
      if (!isDrawing) return;
      e.preventDefault();
      isMouseDown.current = true;
      const pos = getPos(e);
      if (!pos) return;
      lastPos.current = null;

      if (tool === 'fill') {
        const event: DrawEvent = { type: 'FILL', x: pos.x, y: pos.y, color, brushSize };
        drawOnCanvas(event);
        onDrawEvent(event);
      } else {
        emit('START', pos);
      }
    }, [isDrawing, tool, emit, color, brushSize, drawOnCanvas, onDrawEvent]);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
      updateCursorPos(e);
      if (!isDrawing || !isMouseDown.current || tool === 'fill') return;
      e.preventDefault();
      const pos = getPos(e);
      if (!pos) return;
      emit('DRAW', pos);
      lastPos.current = pos;
    }, [isDrawing, tool, emit]);

    const onMouseUp = useCallback((e: React.MouseEvent) => {
      updateCursorPos(e);
      if (!isDrawing) return;
      if (isMouseDown.current) {
        isMouseDown.current = false;
        lastPos.current = null;
        const pos = getPos(e);
        if (pos) {
          const event: DrawEvent = { type: 'END', x: pos.x, y: pos.y, color, brushSize };
          onDrawEvent(event);
        }
      }
    }, [isDrawing, color, brushSize, onDrawEvent]);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
      if (!isDrawing) return;
      e.preventDefault();
      isMouseDown.current = true;
      const pos = getPos(e);
      if (!pos) return;
      lastPos.current = null;
      emit('START', pos);
    }, [isDrawing, emit]);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
      if (!isDrawing || !isMouseDown.current) return;
      e.preventDefault();
      const pos = getPos(e);
      if (!pos) return;
      emit('DRAW', pos);
      lastPos.current = pos;
    }, [isDrawing, emit]);

    const onTouchEnd = useCallback((e: React.TouchEvent) => {
      if (!isDrawing) return;
      isMouseDown.current = false;
      lastPos.current = null;
      const pos = getPos(e);
      if (pos) onDrawEvent({ type: 'END', x: pos.x, y: pos.y, color, brushSize });
    }, [isDrawing, color, brushSize, onDrawEvent]);

    const onMouseLeave = useCallback((e: React.MouseEvent) => {
      setCursorPos(null);
      onMouseUp(e);
    }, [onMouseUp]);

    return (
      <div 
        ref={containerRef} 
        className={`canvas-container ${isDrawing ? 'drawing-mode' : 'viewing-mode'}`}
        onMouseMove={updateCursorPos}
        onMouseLeave={() => setCursorPos(null)}
      >
        <canvas
          ref={canvasRef}
          className="drawing-canvas"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{ cursor: isDrawing ? (tool === 'fill' ? 'crosshair' : 'none') : 'default' }}
        />
        {/* Custom cursor for drawing */}
        {isDrawing && tool === 'pen' && cursorPos && (
          <div
            className="custom-cursor"
            style={{ 
              width: brushSize, 
              height: brushSize, 
              background: color,
              left: cursorPos.x,
              top: cursorPos.y
            }}
          />
        )}
      </div>
    );
  }
);

Canvas.displayName = 'Canvas';
export default Canvas;

// ── Flood Fill ────────────────────────────────────────────────────

function floodFill(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  startX: number,
  startY: number,
  fillColorHex: string
) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const targetColor = getPixelColor(data, startX, startY, canvas.width);
  const fillColor = hexToRgb(fillColorHex);
  if (!fillColor) return;

  // Don't fill if same color
  if (
    targetColor[0] === fillColor[0] &&
    targetColor[1] === fillColor[1] &&
    targetColor[2] === fillColor[2]
  ) return;

  const stack = [[startX, startY]];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;

    const currentColor = getPixelColor(data, x, y, canvas.width);
    if (!colorsMatch(currentColor, targetColor)) continue;

    visited.add(key);
    setPixelColor(data, x, y, canvas.width, fillColor);

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  ctx.putImageData(imageData, 0, 0);
}

function getPixelColor(data: Uint8ClampedArray, x: number, y: number, width: number): [number, number, number, number] {
  const idx = (y * width + x) * 4;
  return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
}

function setPixelColor(data: Uint8ClampedArray, x: number, y: number, width: number, color: [number, number, number]) {
  const idx = (y * width + x) * 4;
  data[idx] = color[0];
  data[idx + 1] = color[1];
  data[idx + 2] = color[2];
  data[idx + 3] = 255;
}

function colorsMatch(a: [number, number, number, number], b: [number, number, number, number], tolerance = 30): boolean {
  return (
    Math.abs(a[0] - b[0]) <= tolerance &&
    Math.abs(a[1] - b[1]) <= tolerance &&
    Math.abs(a[2] - b[2]) <= tolerance
  );
}

function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
}
