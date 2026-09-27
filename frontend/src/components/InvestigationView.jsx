import ForceGraph2D from 'react-force-graph-2d';
import { ArrowLeft, Globe, MessageSquare, Share2, TrendingUp, Building, Users, Activity } from 'lucide-react';

const NODE_COLORS = {
  Platform: '#3b82f6',
  Post: '#f97316',
  Narrative: '#ec4899',
  Organization: '#a855f7',
  Location: '#eab308'
};

export default function InvestigationView({ investigationData, graphData, onBack, searchQuery }) {
  const getPlatformIcon = (platform) => {
    const platformLower = platform?.toLowerCase() || '';
    if (platformLower.includes('twitter') || platformLower.includes('x')) return <Share2 className="w-4 h-4" />;
    if (platformLower.includes('reddit')) return <MessageSquare className="w-4 h-4" />;
    return <Globe className="w-4 h-4" />;
  };

  const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'Unknown time';
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

  const getNodeColor = (node) => {
    return NODE_COLORS[node.group] || '#888888';
  };

  const highlightMatchingNodes = (node) => {
    const searchLower = searchQuery.toLowerCase();
    const labelLower = (node.label || '').toLowerCase();
    const idLower = (node.id || '').toLowerCase();
    
    if (labelLower.includes(searchLower) || idLower.includes(searchLower)) {
      return '#00f0ff'; // Highlight matching nodes with accent color
    }
    return getNodeColor(node);
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex justify-between items-center p-4 rounded-lg" style={{ backgroundColor: '#13131f' }}>
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold tracking-wider" style={{ color: '#00f0ff' }}>
            INVESTIGATION: {searchQuery.toUpperCase()}
          </h1>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#13131f' }}>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5" style={{ color: '#00f0ff' }} />
            <span className="text-sm text-gray-400">Observations</span>
          </div>
          <div className="text-3xl font-bold">{investigationData.summary.observations}</div>
        </div>
        
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#13131f' }}>
          <div className="flex items-center gap-2 mb-2">
            <Building className="w-5 h-5" style={{ color: '#a855f7' }} />
            <span className="text-sm text-gray-400">Unique Entities</span>
          </div>
          <div className="text-3xl font-bold">{investigationData.summary.entities.length}</div>
        </div>
        
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#13131f' }}>
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-5 h-5" style={{ color: '#3b82f6' }} />
            <span className="text-sm text-gray-400">Platforms</span>
          </div>
          <div className="text-3xl font-bold">{investigationData.summary.platforms.length}</div>
        </div>
        
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#13131f' }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5" style={{ color: '#10b981' }} />
            <span className="text-sm text-gray-400">Activity Trend</span>
          </div>
          <div className="text-3xl font-bold" style={{ color: '#10b981' }}>
            {investigationData.summary.activity_trend}
          </div>
        </div>
      </div>

      {/* Provenance Panel and Evidence Feed */}
      <div className="grid grid-cols-2 gap-6">
        {/* Provenance Panel */}
        <div className="p-6 rounded-lg" style={{ backgroundColor: '#13131f' }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: '#00f0ff' }}>WHY THIS NARRATIVE?</h2>
          <div className="p-4 rounded" style={{ backgroundColor: '#0a0a0f', borderLeft: '4px solid #00f0ff' }}>
            <p className="text-gray-300 leading-relaxed">{investigationData.provenance}</p>
          </div>
          
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-400">KEY ENTITIES</h3>
            <div className="flex flex-wrap gap-2">
              {investigationData.summary.entities.slice(0, 8).map((entity, index) => (
                <span 
                  key={index} 
                  className="px-3 py-1 rounded-full text-sm"
                  style={{ backgroundColor: '#1f2937', color: '#00f0ff' }}
                >
                  {entity}
                </span>
              ))}
            </div>
          </div>
          
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-400">PLATFORMS INVOLVED</h3>
            <div className="flex flex-wrap gap-2">
              {investigationData.summary.platforms.map((platform, index) => (
                <span 
                  key={index} 
                  className="px-3 py-1 rounded-full text-sm flex items-center gap-1"
                  style={{ backgroundColor: '#1f2937', color: '#fff' }}
                >
                  {getPlatformIcon(platform)}
                  {platform.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Evidence Feed */}
        <div className="p-6 rounded-lg" style={{ backgroundColor: '#13131f' }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: '#00f0ff' }}>EVIDENCE FEED</h2>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {investigationData.posts.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No evidence found</p>
            ) : (
              investigationData.posts.map((post, index) => (
                <div key={index} className="p-3 rounded border-l-4" style={{ backgroundColor: '#0a0a0f', borderColor: '#00f0ff' }}>
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    {getPlatformIcon(post.platform)}
                    <span>{post.platform?.toUpperCase() || 'UNKNOWN'}</span>
                    <span>•</span>
                    <span>{getRelativeTime(post.published_at)}</span>
                  </div>
                  <p className="text-white text-sm leading-relaxed">
                    {(post.text_content || post.content || 'No content').substring(0, 150)}...
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Sub-Graph */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: '#13131f', height: '500px' }}>
        <h2 className="text-xl font-bold mb-2" style={{ color: '#00f0ff' }}>ENTITY RELATIONSHIP NETWORK</h2>
        {graphData.nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 text-xl">No graph data available. Run graph_builder.py first.</p>
          </div>
        ) : (
          <ForceGraph2D
            graphData={graphData}
            width={window.innerWidth - 80}
            height={450}
            nodeLabel="label"
            nodeColor={highlightMatchingNodes}
            linkColor="#555"
            backgroundColor="#13131f"
          />
        )}
      </div>
    </div>
  );
}