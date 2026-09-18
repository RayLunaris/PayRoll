'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import { ImagePlus, Send } from 'lucide-react';
import type { SocialPost } from './PostCard';

export default function PostComposer({
  onPostCreated,
}: {
  onPostCreated: (post: SocialPost) => void;
}) {
  const user = useAuthStore((state) => state.user);
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setPosting(true);
    setError('');

    try {
      const response = await api.post<{ data: SocialPost }>('/posts', {
        content: content.trim(),
        postType: 'feed',
      });

      onPostCreated(response.data.data);
      setContent('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(
        axiosErr.response?.data?.error || 'Gagal membuat postingan',
      );
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
          {user?.email?.charAt(0).toUpperCase() || 'U'}
        </div>
        <input
          type="text"
          placeholder="Siapa nama Anda?"
          className="text-sm font-medium text-gray-900 bg-transparent outline-none flex-1"
          value={user?.email?.split('@')[0] || ''}
          readOnly
        />
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Apa yang sedang terjadi di perusahaan?"
          rows={3}
          className="input resize-none"
        />

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between mt-3">
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
            title="Upload lampiran (segera hadir)"
          >
            <ImagePlus className="h-5 w-5" />
          </button>
          <button
            type="submit"
            disabled={!content.trim() || posting}
            className="btn btn-primary btn-sm"
          >
            <Send className="h-4 w-4" />
            {posting ? 'Mengirim...' : 'Kirim'}
          </button>
        </div>
      </form>
    </div>
  );
}