import './Toolbar.css';

const COLORS = [
  '#000000', '#ffffff', '#808080', '#c0c0c0',
  '#ff0000', '#ff6600', '#ffff00', '#00ff00',
  '#00ffff', '#0000ff', '#ff00ff', '#ff69b4',
  '#8b4513', '#006400', '#00008b', '#800080',
  '#ffa500', '#ffd700', '#adff2f', '#40e0d0',
];

const BRUSH_SIZES = [4, 8, 14, 22, 32];

interface ToolbarProps {
  color: string;
  brushSize: number;
  tool: 'pen' | 'fill';
  onColorChange: (color: string) => void;
  onBrushSizeChange: (size: number) => void;
  onToolChange: (tool: 'pen' | 'fill') => void;
  onClear: () => void;
  onUndo: () => void;
  disabled?: boolean;
}

export default function Toolbar({
  color,
  brushSize,
  tool,
  onColorChange,
  onBrushSizeChange,
  onToolChange,
  onClear,
  onUndo,
  disabled = false,
}: ToolbarProps) {
  return (
    <div className={`toolbar ${disabled ? 'toolbar-disabled' : ''}`}>
      {/* Tool buttons */}
      <div className="toolbar-section">
        <button
          className={`tool-btn ${tool === 'pen' ? 'active' : ''}`}
          onClick={() => onToolChange('pen')}
          title="Pen (P)"
          disabled={disabled}
        >
          ✏️
        </button>
        <button
          className={`tool-btn ${tool === 'fill' ? 'active' : ''}`}
          onClick={() => onToolChange('fill')}
          title="Fill (F)"
          disabled={disabled}
        >
          🪣
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Color palette */}
      <div className="color-palette">
        {COLORS.map(c => (
          <button
            key={c}
            className={`color-swatch ${color === c ? 'active' : ''}`}
            style={{ backgroundColor: c }}
            onClick={() => onColorChange(c)}
            title={c}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Custom color */}
      <div className="toolbar-section">
        <label className="custom-color-label" title="Custom color">
          <div className="custom-color-preview" style={{ backgroundColor: color }} />
          <input
            type="color"
            value={color}
            onChange={e => onColorChange(e.target.value)}
            disabled={disabled}
            className="hidden-input"
          />
        </label>
      </div>

      <div className="toolbar-divider" />

      {/* Brush sizes */}
      <div className="brush-sizes">
        {BRUSH_SIZES.map(size => (
          <button
            key={size}
            className={`brush-btn ${brushSize === size ? 'active' : ''}`}
            onClick={() => onBrushSizeChange(size)}
            disabled={disabled}
            title={`${size}px brush`}
          >
            <span
              className="brush-dot"
              style={{ width: Math.min(size, 20), height: Math.min(size, 20), backgroundColor: color }}
            />
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      {/* Actions */}
      <div className="toolbar-section">
        <button
          className="action-btn"
          onClick={onUndo}
          title="Undo (Ctrl+Z)"
          disabled={disabled}
        >
          ↩️
        </button>
        <button
          className="action-btn action-clear"
          onClick={onClear}
          title="Clear canvas"
          disabled={disabled}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
