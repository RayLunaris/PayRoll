'use client';

import { useState } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Image as ImageIcon,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

export interface SocialPost {
  id: string;
  userId: string;
  content: string;
  attachmentUrl?: string;
  postType: string;
  forumCategory?: string;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  authorEmail?: string;
  authorRole?: string;
  authorName?: string;
}

interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  authorEmail?: string;
  authorName?: string;
}

function timeAgo(date: string): string {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return `${seconds} detik`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} menit`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam`;
  return `${Math.floor(seconds / 86400)} hari`;
}

export default function PostCard({ post }: { post: SocialPost }) {
  const user = useAuthStore((state) => state.user);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  const authorName = post.authorName || post.authorEmail || 'Karyawan';

  const handleLike = async () => {
    try {
      const response = await api.post<{
        data: { liked: boolean; likesCount: number };
      }>(`/posts/${post.id}/like`, {});
      setLiked(response.data.data.liked);
      setLikesCount(response.data.data.likesCount);
    } catch (error) {
      console.error('Failed to like post:', error);
    }
  };

  const fetchComments = async () => {
    if (showComments) {
      setShowComments(false);
      return;
    }

    setCommentLoading(true);
    try {
      const response = await api.get<{ data: Comment[] }>(
        `/posts/${post.id}/comments`,
      );
      setComments(response.data.data || []);
      setShowComments(true);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setCommentLoading(false);
    }
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    try {
      await api.post(`/posts/${post.id}/comments`, { content: comment.trim() });
      setComment('');
      setCommentsCount((c) => c + 1);
      const response = await api.get<{ data: Comment[] }>(
        `/posts/${post.id}/comments`,
      );
      setComments(response.data.data || []);
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  return (
    <div className="card">
      {/* Post header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-semibold">
          {(post.authorName || post.userId || 'U').charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{authorName}</p>
          <p className="text-xs text-gray-500">{timeAgo(post.createdAt)} yang lalu</p>
        </div>
      </div>

      {/* Post content */}
      <p className="text-gray-800 mb-3 whitespace-pre-wrap">{post.content}</p>

      {post.attachmentUrl && (
        <div className="mb-3 rounded-lg bg-gray-100 flex items-center justify-center p-8">
          <ImageIcon className="h-10 w-10 text-gray-400" />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={handleLike}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            liked
              ? 'text-red-600 bg-red-50'
              : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
          {likesCount}
        </button>
        <button
          type="button"
          onClick={fetchComments}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50"
        >
          <MessageCircle className="h-4 w-4" />
          {commentsCount}
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50"
          title="Bagikan (segera hadir)"
        >
          <Share2 className="h-4 w-4" />
          Bagikan
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {commentLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2 mb-3">
                <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-semibold text-gray-500">
                  {(c.authorName || c.userId || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 bg-gray-50 rounded-lg p-2">
                  <p className="text-xs font-medium text-gray-700 mb-0.5">
                    {c.authorName || c.authorEmail || 'Karyawan'}
                  </p>
                  <p className="text-sm text-gray-600">{c.content}</p>
                </div>
              </div>
            ))
          )}

          <form onSubmit={addComment} className="flex items-center gap-2">
            <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-semibold text-gray-500">
              {(user?.email?.charAt(0) || 'U').toUpperCase()}
            </div>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tulis komentar..."
              className="flex-1 bg-gray-50 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!comment.trim()}
              className="btn btn-primary btn-sm"
            >
              Kirim
            </button>
          </form>
        </div>
      )}
    </div>
  );
}