'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, Heart, MessageSquare, ArrowRight, Sparkles } from 'lucide-react';
import api from '@/lib/api';

interface PostItem {
  id: string;
  authorName?: string;
  authorEmail?: string;
  authorRole?: string;
  content: string;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
}

function timeAgo(dateString: string): string {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins}m lalu`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}j lalu`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}h lalu`;
  } catch {
    return dateString;
  }
}

export default function SocialFeedBrief() {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      try {
        const res = await api.get('/posts?limit=2');
        if (active && Array.isArray(res.data?.data)) {
          setPosts(res.data.data.slice(0, 2));
        }
      } catch (err) {
        console.error('Failed to load social feed posts:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-card p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-pink-50 text-pink-600">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Feed Sosial Perusahaan</h3>
              <p className="text-xs text-gray-500">Kabar terbaru rekan kerja</p>
            </div>
          </div>
          <span className="p-1 rounded-full bg-pink-50 text-pink-500">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-3 my-3">
            {[1, 2].map((i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-xl space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-gray-600">Belum ada obrolan terbaru</p>
            <p className="text-xs text-gray-400 mt-1">Jadilah yang pertama berbagi cerita di feed perusahaan!</p>
          </div>
        ) : (
          <div className="space-y-3 my-2">
            {posts.map((post) => (
              <div
                key={post.id}
                className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 hover:bg-pink-50/20 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-pink-500 to-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {(post.authorName || post.authorEmail || 'U').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-gray-900 truncate max-w-[140px]">
                      {post.authorName || post.authorEmail || 'Karyawan'}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400">{timeAgo(post.createdAt)}</span>
                </div>

                <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                  {post.content}
                </p>

                <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1">
                    <Heart className="w-3 h-3 text-red-500 fill-red-500/30" />
                    {post.likesCount || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 text-gray-400" />
                    {post.commentsCount || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-3 mt-2 border-t border-gray-100 flex items-center justify-between text-xs">
        <span className="text-gray-400">Ikuti percakapan</span>
        <Link
          href="/social/feed"
          className="text-pink-600 hover:text-pink-700 font-medium inline-flex items-center gap-1 hover:underline"
        >
          <span>Buka Feed</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
