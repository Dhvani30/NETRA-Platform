import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Play, Eye, Clock, RefreshCw, ExternalLink } from 'lucide-react';
import { Badge, Button, PillTabs } from './ui/primitives';
import { EmptyState, ErrorState, ScreenSkeleton } from './ui/dataState';
import { API_URL } from '../config';

export default function YouTubeFeedView() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState('All Topics');
  const loadedOnce = useRef(false);

  const fetchYouTubeFeed = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/youtube/feed?t=${Date.now()}`);
      setVideos(res.data.videos || []);
      setError(null);
    } catch {
      setError("Can't reach the NETRA API. Start the backend and retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    void fetchYouTubeFeed();
  }, []);

  const topics = ['All Topics', ...new Set(videos.map(video => video.topic).filter(Boolean))];

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
            Video rows returned by the YouTube feed endpoint.
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

      {error ? (
        <ErrorState error={{ message: error }} onRetry={fetchYouTubeFeed} />
      ) : loading ? (
        <ScreenSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState>
          {selectedTopic === 'All Topics'
            ? 'The YouTube feed returned no videos.'
            : 'The YouTube feed returned no videos for this filter.'}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {filtered.map((video) => (
            <article key={video.id} className="glass group flex flex-col">
              <div className="relative h-40 shrink-0 overflow-hidden bg-[#08091A]">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="h-40 w-full object-cover"
                />
                <div className="absolute top-2 left-2 z-10 flex max-w-[70%] items-center gap-1.5">
                  <Badge variant="neutral" className="bg-black/60 text-[10px] backdrop-blur">
                    {video.topic}
                  </Badge>
                  <Badge variant="accent" className="text-[9px]">
                    {video.source_mode}
                  </Badge>
                </div>
                <div className="absolute bottom-2 right-2 z-10 rounded bg-black/80 px-2 py-0.5 font-mono text-[10px] text-gray-200">
                  {video.duration}
                </div>
                <a
                  href={video.url}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Open ${video.title}`}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/80 text-white">
                    <Play className="ml-0.5 h-5 w-5 fill-current" />
                  </span>
                </a>
              </div>

              <div className="relative z-10 flex flex-col gap-3 p-4">
                <header>
                  <h3 className="line-clamp-2 text-sm font-medium leading-snug text-gray-100">
                    <a href={video.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1">
                      {video.title}
                      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />
                    </a>
                  </h3>
                  <p className="mt-1 truncate text-xs text-slate-400">{video.channel}</p>
                </header>
                <footer className="flex items-center justify-between gap-2 border-t border-white/10 pt-3 font-mono text-[11px] text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {video.views}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {formatPublished(video.published)}
                  </span>
                  <span className={`rounded px-2 py-0.5 ${
                    video.sentiment === 'POSITIVE' ? 'bg-emerald-500/10 text-emerald-400' :
                    video.sentiment === 'NEGATIVE' ? 'bg-rose-500/10 text-rose-400' :
                    'bg-amber-500/10 text-amber-400'
                  }`}>
                    {video.sentimentScore}
                  </span>
                </footer>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
