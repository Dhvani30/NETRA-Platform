import { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Share2, Layers, Info, X } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';

// Restrained Editorial Color Mapping
const NODE_COLORS = {
  Organization: '#B6A98A', // Warm muted highlight
  Narrative: '#91A891',    // Muted sage accent
  Platform: '#747D74',     // Subdued slate grey
  Location: '#A89874',     // Muted ochre
  Post: '#4A504A'          // Graphite dark grey
};

const NODE_SIZES = {
  Platform: 8,
  Post: 4,
  Narrative: 9,
  Organization: 8,
  Location: 7
};

export default function NetworkGraph({ graphData, searchQuery = null, highlightQuery = null }) {
  const fgRef = useRef();
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 560 });

  useEffect(() => {
    const updateDimensions = () => {
      const parentWidth = window.innerWidth > 1600 ? 1520 : window.innerWidth - 80;
      setDimensions({
        width: Math.max(320, parentWidth),
        height: 560
      });
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
      fgRef.current.zoom({ x: node.x, y: node.y, k: distRatio * 1.5 }, 800);
    }
  };

  const handleZoomIn = () => {
    if (fgRef.current) {
      const z = zoom * 1.25;
      fgRef.current.zoom(z, 400);
      setZoom(z);
    }
  };

  const handleZoomOut = () => {
    if (fgRef.current) {
      const z = zoom / 1.25;
      fgRef.current.zoom(z, 400);
      setZoom(z);
    }
  };

  const handleResetZoom = () => {
    if (fgRef.current) {
      fgRef.current.zoom(1, 400);
      setZoom(1);
      setSelectedNode(null);
    }
  };

  const getNodeColor = (node) => {
    if (highlightQuery) {
      const q = highlightQuery.toLowerCase();
      if ((node.label || '').toLowerCase().includes(q)) return '#91A891';
    }
    return NODE_COLORS[node.group] || '#5A605A';
  };

  const getNodeSize = (node) => {
    if (highlightQuery) {
      const q = highlightQuery.toLowerCase();
      if ((node.label || '').toLowerCase().includes(q)) return (NODE_SIZES[node.group] || 5) * 1.8;
    }
    return NODE_SIZES[node.group] || 5;
  };

  const shouldShowLabel = (node, globalScale) => {
    if (highlightQuery) {
      const q = highlightQuery.toLowerCase();
      return (node.label || '').toLowerCase().includes(q);
    }
    return globalScale > 1.8 || node.id === hoveredNode?.id;
  };

  return (
    <div className="bg-[#1E211F] border border-[#343934] rounded p-5">
      {/* Graph Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#343934]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#91A891]" />
            <h2 className="text-sm font-semibold tracking-tight text-[#E5E6DF]">
              Entity Relationship Topology
            </h2>
            <span className="text-[11px] font-mono text-[#9B9F96]">
              ({graphData?.nodes?.length || 0} entities, {graphData?.links?.length || 0} edges)
            </span>
          </div>
          <p className="text-xs text-[#9B9F96] mt-0.5">
            Cross-platform relational graph synthesized from ingested intelligence
          </p>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded bg-[#252925] hover:bg-[#343934] border border-[#343934] text-[#9B9F96] hover:text-[#E5E6DF] transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded bg-[#252925] hover:bg-[#343934] border border-[#343934] text-[#9B9F96] hover:text-[#E5E6DF] transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetZoom}
            className="px-2 py-1 rounded bg-[#252925] hover:bg-[#343934] border border-[#343934] text-[#9B9F96] hover:text-[#E5E6DF] transition-colors text-xs flex items-center gap-1"
            title="Reset View"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="text-[11px]">Reset</span>
          </button>
        </div>
      </div>

      {/* Editorial Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#9B9F96] font-mono mb-4 pb-3 border-b border-[#343934]/60">
        <span className="text-[#686D65] uppercase tracking-wider text-[10px]">LEGEND:</span>
        {highlightQuery && (
          <span className="flex items-center gap-1.5 text-[#E5E6DF]">
            <span className="w-2 h-2 rounded-full border border-[#91A891] bg-[#91A891]" />
            Search Focus
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: NODE_COLORS.Organization }} />
          Organization
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: NODE_COLORS.Narrative }} />
          Narrative
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: NODE_COLORS.Location }} />
          Location
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: NODE_COLORS.Platform }} />
          Platform
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: NODE_COLORS.Post }} />
          Post Signal
        </span>
      </div>

      {/* Graph Canvas Container */}
      <div className="rounded overflow-hidden border border-[#343934] relative bg-[#171918]" style={{ height: '560px' }}>
        {!graphData || graphData.nodes?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#9B9F96]">
            <Layers className="w-8 h-8 mb-2 text-[#686D65]" />
            <p className="text-xs font-medium text-[#E5E6DF]">Graph Topology Offline</p>
            <p className="text-[11px] text-[#686D65] mt-1">
              Start Docker Neo4j and execute graph_builder.py to compile relational nodes.
            </p>
          </div>
        ) : (
          <>
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData}
              width={dimensions.width}
              height={dimensions.height}
              nodeLabel={null}
              nodeColor={getNodeColor}
              nodeRelSize={getNodeSize}
              linkColor={() => '#282C28'}
              linkWidth={1}
              backgroundColor="#171918"
              cooldownTicks={180}
              linkDistance={70}
              chargeStrength={-300}
              d3VelocityDecay={0.35}
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
                const isSelected = selectedNode?.id === node.id;
                const showLabel = shouldShowLabel(node, globalScale);

                // Node Base
                ctx.beginPath();
                ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
                ctx.fillStyle = getNodeColor(node);
                ctx.fill();

                // Subtle outline ring for selected or hovered
                if (isHovered || isMatch || isSelected) {
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, size + 3, 0, 2 * Math.PI);
                  ctx.strokeStyle = isMatch ? '#91A891' : '#B6A98A';
                  ctx.lineWidth = 1.5;
                  ctx.stroke();
                }

                // In-canvas Label
                if (showLabel && label && !isHovered) {
                  const fontSize = Math.max(9, Math.min(12, 11 / globalScale));
                  ctx.font = `${fontSize}px Geist, Inter, sans-serif`;
                  ctx.fillStyle = '#E5E6DF';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(label, node.x, node.y + size + fontSize);
                }
              }}
            />

            {/* Hover Tooltip (Editorial Minimalist) */}
            {hoveredNode && (
              <div
                className="absolute pointer-events-none px-2.5 py-1.5 rounded bg-[#1E211F] border border-[#343934] text-xs shadow-2xl z-30 font-sans"
                style={{
                  left: `${hoveredNode.x}px`,
                  top: `${hoveredNode.y - 12}px`,
                  transform: 'translate(-50%, -100%)'
                }}
              >
                <div className="font-medium text-[#E5E6DF]">{hoveredNode.label}</div>
                <div className="text-[10px] font-mono text-[#9B9F96]">{hoveredNode.group}</div>
              </div>
            )}

            {/* Selected Node Inspector Panel */}
            {selectedNode && (
              <div className="absolute top-4 right-4 p-4 rounded bg-[#1E211F]/95 backdrop-blur-sm border border-[#343934] shadow-2xl max-w-[280px] z-30 text-xs font-sans">
                <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-[#343934]">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#9B9F96]">
                      {selectedNode.group}
                    </span>
                    <h3 className="font-semibold text-sm text-[#E5E6DF] mt-0.5">
                      {selectedNode.label}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="text-[#9B9F96] hover:text-[#E5E6DF] p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 text-[11px] text-[#9B9F96] font-mono">
                  <div className="flex justify-between">
                    <span>Node ID:</span>
                    <span className="text-[#E5E6DF] truncate max-w-[140px]">{selectedNode.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Classification:</span>
                    <span className="text-[#B6A98A]">{selectedNode.group}</span>
                  </div>
                </div>

                <p className="text-[11px] text-[#686D65] mt-3 pt-2 border-t border-[#343934]">
                  Click on canvas or other nodes to re-target inspection.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}