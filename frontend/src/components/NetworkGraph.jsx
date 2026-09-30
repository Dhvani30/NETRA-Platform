import { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Building } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';
import './NetworkGraph.css';

const NODE_COLORS = {
  Platform: 'var(--ds-color-accent)',
  Post: 'var(--ds-color-text-3)',
  Narrative: 'var(--ds-color-accent-dim)',
  Organization: 'var(--ds-color-blue-muted)',
  Location: 'var(--ds-color-amber-muted)'
};

const getDesignColor = (token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim();

const NODE_SIZES = {
  Platform: 10,
  Post: 5,
  Narrative: 12,
  Organization: 11,
  Location: 9
};

export default function NetworkGraph({ graphData, _searchQuery = null, highlightQuery = null }) {
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
      if ((node.label || '').toLowerCase().includes(q)) return getDesignColor('--ds-color-accent-bright');
    }
    // 🎨 SPECIAL CASE: Make YouTube nodes red to match the app's branding
    if (node.group === 'Platform' && (node.label || '').toUpperCase() === 'YOUTUBE') {
      return getDesignColor('--ds-color-red-muted');
    }
    const colorToken = NODE_COLORS[node.group] ? NODE_COLORS[node.group].match(/var\(([^)]+)\)/)?.[1] : '--ds-color-text-3';
    return getDesignColor(colorToken);
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
    <section className="network-graph" aria-label="Network graph">
      <header className="network-graph__header"><div className="network-graph__title-wrap"><span className="network-graph__status-dot" aria-hidden="true" /><div><p className="network-graph__eyebrow">Entity relationships</p><h2>Network <span>Graph</span></h2><p className="network-graph__count">{graphData?.nodes?.length || 0} nodes · {graphData?.links?.length || 0} connections</p></div></div><div className="network-graph__controls" aria-label="Graph controls"><button type="button" onClick={handleZoomIn} title="Zoom In" aria-label="Zoom in"><ZoomIn /></button><button type="button" onClick={handleZoomOut} title="Zoom Out" aria-label="Zoom out"><ZoomOut /></button><button type="button" onClick={handleResetZoom} title="Reset View" aria-label="Reset graph view"><RotateCcw /></button></div></header>
      <div className="network-graph__legend" aria-label="Node types">{highlightQuery && <span><i style={{ backgroundColor: 'var(--ds-color-accent-bright)' }} />Search match</span>}<span><i style={{ backgroundColor: NODE_COLORS.Organization }} />Organization</span><span><i style={{ backgroundColor: NODE_COLORS.Narrative }} />Narrative</span><span><i style={{ backgroundColor: NODE_COLORS.Platform }} />Platform</span><span><i style={{ backgroundColor: NODE_COLORS.Location }} />Location</span><span><i style={{ backgroundColor: NODE_COLORS.Post }} />Post</span></div>
      <div className="network-graph__canvas">{!graphData || graphData.nodes?.length === 0 ? <div className="network-graph__empty" role="status"><Building aria-hidden="true" /><h3>No graph data available</h3><p>Run graph_builder.py to populate Neo4j.</p></div> : <><ForceGraph2D ref={fgRef} graphData={graphData} width={dimensions.width} height={dimensions.height} nodeLabel={node => node.label} nodeColor={getNodeColor} nodeRelSize={getNodeSize} linkColor={() => getDesignColor('--ds-color-accent-faint')} linkWidth={1.5} backgroundColor={getDesignColor('--ds-color-bg')} cooldownTicks={200} linkDistance={80} chargeStrength={-400} d3VelocityDecay={0.3} onNodeClick={handleNodeClick} onNodeHover={(node) => { setHoveredNode(node); document.body.style.cursor = node ? 'pointer' : 'default'; }} nodeCanvasObject={(node, ctx, globalScale) => { const label = node.label || ''; const size = getNodeSize(node); const isHovered = hoveredNode?.id === node.id; const isMatch = highlightQuery && label.toLowerCase().includes(highlightQuery.toLowerCase()); const showLabel = shouldShowLabel(node, globalScale); ctx.beginPath(); ctx.arc(node.x, node.y, size, 0, 2 * Math.PI); ctx.fillStyle = getNodeColor(node); ctx.fill(); if (isHovered || isMatch) { ctx.beginPath(); ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI); ctx.strokeStyle = getDesignColor('--ds-color-accent-bright'); ctx.lineWidth = 2; ctx.stroke(); } if (showLabel && label && !isHovered) { const fontSize = Math.max(10, 11 / globalScale); ctx.font = `${fontSize}px Space Grotesk`; ctx.fillStyle = getDesignColor('--ds-color-text-1'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, node.x, node.y + size + fontSize); } }} />{hoveredNode && <div className="network-graph__hover" style={{ left: `${hoveredNode.x}px`, top: `${hoveredNode.y - 15}px` }}><strong>{hoveredNode.label}</strong><span>{hoveredNode.group}</span></div>}{selectedNode && <aside className="network-graph__selection" aria-live="polite"><h3>{selectedNode.label}</h3><p>Type: {selectedNode.group}</p><span>Click another node to explore</span></aside>}</>}</div>
    </section>
  );
}
