import { useState, useEffect } from 'react';
import { ArrowLeft, Globe, MessageSquare, Share2, Activity, Video } from 'lucide-react';
import NetworkGraph from './NetworkGraph';
import { Badge, Button, GlassCard, KpiCard, DataTable } from './ui/primitives';

export default function InvestigationView({ investigationData, graphData, onBack, searchQuery, onSelectPost }) {
  const [filteredGraph, setFilteredGraph] = useState({ nodes: [], links: [] });

  useEffect(() => {
    if (!graphData || !graphData.nodes || !searchQuery) {
      setFilteredGraph({ nodes: [], links: [] });
      return;
    }

    const q = searchQuery.toLowerCase();

    const matchedNodes = graphData.nodes.filter(n =>
      (n.label || '').toLowerCase().includes(q) ||
      (n.id || '').toLowerCase().includes(q)
    );

    if (matchedNodes.length === 0) {
      setFilteredGraph({ nodes: [], links: [] });
      return;
    }

    const matchedIds = new Set(matchedNodes.map(n => n.id));

    const relevantLinks = (graphData.links || []).filter(l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      return matchedIds.has(sourceId) || matchedIds.has(targetId);
    });

    const connectedIds = new Set();
    relevantLinks.forEach(l => {
      connectedIds.add(typeof l.source === 'object' ? l.source.id : l.source);
      connectedIds.add(typeof l.target === 'object' ? l.target.id : l.target);
    });

    matchedNodes.forEach(n => connectedIds.add(n.id));
    const filteredNodes = graphData.nodes.filter(n => connectedIds.has(n.id));

    setFilteredGraph({ nodes: filteredNodes, links: relevantLinks });
  }, [graphData, searchQuery]);

  const getPlatformIcon = (platform) => {
    const platformLower = platform?.toLowerCase() || '';
    if (platformLower.includes('twitter') || platformLower.includes('x')) return <Share2 className="w-4 h-4 text-blue-400" />;
    if (platformLower.includes('reddit')) return <MessageSquare className="w-4 h-4 text-orange-400" />;
    if (platformLower.includes('youtube')) return <Video className="w-4 h-4 text-red-400" />;
    return <Globe className="w-4 h-4 text-emerald-400" />;
  };

  const docs = investigationData?.documents || [];

  const columns = [
    {
      header: 'Platform',
      accessorKey: 'platform',
      cell: (row) => (
        <div className="flex items-center gap-2">
          {getPlatformIcon(row.platform)}
          <span className="font-semibold text-xs uppercase">{row.platform || 'WEB'}</span>
        </div>
      )
    },
    {
      header: 'Mode',
      accessorKey: 'source_mode',
      cell: (row) => {
        const mode = row.source_mode || (row.metadata?.source_mode) || 'SYNTH';
        const modeClass = mode === 'LIVE_THIRD_PARTY' ? 'pill--live-third-party' : mode === 'LIVE' ? 'pill--live' : mode === 'IMPORT' ? 'pill--import' : 'pill--synth';
        return <span className={`pill text-[9px] ${modeClass}`}>{mode}</span>;
      }
    },
    {
      header: 'Author (Hashed)',
      accessorKey: 'author_id',
      cell: (row) => (
        <span className="font-mono text-xs text-indigo-300">
          @{String(row.author_short_id || row.author_id || 'masked').slice(0, 12)}
        </span>
      )
    },
    {
      header: 'Content Snippet',
      accessorKey: 'text_content',
      cell: (row) => <span className="text-gray-200 line-clamp-1 max-w-xl">{row.text_content || row.content || row.text}</span>
    },
    {
      header: 'Date',
      accessorKey: 'published_at',
      cell: (row) => <span className="text-gray-400 text-xs">{row.published_at || row.created_at ? new Date(row.published_at || row.created_at).toLocaleDateString() : 'Recent'}</span>
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Button>
          <div>
            <span className="netra-page-eyebrow">Deep Investigation Mode</span>
            <h1 className="netra-page-title">Entity: <span>{searchQuery.toUpperCase()}</span></h1>
          </div>
        </div>
        <Badge variant="accent">{docs.length} matching observations</Badge>
      </div>

      {/* Row of Max 4 KPI Cards */}
      <div className="netra-grid-12">
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <KpiCard
            label="Matched Posts"
            value={docs.length}
            delta="Targeted"
            deltaType="positive"
            subtext="QueryResult count"
          />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <KpiCard
            label="Connected Subgraph"
            value={filteredGraph.nodes.length}
            delta="Sub-network"
            deltaType="neutral"
            subtext="Associated nodes"
          />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <KpiCard
            label="Platforms Covered"
            value={investigationData?.platforms?.length || 1}
            delta="Multi-channel"
            deltaType="positive"
            subtext="Vector coverage"
          />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <KpiCard
            label="Threat Level"
            value="Moderate"
            delta="Monitored"
            deltaType="warning"
            subtext="Assessment index"
          />
        </div>
      </div>

      {/* Focal Network Graph Subgraph */}
      <GlassCard className="p-6">
        <h2 className="text-base font-semibold text-gray-100 mb-4">Investigated Subgraph Connections</h2>
        <NetworkGraph graphData={filteredGraph} highlightQuery={searchQuery} />
      </GlassCard>

      {/* Secondary Table of Matched Messages */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100">Investigated Messages Stream</h2>
          {docs.some(d => ['x', 'twitter'].includes((d.platform || '').toLowerCase())) && (
            <span className="text-[11px] text-amber-200/90 italic">
              X data: public datasets plus a capped third-party sample; not the official X API.
            </span>
          )}
        </div>
        <DataTable columns={columns} data={docs} maxRows={8} onRowClick={onSelectPost} />
      </div>
    </div>
  );
}