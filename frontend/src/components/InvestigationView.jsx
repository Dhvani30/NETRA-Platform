import { useState, useEffect } from 'react';
import { ArrowLeft, Globe, MessageSquare, Share2, Video } from 'lucide-react';
import NetworkGraph from './NetworkGraph';
import { Badge, Button, GlassCard, Input, KpiCard } from './ui/primitives';
import { EmptyState, ErrorState } from './ui/dataState';

export default function InvestigationView({ investigationData, graphData, graphError, onRetryGraph, onBack, onSearch, searchQuery = '', onSelectPost }) {
  const [draft, setDraft] = useState('');
  useEffect(() => { setDraft(searchQuery || ''); }, [searchQuery]);
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

  const query = String(searchQuery || '').trim();
  const docs = investigationData?.documents || investigationData?.posts || [];
  const platforms = investigationData?.platforms || investigationData?.summary?.platforms || [];

  if (!query) {
    return (
      <div className="space-y-6">
        <div>
          <span className="netra-page-eyebrow">Deep Investigation Mode</span>
          <h1 className="netra-page-title">Deep <span>Search</span></h1>
        </div>
        <form className="flex max-w-lg items-center gap-2" onSubmit={(event) => { event.preventDefault(); onSearch?.(draft); }}>
          <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Enter a query" aria-label="Investigation query" />
          <Button type="submit" variant="primary">Search</Button>
        </form>
        <p className="text-sm text-slate-400">Enter a query and press Search. Nothing is fetched until you submit.</p>
      </div>
    );
  }

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
            <h1 className="netra-page-title">Entity: <span>{query}</span></h1>
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
            value={platforms.length}
            delta="Multi-channel"
            deltaType="positive"
            subtext="Vector coverage"
          />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <KpiCard
            label="Linked Posts"
            value={filteredGraph.links.length}
            delta="From the graph API"
            deltaType="neutral"
            subtext="Edges in the subgraph"
          />
        </div>
      </div>

      {graphError ? (
        <ErrorState error={{ message: graphError }} onRetry={onRetryGraph} />
      ) : filteredGraph.nodes.length === 0 ? (
        <EmptyState>The graph endpoint returned no nodes for this query.</EmptyState>
      ) : (
        <GlassCard className="p-4">
          <h2 className="mb-3 text-base font-medium text-gray-100">Investigated Subgraph Connections</h2>
          <NetworkGraph graphData={filteredGraph} highlightQuery={searchQuery} />
        </GlassCard>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-medium text-gray-100">Investigated Messages</h2>
          <span className="pill font-mono text-[10px]">{docs.length}</span>
        </div>
        {docs.length === 0 ? (
          <EmptyState>No collected posts matched this query.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
            {docs.map((row, index) => {
              const mode = row.source_mode || row.metadata?.source_mode || '—';
              const id = row.canonical_id || row.post_id || row.native_id || index;
              const text = row.text_content || row.content || row.text || '';
              const when = row.published_at || row.created_at;
              return (
                <button
                  key={id}
                  type="button"
                  className="glass relative z-10 p-4 text-left"
                  onClick={() => onSelectPost?.(row)}
                >
                  <header className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium uppercase text-white">
                      {getPlatformIcon(row.platform)}
                      <span className="truncate">{row.platform || 'WEB'}</span>
                    </span>
                    <span className="pill shrink-0 font-mono text-[10px]">{String(id).slice(0, 8)}</span>
                  </header>
                  <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-slate-300">{text || 'No text stored for this item.'}</p>
                  <dl className="mt-3 grid grid-cols-3 gap-2">
                    <div>
                      <dt className="label-xs">Mode</dt>
                      <dd className="mt-1 font-mono text-[11px] text-slate-200">{mode}</dd>
                    </div>
                    <div>
                      <dt className="label-xs">Author</dt>
                      <dd className="mt-1 truncate font-mono text-[11px] text-slate-200">
                        {String(row.author_short_id || row.author_id || 'masked').slice(0, 10)}
                      </dd>
                    </div>
                    <div>
                      <dt className="label-xs">Date</dt>
                      <dd className="mt-1 font-mono text-[11px] text-slate-200">
                        {when ? new Date(when).toLocaleDateString() : '—'}
                      </dd>
                    </div>
                  </dl>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}