import { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Activity } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';
import { Button, GlassCard, FloatingStatCard } from './ui/primitives';
import './NetworkGraph.css';

const NODE_COLORS = {
  Platform: '#9a9ee8',
  User: '#b8bbee',
  Post: '#8e92b0',
  Topic: '#c09060',
  Hashtag: '#7090cc',
  Organization: '#70a888'
};

export default function NetworkGraph({ graphData, highlightQuery = null }) {
  const fgRef = useRef();
  const containerRef = useRef();
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 550 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 900,
          height: 550
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleNodeClick = (node) => {
    setSelectedNode(node);
    if (fgRef.current) {
      fgRef.current.zoom({ x: node.x, y: node.y, k: 2.5 }, 800);
    }
  };

  const handleZoomIn = () => {
    if (fgRef.current) {
      const z = zoom * 1.3;
      fgRef.current.zoom(z, 400);
      setZoom(z);
    }
  };

  const handleZoomOut = () => {
    if (fgRef.current) {
      const z = zoom / 1.3;
      fgRef.current.zoom(z, 400);
      setZoom(z);
    }
  };

  const handleResetZoom = () => {
    if (fgRef.current) {
      fgRef.current.zoom(1, 400);
      setZoom(1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="netra-page-header mb-0">
          <span className="netra-page-eyebrow">Topology & Entity Links</span>
          <h1 className="netra-page-title">Network <span>Graph</span></h1>
          <p className="netra-page-subtitle">Interactive 2D force-directed relationship model.</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleZoomIn} aria-label="Zoom In">
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="secondary" onClick={handleZoomOut} aria-label="Zoom Out">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="secondary" onClick={handleResetZoom} aria-label="Reset View">
            <RotateCcw className="w-4 h-4" /> Reset
          </Button>
        </div>
      </div>

      {/* Main Focal Graph Container */}
      <GlassCard className="p-0 relative overflow-hidden h-[580px]" ref={containerRef}>
        {/* Floating Stat Card Overlay #1 (Max 2 per screen, in empty corner) */}
        <FloatingStatCard
          badge="Live Graph Stats"
          title="Total Nodes"
          value={`${graphData?.nodes?.length || 0} Entities`}
          style={{ top: '16px', left: '16px' }}
        />

        {/* Floating Stat Card Overlay #2 (Selected Node Detail in top-right empty corner) */}
        {selectedNode && (
          <FloatingStatCard
            badge={selectedNode.group || "Entity Detail"}
            title="Selected Node"
            value={selectedNode.label || selectedNode.id}
            style={{ top: '16px', right: '16px' }}
          >
            <div className="mt-2 text-xs text-gray-400">
              ID: <span className="font-mono text-gray-200">{selectedNode.id}</span>
            </div>
          </FloatingStatCard>
        )}

        {/* Graph Canvas */}
        <div className="w-full h-full flex items-center justify-center">
          {(!graphData || !graphData.nodes || graphData.nodes.length === 0) ? (
            <div className="text-center p-12 text-gray-400">
              <Activity className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
              <p>Loading network topology graph…</p>
            </div>
          ) : (
            <ForceGraph2D
              ref={fgRef}
              width={dimensions.width}
              height={dimensions.height}
              graphData={graphData}
              nodeLabel="label"
              nodeColor={(node) => NODE_COLORS[node.group] || '#8e92b0'}
              nodeRelSize={6}
              linkColor={() => 'rgba(255, 255, 255, 0.12)'}
              linkWidth={1.5}
              linkDirectionalParticles={1}
              linkDirectionalParticleSpeed={0.005}
              linkDirectionalParticleWidth={2}
              onNodeClick={handleNodeClick}
              onNodeHover={(node) => setHoveredNode(node)}
              backgroundColor="transparent"
            />
          )}
        </div>
      </GlassCard>
    </div>
  );
}
