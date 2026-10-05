<<<<<<< HEAD
import { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Activity } from 'lucide-react';
=======
import { useMemo, useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Building, Search, X, Network } from 'lucide-react';
>>>>>>> a8ead338865215b43923c72005cc9123ace1e9bd
import ForceGraph2D from 'react-force-graph-2d';
import { Button, GlassCard, FloatingStatCard } from './ui/primitives';
import './NetworkGraph.css';

const NODE_COLORS = {
<<<<<<< HEAD
  Platform: '#9a9ee8',
  User: '#b8bbee',
  Post: '#8e92b0',
  Topic: '#c09060',
  Hashtag: '#7090cc',
  Organization: '#70a888'
=======
  Platform: '--ds-color-accent',
  Post: '--ds-color-text-3',
  Narrative: '--ds-color-accent-dim',
  Organization: '--ds-color-blue-muted',
  Location: '--ds-color-amber-muted',
  Author: '--ds-color-red-muted'
>>>>>>> a8ead338865215b43923c72005cc9123ace1e9bd
};
const NODE_BASE_SIZES = { Platform: 7, Post: 3, Narrative: 7, Organization: 6, Location: 5, Author: 5 };
const endpointId = (endpoint) => typeof endpoint === 'object' && endpoint !== null ? endpoint.id : endpoint;

<<<<<<< HEAD
export default function NetworkGraph({ graphData, highlightQuery = null }) {
=======
function createEntityMap(graphData) {
  const nodes = graphData?.nodes || [];
  const links = graphData?.links || [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const postEntities = new Map();

  for (const link of links) {
    const source = endpointId(link.source);
    const target = endpointId(link.target);
    const sourceNode = nodeById.get(source);
    const targetNode = nodeById.get(target);
    if (sourceNode?.group === 'Post' && targetNode && targetNode.group !== 'Post' && targetNode.group !== 'Author') {
      if (!postEntities.has(source)) postEntities.set(source, new Set());
      postEntities.get(source).add(target);
    } else if (targetNode?.group === 'Post' && sourceNode && sourceNode.group !== 'Post' && sourceNode.group !== 'Author') {
      if (!postEntities.has(target)) postEntities.set(target, new Set());
      postEntities.get(target).add(source);
    }
  }

  const sharedPosts = new Map();
  for (const [postId, entityIds] of postEntities) {
    const ids = [...entityIds];
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const [source, target] = [ids[i], ids[j]].sort();
        const key = `${source}\u0000${target}`;
        if (!sharedPosts.has(key)) sharedPosts.set(key, { source, target, weight: 0, postIds: [] });
        const edge = sharedPosts.get(key);
        edge.weight += 1;
        edge.postIds.push(postId);
      }
    }
  }

  const entityIds = new Set();
  for (const edge of sharedPosts.values()) {
    entityIds.add(edge.source);
    entityIds.add(edge.target);
  }
  return {
    nodes: [...entityIds].map((id) => ({ ...nodeById.get(id) })),
    links: [...sharedPosts.values()].map((edge) => ({ ...edge }))
  };
}

export default function NetworkGraph({ graphData, _searchQuery = null, highlightQuery = null }) {
>>>>>>> a8ead338865215b43923c72005cc9123ace1e9bd
  const fgRef = useRef();
  const containerRef = useRef();
  const [zoom, setZoom] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
<<<<<<< HEAD
  const [dimensions, setDimensions] = useState({ width: 900, height: 550 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 900,
          height: 550
        });
      }
=======
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [viewMode, setViewMode] = useState('entities');
  const [typeFilter, setTypeFilter] = useState('All types');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const updateDimensions = () => {
      const graph = document.querySelector('.network-graph__canvas');
      setDimensions({ width: graph?.clientWidth || Math.max(320, window.innerWidth - 290), height: graph?.clientHeight || 540 });
>>>>>>> a8ead338865215b43923c72005cc9123ace1e9bd
    };
    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    const graph = document.querySelector('.network-graph__canvas');
    if (graph) observer.observe(graph);
    window.addEventListener('resize', updateDimensions);
    return () => { observer.disconnect(); window.removeEventListener('resize', updateDimensions); };
  }, []);

<<<<<<< HEAD
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
=======
  const entityMap = useMemo(() => createEntityMap(graphData), [graphData]);
  const sourceGraph = viewMode === 'entities' ? entityMap : graphData;
  const visibleGraph = useMemo(() => {
    const sourceNodes = sourceGraph?.nodes || [];
    const sourceLinks = sourceGraph?.links || [];
    const query = search.trim().toLowerCase();
    const matches = new Set(sourceNodes.filter((node) =>
      (typeFilter === 'All types' || node.group === typeFilter) &&
      (!query || `${node.label} ${node.group}`.toLowerCase().includes(query))
    ).map((node) => node.id));
    const ids = new Set(matches);
    if (query || typeFilter !== 'All types') {
      for (const link of sourceLinks) {
        const source = endpointId(link.source);
        const target = endpointId(link.target);
        if (matches.has(source)) ids.add(target);
        if (matches.has(target)) ids.add(source);
      }
    }
    const filteredNodes = sourceNodes.filter((node) => ids.has(node.id)).map((node) => ({ ...node }));
    const filteredIds = new Set(filteredNodes.map((node) => node.id));
    const filteredLinks = sourceLinks
      .filter((link) => filteredIds.has(endpointId(link.source)) && filteredIds.has(endpointId(link.target)))
      .map((link) => ({ ...link, source: endpointId(link.source), target: endpointId(link.target) }));
    return { nodes: filteredNodes, links: filteredLinks };
  }, [sourceGraph, search, typeFilter]);

  const degreeById = useMemo(() => {
    const degrees = new Map();
    for (const link of visibleGraph.links) {
      degrees.set(link.source, (degrees.get(link.source) || 0) + (link.weight || 1));
      degrees.set(link.target, (degrees.get(link.target) || 0) + (link.weight || 1));
    }
    return degrees;
  }, [visibleGraph]);
  const selectedNode = visibleGraph.nodes.find((node) => node.id === selectedNodeId);
  const typeOptions = useMemo(() => ['All types', ...new Set((sourceGraph?.nodes || []).map((node) => node.group).sort())], [sourceGraph]);
  const connectedNodes = selectedNode ? visibleGraph.links
    .filter((link) => endpointId(link.source) === selectedNode.id || endpointId(link.target) === selectedNode.id)
    .map((link) => {
      const id = endpointId(link.source) === selectedNode.id ? endpointId(link.target) : endpointId(link.source);
      return { node: visibleGraph.nodes.find((node) => node.id === id), weight: link.weight || 1 };
    }).filter((item) => item.node).sort((a, b) => b.weight - a.weight).slice(0, 6) : [];

  const focusNode = (node) => {
    setSelectedNodeId(node.id);
    if (fgRef.current && Number.isFinite(node.x) && Number.isFinite(node.y)) {
      fgRef.current.centerAt(node.x, node.y, 500);
      fgRef.current.zoom(Math.max(1.7, zoom), 500);
    }
  };
  const handleZoomIn = () => { const next = zoom * 1.3; fgRef.current?.zoom(next, 300); setZoom(next); };
  const handleZoomOut = () => { const next = zoom / 1.3; fgRef.current?.zoom(next, 300); setZoom(next); };
  const handleResetZoom = () => { fgRef.current?.zoomToFit(500, 70); setZoom(1); setSelectedNodeId(null); };
  const getNodeColor = (node) => getComputedStyle(document.documentElement).getPropertyValue(NODE_COLORS[node.group] || '--ds-color-text-3').trim();
  const getNodeSize = (node) => {
    const degree = degreeById.get(node.id) || 1;
    return (NODE_BASE_SIZES[node.group] || 5) + Math.min(7, Math.sqrt(degree) * 1.2);
  };

  return (
    <section className="network-graph" aria-label="Network graph">
      <header className="network-graph__header">
        <div className="network-graph__title-wrap"><span className="network-graph__status-dot" aria-hidden="true" /><div><p className="network-graph__eyebrow">Entity relationships</p><h2>Network <span>Graph</span></h2><p className="network-graph__count">{visibleGraph.nodes.length} visible nodes · {visibleGraph.links.length} connections · {graphData?.nodes?.length || 0} total entities</p></div></div>
        <div className="network-graph__controls" aria-label="Graph controls"><button type="button" onClick={handleZoomIn} title="Zoom in" aria-label="Zoom in"><ZoomIn /></button><button type="button" onClick={handleZoomOut} title="Zoom out" aria-label="Zoom out"><ZoomOut /></button><button type="button" onClick={handleResetZoom} title="Fit graph and clear selection" aria-label="Fit graph and clear selection"><RotateCcw /></button></div>
      </header>

      <div className="network-graph__toolbar">
        <div className="network-graph__modes" role="group" aria-label="Graph view mode">
          <button className={viewMode === 'entities' ? 'is-active' : ''} type="button" onClick={() => { setViewMode('entities'); setSelectedNodeId(null); }}><Network size={15} /> Entity map</button>
          <button className={viewMode === 'posts' ? 'is-active' : ''} type="button" onClick={() => { setViewMode('posts'); setSelectedNodeId(null); }}>Post network</button>
        </div>
        <label className="network-graph__search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find an entity, platform, or topic" aria-label="Search graph" />{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={15} /></button>}</label>
        <label className="network-graph__filter"><span>Type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter by node type">{typeOptions.map((type) => <option key={type}>{type}</option>)}</select></label>
      </div>
      <p className="network-graph__hint">{viewMode === 'entities' ? 'Entity map focuses on recurring topics and entities shared across posts. Open Post network to inspect author nodes. Larger nodes have more connections.' : 'Post network shows every post and its direct relationships.'} Search to focus a node and its immediate connections; click any node for details.</p>

      <div className="network-graph__legend" aria-label="Visible node types">{typeOptions.slice(1).filter((type) => typeFilter === 'All types' || type === typeFilter).map((type) => <span key={type}><i style={{ backgroundColor: `var(${NODE_COLORS[type] || '--ds-color-text-3'})` }} />{type}</span>)}</div>
      <div className="network-graph__canvas">
        {visibleGraph.nodes.length === 0 ? <div className="network-graph__empty" role="status"><Building aria-hidden="true" /><h3>{graphData?.nodes?.length ? 'No matching graph nodes' : 'No graph data available'}</h3><p>{graphData?.nodes?.length ? 'Try another search or node type.' : 'Run the graph builder to sync MongoDB posts into PostgreSQL.'}</p></div> : <>
          <ForceGraph2D
            ref={fgRef} graphData={visibleGraph} width={dimensions.width} height={dimensions.height}
            nodeLabel={(node) => `${node.label} · ${node.group} · ${degreeById.get(node.id) || 0} connections`}
            nodeColor={getNodeColor} nodeRelSize={getNodeSize}
            linkColor={(link) => link.weight > 1 ? 'rgba(135, 150, 210, 0.34)' : 'rgba(135, 150, 210, 0.15)'}
            linkWidth={(link) => Math.min(3.5, 0.7 + Math.log2(link.weight || 1) * 0.55)}
            linkDirectionalParticles={(link) => viewMode === 'entities' && link.weight > 2 ? 1 : 0}
            linkDirectionalParticleWidth={1.2} linkDirectionalParticleColor={() => 'rgba(164, 177, 255, 0.6)'}
            backgroundColor={getComputedStyle(document.documentElement).getPropertyValue('--ds-color-bg').trim()}
            cooldownTicks={220} linkDistance={(link) => viewMode === 'entities' ? Math.max(58, 112 - Math.log2(link.weight || 1) * 10) : 88}
            chargeStrength={viewMode === 'entities' ? -390 : -520} d3VelocityDecay={0.34}
            onNodeClick={focusNode} onNodeHover={(node) => { setHoveredNode(node); document.body.style.cursor = node ? 'pointer' : 'default'; }}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const label = node.label || '';
              const size = getNodeSize(node);
              const hovered = hoveredNode?.id === node.id;
              const selected = selectedNodeId === node.id;
              const queryMatch = search && label.toLowerCase().includes(search.trim().toLowerCase());
              ctx.beginPath(); ctx.arc(node.x, node.y, size + (selected || hovered ? 2 : 0), 0, 2 * Math.PI);
              ctx.fillStyle = getNodeColor(node); ctx.fill();
              if (selected || hovered || queryMatch) { ctx.beginPath(); ctx.arc(node.x, node.y, size + 5, 0, 2 * Math.PI); ctx.strokeStyle = 'rgba(186, 195, 255, 0.9)'; ctx.lineWidth = 1.5 / globalScale; ctx.stroke(); }
              if (globalScale > 1.35 || selected || hovered || queryMatch) {
                const fontSize = Math.max(9, Math.min(14, 11 / globalScale));
                ctx.font = `${selected || hovered ? 600 : 400} ${fontSize}px Space Grotesk, sans-serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'top';
                ctx.fillStyle = 'rgba(238, 240, 255, 0.94)';
                ctx.fillText(label.length > 26 ? `${label.slice(0, 23)}…` : label, node.x, node.y + size + 4);
              }
            }}
          />
          {hoveredNode && <div className="network-graph__hover"><strong>{hoveredNode.label}</strong><span>{hoveredNode.group} · {degreeById.get(hoveredNode.id) || 0} links</span></div>}
          {selectedNode && <aside className="network-graph__selection" aria-live="polite"><button type="button" className="network-graph__selection-close" onClick={() => setSelectedNodeId(null)} aria-label="Close node details"><X size={15} /></button><span className="network-graph__selection-type">{selectedNode.group}</span><h3>{selectedNode.label}</h3><p>{degreeById.get(selectedNode.id) || 0} connection{degreeById.get(selectedNode.id) === 1 ? '' : 's'}{viewMode === 'entities' ? ' · shared-post relationships' : ''}</p>{connectedNodes.length > 0 && <><span className="network-graph__related-heading">Connected to</span><ul>{connectedNodes.map(({ node, weight }) => <li key={node.id}><span><i style={{ backgroundColor: `var(${NODE_COLORS[node.group] || '--ds-color-text-3'})` }} />{node.label}</span>{viewMode === 'entities' && weight > 1 && <small>{weight} posts</small>}</li>)}</ul></>}</aside>}
        </>}
      </div>
    </section>
>>>>>>> a8ead338865215b43923c72005cc9123ace1e9bd
  );
}
