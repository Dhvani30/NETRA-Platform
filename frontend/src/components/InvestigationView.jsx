import { useState, useEffect } from 'react';
import { ArrowLeft, Globe, MessageSquare, Share2, TrendingUp, Activity, ShieldAlert, FileText, CornerDownRight } from 'lucide-react';
import NetworkGraph from './NetworkGraph';

export default function InvestigationView({ investigationData, graphData, onBack, searchQuery }) {
  const [filteredGraph, setFilteredGraph] = useState({ nodes: [], links: [] });

  // 🧠 Smart Subgraph Filtering: Only show nodes connected to the search query
  useEffect(() => {
    if (!graphData || !graphData.nodes || !searchQuery) {
      setFilteredGraph({ nodes: [], links: [] });
      return;
    }

    const q = searchQuery.toLowerCase();
    
    // Find nodes matching the search query
    const matchedNodes = graphData.nodes.filter(n => 
      (n.label || '').toLowerCase().includes(q) || 
      (n.id || '').toLowerCase().includes(q)
    );

    if (matchedNodes.length === 0) {
      setFilteredGraph({ nodes: [], links: [] });
      return;
    }

    const matchedIds = new Set(matchedNodes.map(n => n.id));

    // Get all links connected to matched nodes (1-hop)
    const relevantLinks = graphData.links.filter(l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      return matchedIds.has(sourceId) || matchedIds.has(targetId);
    });

    // Collect all node IDs in these links
    const connectedIds = new Set();
    relevantLinks.forEach(l => {
      connectedIds.add(typeof l.source === 'object' ? l.source.id : l.source);
      connectedIds.add(typeof l.target === 'object' ? l.target.id : l.target);
    });

    // Also include the primary matched nodes
    matchedNodes.forEach(n => connectedIds.add(n.id));

    // Filter to only these nodes
    const filteredNodes = graphData.nodes.filter(n => connectedIds.has(n.id));

    setFilteredGraph({ nodes: filteredNodes, links: relevantLinks });
  }, [graphData, searchQuery]);

  const getPlatformIcon = (platform) => {
    const platformLower = platform?.toLowerCase() || '';
    if (platformLower.includes('twitter') || platformLower.includes('x')) return <Share2 className="w-3.5 h-3.5 text-[#9B9F96]" />;
    if (platformLower.includes('reddit')) return <MessageSquare className="w-3.5 h-3.5 text-[#9B9F96]" />;
    return <Globe className="w-3.5 h-3.5 text-[#9B9F96]" />;
  };

  const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'Recent';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Editorial Dossier Header */}
      <div className="bg-[#1E211F] border border-[#343934] rounded p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="px-3 py-1.5 rounded bg-[#252925] hover:bg-[#343934] border border-[#343934] hover:border-[#424842] text-xs font-medium text-[#9B9F96] hover:text-[#E5E6DF] transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Overview</span>
          </button>
          
          <span className="h-4 w-px bg-[#343934] hidden sm:inline-block" />

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#91A891]">
                INVESTIGATION DOSSIER
              </span>
              <span className="text-sm font-semibold tracking-tight text-[#E5E6DF]">
                &ldquo;{searchQuery}&rdquo;
              </span>
            </div>
            <p className="text-[11px] text-[#9B9F96]">
              Analytical intelligence breakdown and corroborating observational records
            </p>
          </div>
        </div>

        <div className="text-right text-[11px] font-mono text-[#686D65] hidden sm:block">
          STATUS // CLASSIFIED MEMO
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#343934] border border-[#343934] rounded overflow-hidden">
        <div className="bg-[#1E211F] p-4">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#9B9F96] mb-1">
            Matched Observations
          </div>
          <div className="text-xl font-semibold font-mono text-[#E5E6DF]">
            {investigationData.summary?.observations || 0}
          </div>
        </div>

        <div className="bg-[#1E211F] p-4">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#9B9F96] mb-1">
            Detected Entities
          </div>
          <div className="text-xl font-semibold font-mono text-[#E5E6DF]">
            {investigationData.summary?.entities?.length || 0}
          </div>
        </div>

        <div className="bg-[#1E211F] p-4">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#9B9F96] mb-1">
            Monitored Platforms
          </div>
          <div className="text-xl font-semibold font-mono text-[#E5E6DF]">
            {investigationData.summary?.platforms?.length || 0}
          </div>
        </div>

        <div className="bg-[#1E211F] p-4">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#9B9F96] mb-1">
            Signal Velocity
          </div>
          <div className="text-xl font-semibold font-mono text-[#91A891]">
            {investigationData.summary?.activity_trend || '0%'}
          </div>
        </div>
      </div>

      {/* Provenance Memorandum & Corroborating Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Analytical Provenance (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-[#1E211F] border border-[#343934] rounded p-5">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#343934]">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#91A891]" />
                <h2 className="text-sm font-semibold tracking-tight text-[#E5E6DF]">
                  Analytical Provenance & Rationale
                </h2>
              </div>
              <span className="text-[10px] font-mono text-[#686D65]">SYNTHESIS</span>
            </div>

            {/* Memorandum Box */}
            <div className="p-4 rounded bg-[#171918] border-l-2 border-[#91A891] mb-5">
              <p className="font-serif text-[13.5px] leading-relaxed text-[#E5E6DF]/95 italic tracking-normal">
                &ldquo;{investigationData.provenance}&rdquo;
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#9B9F96] mb-2">
                  Associated Entities & Actors
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {investigationData.summary?.entities?.length ? (
                    investigationData.summary.entities.slice(0, 10).map((entity, index) => (
                      <span
                        key={index}
                        className="px-2.5 py-1 rounded text-xs font-mono bg-[#252925] text-[#E5E6DF] border border-[#343934]"
                      >
                        {entity}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#686D65]">No named entities extracted.</span>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-[#343934]">
                <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#9B9F96] mb-2">
                  Distribution Vectors
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {investigationData.summary?.platforms?.map((platform, index) => (
                    <span
                      key={index}
                      className="px-2.5 py-1 rounded text-xs font-mono bg-[#252925] text-[#9B9F96] border border-[#343934] flex items-center gap-1.5"
                    >
                      {getPlatformIcon(platform)}
                      <span>{platform.toUpperCase()}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Evidence Feed (7 cols) */}
        <div className="lg:col-span-7">
          <section className="bg-[#1E211F] border border-[#343934] rounded flex flex-col h-[520px]">
            <div className="p-4 border-b border-[#343934] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B6A98A]" />
                  <h2 className="text-sm font-semibold tracking-tight text-[#E5E6DF]">
                    Corroborating Observational Evidence
                  </h2>
                </div>
                <p className="text-[11px] text-[#9B9F96] mt-0.5">
                  Direct signals captured across active channels
                </p>
              </div>
              <span className="text-xs font-mono text-[#9B9F96]">
                {investigationData.posts?.length || 0} signals
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#343934]/60 p-2">
              {!investigationData.posts || investigationData.posts.length === 0 ? (
                <div className="py-24 text-center text-xs text-[#9B9F96]">
                  No corroborating signals recorded for this search filter.
                </div>
              ) : (
                investigationData.posts.map((post, index) => {
                  const isNeg = post.sentiment_label === 'NEGATIVE';
                  const isPos = post.sentiment_label === 'POSITIVE';
                  const sentimentStyle = isNeg
                    ? 'text-[#C0615A] bg-[#C0615A]/10 border-[#C0615A]/20'
                    : isPos
                    ? 'text-[#91A891] bg-[#91A891]/10 border-[#91A891]/20'
                    : 'text-[#B6A98A] bg-[#B6A98A]/10 border-[#B6A98A]/20';

                  return (
                    <article key={index} className="p-3.5 hover:bg-[#252925] transition-colors rounded-sm">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-[#9B9F96] font-mono">
                          {getPlatformIcon(post.platform)}
                          <span className="text-[#E5E6DF] font-medium">
                            {post.author_username || post.platform?.toUpperCase() || 'ANON'}
                          </span>
                          <span>•</span>
                          <span>{getRelativeTime(post.published_at)}</span>
                        </div>

                        {post.sentiment_label && (
                          <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${sentimentStyle}`}>
                            {post.sentiment_label}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#E5E6DF]/90 leading-relaxed font-normal">
                        {post.text_content || post.content || 'No text content available.'}
                      </p>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Localized Subgraph Focus */}
      <section className="pt-2">
        <NetworkGraph graphData={filteredGraph} highlightQuery={searchQuery} />
      </section>
    </div>
  );
}