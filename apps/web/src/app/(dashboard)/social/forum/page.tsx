'use client';

import { useState, useEffect, useCallback } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import PostCard, { type SocialPost } from '@/components/social/PostCard';
import api from '@/lib/api';
import {
  MessagesSquare,
  Plus,
  Search,
  Filter,
  Loader2,
  FolderOpen,
  Send,
  HelpCircle,
  Code2,
  Users2,
  Lightbulb,
  MessageSquare,
} from 'lucide-react';

const FORUM_CATEGORIES = [
  { id: 'all', label: 'Semua Kategori', icon: FolderOpen },
  { id: 'Umum', label: 'Umum & Sosial', icon: MessagesSquare },
  { id: 'Teknologi', label: 'Teknologi & IT', icon: Code2 },
  { id: 'HR & Budaya', label: 'HR & Budaya Kerja', icon: Users2 },
  { id: 'Tanya Jawab', label: 'Tanya Jawab (Q&A)', icon: HelpCircle },
  { id: 'Saran & Masukan', label: 'Saran & Inovasi', icon: Lightbulb },
];

export default function ForumPage() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New post form state
  const [category, setCategory] = useState('Umum');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const fetchForumPosts = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/posts?postType=forum&limit=50';
      if (selectedCategory !== 'all') {
        url += `&category=${encodeURIComponent(selectedCategory)}`;
      }
      const res = await api.get<{ data: SocialPost[] }>(url);
      setPosts(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch forum posts:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    void fetchForumPosts();
  }, [fetchForumPosts]);

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await api.post<{ data: SocialPost }>('/posts', {
        content: content.trim(),
        postType: 'forum',
        forumCategory: category,
      });

      if (res.data.data) {
        setPosts((prev) => [res.data.data, ...prev]);
        setContent('');
        setShowComposer(false);
      }
    } catch (err: any) {
      console.error('Failed to create forum post:', err);
      setError(err?.response?.data?.message || 'Gagal mempublikasikan diskusi. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPosts = posts.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.content.toLowerCase().includes(q) ||
      p.authorName?.toLowerCase().includes(q) ||
      p.forumCategory?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessagesSquare className="h-6 w-6 text-blue-600" />
            Forum Diskusi Internal
          </h1>
          <p className="text-gray-500 mt-1">
            Ruang bertukar pikiran, tanya jawab, dan diskusi antar karyawan.
          </p>
        </div>

        <button
          onClick={() => setShowComposer(!showComposer)}
          className="btn btn-primary flex items-center gap-2 text-sm self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Mulai Diskusi Baru
        </button>
      </div>

      {/* Composer Modal/Form */}
      {showComposer && (
        <div className="card p-6 border-2 border-blue-200 bg-blue-50/30">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            Buat Topik Diskusi Baru
          </h2>

          <form onSubmit={handleCreateTopic} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                Kategori Diskusi
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full sm:w-64 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {FORUM_CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                Isi Topik / Pertanyaan
              </label>
              <textarea
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Tulis topik diskusi, ide, atau pertanyaan Anda di sini..."
                className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowComposer(false)}
                className="btn btn-outline text-sm"
                disabled={submitting}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting || !content.trim()}
                className="btn btn-primary flex items-center gap-1.5 text-sm"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Publikasikan Topik
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid: Categories Sidebar & Threads */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Categories Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Kategori Forum
            </h3>
            <div className="space-y-1">
              {FORUM_CATEGORIES.map((c) => {
                const Icon = c.icon;
                const active = selectedCategory === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                      active
                        ? 'bg-blue-600 text-white font-medium shadow-sm'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-gray-500'}`} />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Threads List */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search bar */}
          <div className="card p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari topik diskusi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {loading ? (
            <div className="card flex flex-col items-center justify-center py-16 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
              <p className="text-sm">Memuat topik diskusi...</p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-16 text-gray-500">
              <MessagesSquare className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-base font-medium text-gray-700">Belum ada topik diskusi</p>
              <p className="text-xs text-gray-400 mt-1">
                Jadilah yang pertama memulai diskusi pada kategori ini!
              </p>
              <button
                onClick={() => setShowComposer(true)}
                className="btn btn-primary mt-4 text-sm"
              >
                Mulai Diskusi
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPosts.map((post) => (
                <div key={post.id} className="relative">
                  {post.forumCategory && (
                    <div className="absolute top-4 right-4 z-10">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                        {post.forumCategory}
                      </span>
                    </div>
                  )}
                  <PostCard post={post} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
