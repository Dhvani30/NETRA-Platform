import { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Building } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';

const NODE_COLORS = {
  Platform: '#3b82f6',
  Post: '#64748b',
  Narrative: '#ec4899',
  Organization: '#a855f7',
  Location: '#eab308'
};

const NODE_SIZES = {
  Platform: 10,
  Post: 5,
  Narrative: 12,
  Organization: 11,
  Location: 9
};

export default function NetworkGraph({ graphData, searchQuery = null, highlightQuery = null }) {
  const fgRef = useRef();
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({ width: window.innerWidth - 100, height: 500 });
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleNodeClick = (node) => {
    setSelectedNode(node);
    if (fgRef.current) {
      const distance = 40;
      const distRatio = 1 + distance / Math.hypot(node.x, node.y);
      fgRef.current.zoom({ x: node.x, y: node.y, k: distRatio * 2 }, 1000);
    }
  };

  const handleZoomIn = () => {
    if (fgRef.current) {
      const z = zoom * 1.3;
      fgRef.current.zoom(z, 500);
      setZoom(z);
    }
  };

  const handleZoomOut = () => {
    if (fgRef.current) {
      const z = zoom / 1.3;
      fgRef.current.zoom(z, 500);
      setZoom(z);
    }
  };

  const handleResetZoom = () => {
    if (fgRef.current) {
      fgRef.current.zoom(1, 500);
      setZoom(1);
    }
  };

  const getNodeColor = (node) => {
    if (highlightQuery) {
      const q = highlightQuery.toLowerCase();
      if ((node.label || '').toLowerCase().includes(q)) return '#00f0ff';
    }
    return NODE_COLORS[node.group] || '#888888';
  };

  const getNodeSize = (node) => {
    if (highlightQuery) {
      const q = highlightQuery.toLowerCase();
      if ((node.label || '').toLowerCase().includes(q)) return (NODE_SIZES[node.group] || 5) * 2.5;
    }
    return NODE_SIZES[node.group] || 5;
  };

  const shouldShowLabel = (node, globalScale) => {
    if (highlightQuery) {
      const q = highlightQuery.toLowerCase();
      return (node.label || '').toLowerCase().includes(q);
    }
    // Show label if zoomed in more than 1.5x OR if hovered
    return globalScale > 1.5 || node.id === hoveredNode?.id;
  };

  return (
    <div className="p-6 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: '#00f0ff' }}>
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          ENTITY RELATIONSHIP NETWORK ({graphData?.nodes?.length || 0} nodes)
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={handleZoomIn} className="p-2 rounded bg-gray-700 hover:bg-gray-600 transition-colors" title="Zoom In">
            <ZoomIn className="w-4 h-4 text-white" />
          </button>
          <button onClick={handleZoomOut} className="p-2 rounded bg-gray-700 hover:bg-gray-600 transition-colors" title="Zoom Out">
            <ZoomOut className="w-4 h-4 text-white" />
          </button>
          <button onClick={handleResetZoom} className="p-2 rounded bg-gray-700 hover:bg-gray-600 transition-colors" title="Reset View">
            <RotateCcw className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      <div className="flex gap-4 text-xs text-gray-400 mb-4 pb-3 border-b border-gray-800">
        {highlightQuery && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{backgroundColor: '#00f0ff'}}></span> Search Match</span>}
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{backgroundColor: '#a855f7'}}></span> Organization</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{backgroundColor: '#ec4899'}}></span> Narrative</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{backgroundColor: '#3b82f6'}}></span> Platform</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{backgroundColor: '#eab308'}}></span> Location</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{backgroundColor: '#64748b'}}></span> Post</span>
      </div>

      {/* Graph Container */}
      <div className="rounded-lg overflow-hidden border border-gray-800 relative" style={{ height: '500px', backgroundColor: '#0a0a0f' }}>
        {!graphData || graphData.nodes?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Building className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">No graph data available.</p>
            <p className="text-xs mt-1">Run graph_builder.py to populate Neo4j.</p>
          </div>
        ) : (
          <>
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData}
              width={dimensions.width}
              height={dimensions.height}
              nodeLabel={node => node.label}
              nodeColor={getNodeColor}
              nodeRelSize={getNodeSize}
              linkColor={() => '#334155'}
              linkWidth={1.5}
              backgroundColor="#0a0a0f"
              cooldownTicks={200}
              linkDistance={80}
              chargeStrength={-400}
              d3VelocityDecay={0.3}
              onNodeClick={handleNodeClick}
              onNodeHover={(node) => {
                setHoveredNode(node);
                document.body.style.cursor = node ? 'pointer' : 'default';
              }}
              nodeCanvasObject={(node, ctx, globalScale) => {
                const label = node.label || '';
                const size = getNodeSize(node);
                const isHovered = hoveredNode?.id === node.id;
                const isMatch = highlightQuery && label.toLowerCase().includes(highlightQuery.toLowerCase());
                const showLabel = shouldShowLabel(node, globalScale);

                // Draw node circle
                ctx.beginPath();
                ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
                ctx.fillStyle = getNodeColor(node);
                ctx.fill();

                // Draw glow ring for hovered or matched nodes
                if (isHovered || isMatch) {
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI);
                  ctx.strokeStyle = '#00f0ff';
                  ctx.lineWidth = 2;
                  ctx.stroke();
                }

                // Draw label in canvas (small, subtle)
                if (showLabel && label && !isHovered) {
                  const fontSize = Math.max(10, 11 / globalScale);
                  ctx.font = `${fontSize}px Sans-Serif`;
                  ctx.fillStyle = '#ffffff';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(label, node.x, node.y + size + fontSize);
                }
              }}
            />
            
            {/* 🌟 FLOATING HOVER LABEL - Pops above everything */}
            {hoveredNode && (
              <div
                className="absolute pointer-events-none px-3 py-1.5 rounded-md bg-black/90 border border-cyan-400 text-cyan-400 font-bold text-sm whitespace-nowrap shadow-lg z-50"
                style={{
                  left: `${hoveredNode.x}px`,
                  top: `${hoveredNode.y - 15}px`,
                  transform: 'translate(-50%, -100%)'
                }}
              >
                {hoveredNode.label}
                <span className="ml-2 text-xs text-gray-400 font-normal">({hoveredNode.group})</span>
              </div>
            )}

            {/* Selected Node Info Panel */}
            {selectedNode && (
              <div className="absolute top-4 right-4 p-4 rounded-lg border border-gray-700" style={{ backgroundColor: '#13131f', maxWidth: '300px' }}>
                <h3 className="text-sm font-bold mb-2" style={{ color: '#00f0ff' }}>{selectedNode.label}</h3>
                <p className="text-xs text-gray-400 mb-2">Type: {selectedNode.group}</p>
                <p className="text-xs text-gray-500">Click another node to explore</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}