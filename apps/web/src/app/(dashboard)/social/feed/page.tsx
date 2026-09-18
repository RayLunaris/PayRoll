'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import PostCard, { type SocialPost } from '@/components/social/PostCard';
import PostComposer from '@/components/social/PostComposer';
import api from '@/lib/api';
import { MessageCircle, Users } from 'lucide-react';

const PAGE_SIZE = 10;

export default function SocialFeedPage() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{
        data: SocialPost[];
        pagination: { totalPages: number };
      }>(`/posts?page=${page}&limit=${PAGE_SIZE}`);

      const newPosts = response.data.data;
      if (page === 1) {
        setPosts(newPosts);
      } else {
        setPosts((prev) => [...prev, ...newPosts]);
      }

      setHasMore(page < response.data.pagination.totalPages);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void (async () => {
      await fetchPosts();
    })();
  }, [fetchPosts]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((p) => p + 1);
        }
      },
      { threshold: 0.5 },
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading]);

  const handleNewPost = (post: SocialPost) => {
    setPosts((prev) => [post, ...prev]);
  };

  return (
    <div>
      <Breadcrumb />

      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <MessageCircle className="h-6 w-6 text-blue-600" />
            Feed Komunitas
          </h1>
          <p className="text-gray-500 mt-1">
            Berbagi aktivitas dan informasi dengan karyawan
          </p>
        </div>

        {/* Post composer */}
        <PostComposer onPostCreated={handleNewPost} />

        {/* Posts */}
        <div className="space-y-4 mt-6">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>

        {/* Loading indicator */}
        <div ref={loadMoreRef} className="py-4 text-center">
          {loading && (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          )}
          {!hasMore && posts.length > 0 && (
            <p className="text-sm text-gray-400">Tidak ada lagi postingan</p>
          )}
          {posts.length === 0 && !loading && (
            <div className="py-8 text-center">
              <Users className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p className="text-gray-500">Belum ada postingan</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}