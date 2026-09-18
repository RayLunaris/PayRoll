'use client';

import { useState, useEffect, useCallback } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import { Megaphone, Plus, AlertTriangle, Clock, FileText } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'urgent';
  attachmentUrl?: string;
  isPublished: boolean;
  publishedAt: string;
  createdAt: string;
}

export default function AnnouncementsPage() {
  const user = useAuthStore((state) => state.user);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ data: Announcement[] }>('/announcements');
      setAnnouncements(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await fetchAnnouncements();
    })();
  }, [fetchAnnouncements]);

  // Permission yang menyangkut access control: mohon direview manual (AGENT_RULES #16)
  const canCreate = user && ['hr_admin', 'super_admin'].includes(user.role);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      await api.post('/announcements', {
        title,
        content,
        priority,
      });
      setTitle('');
      setContent('');
      setPriority('normal');
      setShowCreate(false);
      await fetchAnnouncements();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(
        axiosErr.response?.data?.error || 'Gagal membuat pengumuman',
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (id: string) => {
    setError('');
    try {
      await api.put(`/announcements/${id}/publish`, {});
      await fetchAnnouncements();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(
        axiosErr.response?.data?.error || 'Gagal mempublish pengumuman',
      );
    }
  };

  return (
    <div>
      <Breadcrumb />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Megaphone className="h-6 w-6 text-blue-600" />
            Pengumuman Perusahaan
          </h1>
          <p className="text-gray-500 mt-1">
            Informasi dan pengumuman internal perusahaan
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" />
            Buat Pengumuman
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && canCreate && (
        <form onSubmit={handleCreate} className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Pengumuman Baru
          </h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="announcementTitle" className="label">
                Judul
              </label>
              <input
                id="announcementTitle"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
                placeholder="Judul pengumuman"
                required
              />
            </div>
            <div>
              <label htmlFor="announcementContent" className="label">
                Isi Pengumuman
              </label>
              <textarea
                id="announcementContent"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                className="input"
                placeholder="Isi pengumuman..."
                required
              />
            </div>
            <div>
              <label htmlFor="announcementPriority" className="label">
                Prioritas
              </label>
              <select
                id="announcementPriority"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as 'normal' | 'urgent')
                }
                className="input"
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="btn btn-secondary"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving || !title.trim() || !content.trim()}
                className="btn btn-primary"
              >
                {saving ? 'Menyimpan...' : 'Simpan Pengumuman'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Announcements list */}
      {loading ? (
        <div className="card flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((item) => (
            <div
              key={item.id}
              className={`card ${
                item.priority === 'urgent'
                  ? 'border-l-4 border-l-red-500'
                  : ''
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {item.priority === 'urgent' && (
                      <span className="badge badge-danger">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        URGENT
                      </span>
                    )}
                    <h3 className="text-lg font-semibold text-gray-900">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {item.publishedAt
                      ? new Date(item.publishedAt).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Belum dipublish'}
                  </p>
                </div>
                {canCreate && !item.isPublished && (
                  <button
                    type="button"
                    onClick={() => handlePublish(item.id)}
                    className="btn btn-success btn-sm"
                  >
                    Publish
                  </button>
                )}
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{item.content}</p>
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
      )}
    </div>
  );
}