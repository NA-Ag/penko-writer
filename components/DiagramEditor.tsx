import React, { useState, useRef, useEffect } from 'react';
import { X, Square, Circle, Diamond, ArrowRight, Type, Download, Trash2, Move } from 'lucide-react';
import { t, LanguageCode } from '../utils/translations';

type ShapeType = 'rectangle' | 'circle' | 'diamond';

interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
}

interface Connector {
  id: string;
  from: string; // shape id
  to: string; // shape id
}

interface DiagramEditorProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
  onInsert?: (svgContent: string) => void;
}

export const DiagramEditor: React.FC<DiagramEditorProps> = ({
  isOpen,
  onClose,
  darkMode,
  uiLanguage,
  onInsert
}) => {
  const canvasRef = useRef<SVGSVGElement>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [selectedTool, setSelectedTool] = useState<ShapeType | 'arrow' | 'select'>('select');
  const [selectedShape, setSelectedShape] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);

  // Add shape to canvas
  const addShape = (x: number, y: number, type: ShapeType) => {
    const newShape: Shape = {
      id: `shape-${Date.now()}`,
      type,
      x,
      y,
      width: type === 'circle' ? 80 : 120,
      height: type === 'circle' ? 80 : type === 'diamond' ? 100 : 60,
      text: '',
      color: '#3b82f6'
    };
    setShapes([...shapes, newShape]);
    setSelectedShape(newShape.id);
  };

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (selectedTool !== 'select' && selectedTool !== 'arrow') {
      addShape(x - 60, y - 30, selectedTool);
      setSelectedTool('select');
    }
  };

  // Handle shape click
  const handleShapeClick = (e: React.MouseEvent, shapeId: string) => {
    e.stopPropagation();

    if (selectedTool === 'arrow') {
      if (!connectingFrom) {
        setConnectingFrom(shapeId);
      } else if (connectingFrom !== shapeId) {
        const newConnector: Connector = {
          id: `connector-${Date.now()}`,
          from: connectingFrom,
          to: shapeId
        };
        setConnectors([...connectors, newConnector]);
        setConnectingFrom(null);
      }
    } else {
      setSelectedShape(shapeId);
    }
  };

  // Handle shape drag
  const handleShapeDragStart = (e: React.MouseEvent, shapeId: string) => {
    if (selectedTool !== 'select') return;
    e.stopPropagation();
    setIsDragging(true);
    setSelectedShape(shapeId);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleShapeDrag = (e: React.MouseEvent) => {
    if (!isDragging || !selectedShape) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    setShapes(shapes.map(shape =>
      shape.id === selectedShape
        ? { ...shape, x: shape.x + deltaX, y: shape.y + deltaY }
        : shape
    ));

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleShapeDragEnd = () => {
    setIsDragging(false);
  };

  // Update shape text
  const updateShapeText = (shapeId: string, text: string) => {
    setShapes(shapes.map(shape =>
      shape.id === shapeId ? { ...shape, text } : shape
    ));
  };

  // Delete selected shape
  const deleteShape = () => {
    if (!selectedShape) return;
    setShapes(shapes.filter(s => s.id !== selectedShape));
    setConnectors(connectors.filter(c => c.from !== selectedShape && c.to !== selectedShape));
    setSelectedShape(null);
  };

  // Export to SVG
  const exportToSVG = () => {
    if (!canvasRef.current) return;
    const svgContent = canvasRef.current.outerHTML;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'diagram.svg';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export to PNG
  const exportToPNG = () => {
    if (!canvasRef.current) return;

    const svgData = new XMLSerializer().serializeToString(canvasRef.current);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    canvas.width = 800;
    canvas.height = 600;

    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = darkMode ? '#1e1e1e' : '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'diagram.png';
            link.click();
            URL.revokeObjectURL(url);
          }
        });
      }
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  // Render shape
  const renderShape = (shape: Shape) => {
    const isSelected = selectedShape === shape.id;
    const strokeColor = isSelected ? '#ef4444' : '#6b7280';

    switch (shape.type) {
      case 'rectangle':
        return (
          <g key={shape.id}>
            <rect
              x={shape.x}
              y={shape.y}
              width={shape.width}
              height={shape.height}
              fill={shape.color}
              stroke={strokeColor}
              strokeWidth={isSelected ? 2 : 1}
              rx={4}
              style={{ cursor: selectedTool === 'select' ? 'move' : 'pointer' }}
              onClick={(e) => handleShapeClick(e, shape.id)}
              onMouseDown={(e) => handleShapeDragStart(e, shape.id)}
            />
            <text
              x={shape.x + shape.width / 2}
              y={shape.y + shape.height / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="14"
              pointerEvents="none"
            >
              {shape.text}
            </text>
          </g>
        );

      case 'circle':
        return (
          <g key={shape.id}>
            <circle
              cx={shape.x + shape.width / 2}
              cy={shape.y + shape.height / 2}
              r={shape.width / 2}
              fill={shape.color}
              stroke={strokeColor}
              strokeWidth={isSelected ? 2 : 1}
              style={{ cursor: selectedTool === 'select' ? 'move' : 'pointer' }}
              onClick={(e) => handleShapeClick(e, shape.id)}
              onMouseDown={(e) => handleShapeDragStart(e, shape.id)}
            />
            <text
              x={shape.x + shape.width / 2}
              y={shape.y + shape.height / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="14"
              pointerEvents="none"
            >
              {shape.text}
            </text>
          </g>
        );

      case 'diamond':
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        const points = `${cx},${shape.y} ${shape.x + shape.width},${cy} ${cx},${shape.y + shape.height} ${shape.x},${cy}`;

        return (
          <g key={shape.id}>
            <polygon
              points={points}
              fill={shape.color}
              stroke={strokeColor}
              strokeWidth={isSelected ? 2 : 1}
              style={{ cursor: selectedTool === 'select' ? 'move' : 'pointer' }}
              onClick={(e) => handleShapeClick(e, shape.id)}
              onMouseDown={(e) => handleShapeDragStart(e, shape.id)}
            />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="14"
              pointerEvents="none"
            >
              {shape.text}
            </text>
          </g>
        );
    }
  };

  // Render connector
  const renderConnector = (connector: Connector) => {
    const fromShape = shapes.find(s => s.id === connector.from);
    const toShape = shapes.find(s => s.id === connector.to);

    if (!fromShape || !toShape) return null;

    const x1 = fromShape.x + fromShape.width / 2;
    const y1 = fromShape.y + fromShape.height / 2;
    const x2 = toShape.x + toShape.width / 2;
    const y2 = toShape.y + toShape.height / 2;

    return (
      <g key={connector.id}>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#6b7280"
          strokeWidth={2}
          markerEnd="url(#arrowhead)"
        />
      </g>
    );
  };

  if (!isOpen) return null;

  const bg = darkMode ? 'bg-[#1e1e1e] border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-900';
  const toolBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-gray-50';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className={`w-[90vw] h-[90vh] rounded-lg shadow-2xl border flex flex-col ${bg}`}>
        {/* Header */}
        <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className="text-lg font-bold">{t(uiLanguage, 'diagramEditor')}</h2>
          <button onClick={onClose} className="opacity-60 hover:opacity-100">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Toolbar */}
          <div className={`w-16 border-r flex flex-col items-center gap-2 p-2 ${darkMode ? 'border-gray-700' : 'border-gray-200'} ${toolBg}`}>
            <button
              onClick={() => setSelectedTool('select')}
              className={`p-2 rounded ${selectedTool === 'select' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              title="Select"
            >
              <Move size={20} />
            </button>
            <button
              onClick={() => setSelectedTool('rectangle')}
              className={`p-2 rounded ${selectedTool === 'rectangle' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              title="Rectangle"
            >
              <Square size={20} />
            </button>
            <button
              onClick={() => setSelectedTool('circle')}
              className={`p-2 rounded ${selectedTool === 'circle' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              title="Circle"
            >
              <Circle size={20} />
            </button>
            <button
              onClick={() => setSelectedTool('diamond')}
              className={`p-2 rounded ${selectedTool === 'diamond' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              title="Diamond"
            >
              <Diamond size={20} />
            </button>
            <button
              onClick={() => { setSelectedTool('arrow'); setConnectingFrom(null); }}
              className={`p-2 rounded ${selectedTool === 'arrow' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              title="Arrow"
            >
              <ArrowRight size={20} />
            </button>
            <div className="flex-1" />
            <button
              onClick={deleteShape}
              disabled={!selectedShape}
              className="p-2 rounded hover:bg-red-600 hover:text-white disabled:opacity-30"
              title="Delete"
            >
              <Trash2 size={20} />
            </button>
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-auto p-4">
            <svg
              ref={canvasRef}
              width="800"
              height="600"
              className={`border rounded ${darkMode ? 'border-gray-700 bg-[#2a2a2a]' : 'border-gray-300 bg-white'}`}
              onClick={handleCanvasClick}
              onMouseMove={handleShapeDrag}
              onMouseUp={handleShapeDragEnd}
              onMouseLeave={handleShapeDragEnd}
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="#6b7280" />
                </marker>
              </defs>

              {connectors.map(renderConnector)}
              {shapes.map(renderShape)}
            </svg>
          </div>

          {/* Properties Panel */}
          {selectedShape && (
            <div className={`w-64 border-l p-4 ${darkMode ? 'border-gray-700' : 'border-gray-200'} ${toolBg}`}>
              <h3 className="font-bold mb-4">{t(uiLanguage, 'properties')}</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs opacity-60 block mb-1">{t(uiLanguage, 'text')}</label>
                  <input
                    type="text"
                    value={shapes.find(s => s.id === selectedShape)?.text || ''}
                    onChange={(e) => updateShapeText(selectedShape, e.target.value)}
                    className={`w-full px-2 py-1 text-sm rounded border ${darkMode ? 'bg-[#1e1e1e] border-gray-600' : 'bg-white border-gray-300'}`}
                    placeholder="Enter text..."
                  />
                </div>
                <div>
                  <label className="text-xs opacity-60 block mb-1">{t(uiLanguage, 'color')}</label>
                  <input
                    type="color"
                    value={shapes.find(s => s.id === selectedShape)?.color || '#3b82f6'}
                    onChange={(e) => setShapes(shapes.map(s => s.id === selectedShape ? { ...s, color: e.target.value } : s))}
                    className="w-full h-8 rounded border"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-3 border-t flex justify-between items-center ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="text-xs opacity-60">
            {shapes.length} {t(uiLanguage, 'shapes')}, {connectors.length} {t(uiLanguage, 'connectors')}
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportToSVG}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
            >
              <Download size={14} /> SVG
            </button>
            <button
              onClick={exportToPNG}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
            >
              <Download size={14} /> PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
