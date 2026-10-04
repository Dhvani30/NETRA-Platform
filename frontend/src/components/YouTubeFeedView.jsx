import { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Eye, Clock, Video, RefreshCw, ExternalLink } from 'lucide-react';
import { Badge, Button, GlassCard, PillTabs } from './ui/primitives';
import { API_URL } from '../config';

export default function YouTubeFeedView() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState('All Topics');

  const fetchYouTubeFeed = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/youtube/feed?t=${Date.now()}`);
      setVideos(res.data.videos || []);
    } catch (error) {
      console.error("Error fetching YouTube feed:", error);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchYouTubeFeed();
  }, []);

  const topics = ['All Topics', 'Cybersecurity', 'AI Regulation', 'Defense', 'Financial Tech'];

  const filtered = selectedTopic === 'All Topics'
    ? videos
    : videos.filter(v => (v.topic || '').toLowerCase().includes(selectedTopic.toLowerCase()));

  const formatPublished = (timestamp) => {
    if (!timestamp) return 'Recent';
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Recent';
    }
  };

  return (
    <div className="space-y-6">
      {/* Screen Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="label-xs text-indigo-300">Video Telemetry Stream</span>
          <h1 className="text-2xl font-light text-white tracking-wide">
            YouTube <span className="text-indigo-300 font-normal">Intelligence Feed</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time video metadata, transcripts, and sentiment extraction.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PillTabs
            tabs={topics}
            activeTab={selectedTopic}
            onChange={(t) => setSelectedTopic(t)}
          />
          <Button variant="secondary" onClick={fetchYouTubeFeed} loading={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <GlassCard className="p-12 text-center flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-gray-300 font-medium">Fetching YouTube video telemetry stream…</p>
        </GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard className="p-12 text-center flex flex-col items-center justify-center gap-3">
          <Video className="w-10 h-10 text-slate-500 opacity-60" />
          <h2 className="text-base font-medium text-gray-200">No YouTube Records Available</h2>
          <p className="text-xs text-slate-400 max-w-md">
            No ingested YouTube videos match the selected filter. Run the YouTube collector script (<code className="font-mono text-indigo-300">python app/collectors/youtube_ingestor.py --once</code>) to fetch live videos.
          </p>
        </GlassCard>
      ) : (
        /* Video Grid (3 Columns) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((video) => (
            <GlassCard key={video.id} className="p-0 overflow-hidden group flex flex-col justify-between">
              {/* Thumbnail Header */}
              <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80 group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                {/* Duration & Source Mode Badges */}
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono bg-black/80 text-gray-200 backdrop-blur">
                  {video.duration}
                </div>

                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <Badge variant="neutral" className="bg-black/60 backdrop-blur text-[10px]">
                    {video.topic}
                  </Badge>
                  <Badge variant={video.source_mode === 'REAL' ? 'success' : 'accent'} className="text-[9px]">
                    {video.source_mode}
                  </Badge>
                </div>

                {/* Play Overlay / External Link */}
                <a
                  href={video.url}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <div className="w-12 h-12 rounded-full bg-indigo-500/80 backdrop-blur flex items-center justify-center text-white shadow-lg">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </a>
              </div>

              {/* Card Content */}
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-100 line-clamp-2 leading-snug group-hover:text-indigo-200 transition-colors">
                    <a href={video.url} target="_blank" rel="noreferrer" className="flex items-start gap-1">
                      {video.title}
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5" />
                    </a>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 font-mono">{video.channel}</p>
                </div>

                {/* Meta Stats Row */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3 text-slate-400" /> {video.views} views
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" /> {formatPublished(video.published)}
                    </span>
                  </div>

                  {/* Sentiment Badge */}
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                    video.sentiment === 'POSITIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    video.sentiment === 'NEGATIVE' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                    'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {video.sentimentScore}
                  </span>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
