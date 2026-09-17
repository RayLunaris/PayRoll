# Phase 19: Frontend Social

**Objective:** Implementasi feed, direct messaging, forum, dan pengumuman  
**Estimated Time:** 10-12 hours  
**Prerequisites:** Phase 18 selesai

---

## Tasks

### 19.1 Create Social Feed Page

```bash
# src/app/(dashboard)/social/feed/page.tsx
cat > src/app/(dashboard)/social/feed/page.tsx << 'EOF'
'use client';

import { useState, useEffect, useRef } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import PostCard from '@/components/social/PostCard';
import PostComposer from '@/components/social/PostComposer';
import api from '@/lib/api';
import { MessageCircle, Users } from 'lucide-react';

export default function SocialFeedPage() {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPosts();
  }, [page]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((p) => p + 1);
        }
      },
      { threshold: 0.5 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/posts?page=${page}&limit=10`);
      const newPosts = response.data.data;
      
      if (page === 1) {
        setPosts(newPosts);
      } else {
        setPosts((prev) => [...prev, ...newPosts]);
      }
      
      setHasMore(newPosts.length === 10);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewPost = (post) => {
    setPosts((prev) => [post, ...prev]);
  };

  return (
    <div>
      <Breadcrumb />

      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-blue-600" />
            Feed Komunitas
          </h1>
          <p className="text-gray-500 mt-1">Berbagi aktivitas dan informasi dengan karyawan</p>
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
EOF
```

### 19.2 Create Post Composer

```bash
# src/components/social/PostComposer.tsx
cat > src/components/social/PostComposer.tsx << 'EOF'
'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import { ImagePlus, Send } from 'lucide-react';

export default function PostComposer({ onPostCreated }: { onPostCreated: (post: any) => void }) {
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
      const response = await api.post('/api/posts', {
        content: content.trim(),
        postType: 'feed',
      });
      
      onPostCreated(response.data.data);
      setContent('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal membuat postingan');
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

        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}

        <div className="flex items-center justify-between mt-3">
          <button type="button" className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
            <ImagePlus className="h-5 w-5" />
          </button>
          <button
            type="submit"
            disabled={!content.trim() || posting}
            className="btn btn-primary !py-1.5"
          >
            <Send className="h-4 w-4" />
            {posting ? 'Mengirim...' : 'Kirim'}
          </button>
        </div>
      </form>
    </div>
  );
}
EOF
```

### 19.3 Create Post Card

```bash
# src/components/social/PostCard.tsx
cat > src/components/social/PostCard.tsx << 'EOF'
'use client';

import { useState } from 'react';
import { Heart, MessageCircle, Share2, Image } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

interface Post {
  id: string;
  userId: string;
  content: string;
  attachmentUrl?: string;
  postType: string;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
}

export default function PostCard({ post }: { post: Post }) {
  const user = useAuthStore((state) => state.user);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [comments, setComments] = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');

  const timeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    
    if (seconds < 60) return `${seconds} detik`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} menit`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam`;
    return `${Math.floor(seconds / 86400)} hari`;
  };

  const handleLike = async () => {
    try {
      await api.post(`/api/posts/${post.id}/like`);
      setLiked(!liked);
      setLikesCount(liked ? likesCount - 1 : likesCount + 1);
    } catch (error) {
      console.error('Failed to like post:', error);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await api.get(`/api/posts/${post.id}/comments`);
      setComments(response.data.data);
      setShowComments(!showComments);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    try {
      await api.post(`/api/posts/${post.id}/comments`, { content: comment.trim() });
      setComment('');
      fetchComments();
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  return (
    <div className="card">
      {/* Post header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-semibold">
          {(post.userId || 'U').charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Karyawan</p>
          <p className="text-xs text-gray-500">{timeAgo(post.createdAt)} yang lalu</p>
        </div>
      </div>

      {/* Post content */}
      <p className="text-gray-800 mb-3 whitespace-pre-wrap">{post.content}</p>

      {post.attachmentUrl && (
        <div className="mb-3 rounded-lg bg-gray-100 flex items-center justify-center p-8">
          <Image className="h-10 w-10 text-gray-400" />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            liked ? 'text-red-600 bg-red-50' : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
          {likesCount}
        </button>
        <button
          onClick={fetchComments}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50"
        >
          <MessageCircle className="h-4 w-4" />
          {post.commentsCount}
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50">
          <Share2 className="h-4 w-4" />
          Bagikan
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-2 mb-3">
              <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-semibold text-gray-500">
                {comment.userId?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 bg-gray-50 rounded-lg p-2">
                <p className="text-xs font-medium text-gray-700 mb-0.5">Karyawan</p>
                <p className="text-sm text-gray-600">{comment.content}</p>
              </div>
            </div>
          ))}

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
            <button type="submit" disabled={!comment.trim()} className="btn btn-primary !py-1.5 !px-3 !text-xs">
              Kirim
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
EOF
```

### 19.4 Create Direct Message Page

```bash
# src/app/(dashboard)/social/messages/page.tsx
cat > src/app/(dashboard)/social/messages/page.tsx << 'EOF'
'use client';

import { useState, useEffect, useRef } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { MessageCircle, Send, Search, User } from 'lucide-react';

interface Conversation {
  userId: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (activeUser) {
      fetchMessages(activeUser);
    }
  }, [activeUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const response = await api.get('/api/messages');
      setConversations(response.data.data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (userId: string) => {
    try {
      const response = await api.get(`/api/messages/${userId}`);
      setMessages(response.data.data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeUser) return;

    try {
      const response = await api.post('/api/messages', {
        receiverId: activeUser,
        content: input.trim(),
      });
      
      setMessages((prev) => [response.data.data, ...prev]);
      setInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-blue-600" />
          Pesan
        </h1>
      </div>

      <div className="card h-[600px] flex overflow-hidden p-0">
        {/* Conversation list */}
        <div className="w-80 border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Cari percakapan..." className="input pl-9 !py-1.5 !text-sm" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.map((conv) => (
              <button
                key={conv.userId}
                onClick={() => setActiveUser(conv.userId)}
                className={`w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors ${
                  activeUser === conv.userId ? 'bg-blue-50' : ''
                }`}
              >
                <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      Karyawan
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{conv.lastMessage}</p>
                </div>
              </button>
            ))}
            
            {conversations.length === 0 && !loading && (
              <div className="p-6 text-center text-sm text-gray-500">
                Belum ada percakapan
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {/* Chat header */}
          <div className="p-4 border-b border-gray-200 flex items-center gap-3">
            <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {activeUser ? 'Karyawan' : 'Pilih percakapan'}
              </p>
              <p className="text-xs text-emerald-600">Online</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeUser ? (
              [...messages].reverse().map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderId === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    msg.senderId === 'me'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                  }`}>
                    <p className="text-sm">{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${
                      msg.senderId === 'me' ? 'text-blue-200' : 'text-gray-400'
                    }`}>
                      {new Date(msg.createdAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                Pilih percakapan untuk mulai chat
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {activeUser && (
            <form onSubmit={sendMessage} className="p-4 border-t border-gray-200 flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tulis pesan..."
                className="flex-1 rounded-full bg-gray-100 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="submit" disabled={!input.trim()} className="btn btn-primary !rounded-full !py-2">
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
EOF
```

### 19.5 Create Announcements Page

```bash
# src/app/(dashboard)/social/announcements/page.tsx
cat > src/app/(dashboard)/social/announcements/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import { Megaphone, Plus, AlertTriangle, Clock, FileText } from 'lucide-react';

export default function AnnouncementsPage() {
  const user = useAuthStore((state) => state.user);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('normal');

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const response = await api.get('/api/announcements');
      setAnnouncements(response.data.data);
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const canCreate = user && ['hr_admin', 'super_admin'].includes(user.role);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/announcements', {
        title,
        content,
        priority,
      });
      setTitle('');
      setContent('');
      setPriority('normal');
      setShowCreate(false);
      fetchAnnouncements();
    } catch (error) {
      console.error('Failed to create announcement:', error);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await api.put(`/api/announcements/${id}/publish`);
      fetchAnnouncements();
    } catch (error) {
      console.error('Failed to publish announcement:', error);
    }
  };

  return (
    <div>
      <Breadcrumb />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-blue-600" />
            Pengumuman Perusahaan
          </h1>
          <p className="text-gray-500 mt-1">Informasi dan pengumuman internal perusahaan</p>
        </div>
        {canCreate && (
          <button onClick={() => setShowCreate(!showCreate)} className="btn btn-primary">
            <Plus className="h-4 w-4" />
            Buat Pengumuman
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && canCreate && (
        <form onSubmit={handleCreate} className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pengumuman Baru</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Judul</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
                placeholder="Judul pengumuman"
                required
              />
            </div>
            <div>
              <label className="label">Isi Pengumuman</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                className="input"
                placeholder="Isi pengumuman..."
                required
              />
            </div>
            <div>
              <label className="label">Prioritas</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input">
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="btn btn-secondary">
                Batal
              </button>
              <button type="submit" className="btn btn-primary">
                Simpan Pengumuman
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Announcements list */}
      <div className="space-y-4">
        {announcements.map((item) => (
          <div key={item.id} className={`card ${item.priority === 'urgent' ? 'border-l-4 border-l-red-500' : ''}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {item.priority === 'urgent' && (
                    <span className="badge badge-red">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      URGENT
                    </span>
                  )}
                  <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {item.publishedAt
                    ? new Date(item.publishedAt).toLocaleString('id-ID', {
                        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })
                    : 'Belum dipublish'}
                </p>
              </div>
              {canCreate && !item.isPublished && (
                <button
                  onClick={() => handlePublish(item.id)}
                  className="btn btn-success !py-1 !px-3 !text-xs"
                >
                  Publish
                </button>
              )}
            </div>
            <p className="text-gray-700 whitepre-wrap">{item.content}</p>
            {item.attachmentUrl && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <FileText className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-blue-600">Lampiran</span>
              </div>
            )}
          </div>
        ))}

        {announcements.length === 0 && !loading && (
          <div className="card text-center py-8 text-gray-500">
            <Megaphone className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            Belum ada pengumuman
          </div>
        )}
      </div>
    </div>
  );
}
EOF
```

---

## Verification Checklist

- [ ] Feed menampilkan postingan
- [ ] Post composer bekerja
- [ ] Like/unlike bekerja
- [ ] Komentar bekerja
- [ ] Infinite scroll bekerja
- [ ] DM list percakapan bekerja
- [ ] Chat interface bekerja
- [ ] Pengumuman CRUD bekerja
- [ ] Priority urgent ditandai
- [ ] Permission check untuk create announcement

---

## Next Phase

Setelah Phase 19 selesai, lanjut ke:
**[Phase 20: Frontend Shift](./PHASE-20-FRONTEND-SHIFT.md)**