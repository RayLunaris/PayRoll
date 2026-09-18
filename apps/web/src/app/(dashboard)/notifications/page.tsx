'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  Wallet,
  Megaphone,
  Clock,
  CheckCheck,
  Trash2,
  ArrowRight,
  Filter,
} from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'announcement' | 'leave' | 'payroll' | 'attendance' | 'system';
  priority?: 'normal' | 'urgent';
  createdAt: string;
  isRead: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

interface AnnouncementResponse {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'urgent';
  createdAt: string;
}

export default function NotificationsPage() {
  const user = useAuthStore((state) => state.user);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'announcement' | 'system'>('all');

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      try {
        setLoading(true);

        // Fetch published announcements from backend
        const res = await api
          .get<{ data: AnnouncementResponse[] }>('/announcements?publishedOnly=true')
          .catch(() => ({ data: { data: [] } }));

        const announcementData: AnnouncementResponse[] = res.data?.data || [];

        // Map announcements to notification items
        const announcementNotifications: NotificationItem[] = announcementData.map((item) => ({
          id: `ann-${item.id}`,
          title: item.title,
          message: item.content,
          type: 'announcement',
          priority: item.priority,
          createdAt: item.createdAt,
          isRead: false,
          actionUrl: '/social/announcements',
          actionLabel: 'Lihat Pengumuman',
        }));

        // System starter notifications based on user context
        const systemNotifications: NotificationItem[] = [
          {
            id: 'sys-welcome',
            title: 'Selamat datang di PayrollPro',
            message: `Halo ${user?.email?.split('@')[0] || 'Pengguna'}, akun Anda telah aktif dan siap digunakan.`,
            type: 'system',
            priority: 'normal',
            createdAt: new Date().toISOString(),
            isRead: false,
            actionUrl: '/dashboard',
            actionLabel: 'Buka Dashboard',
          },
          {
            id: 'sys-attendance',
            title: 'Pengingat Absensi Harian',
            message: 'Jangan lupa untuk melakukan check-in kehadiran kerja hari ini.',
            type: 'attendance',
            priority: 'normal',
            createdAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
            isRead: false,
            actionUrl: '/attendance/check-in',
            actionLabel: 'Check-In Sekarang',
          },
        ];

        // Load read status from localStorage if available
        let readIds: string[] = [];
        try {
          const stored = localStorage.getItem('payrollpro_read_notifs');
          if (stored) readIds = JSON.parse(stored);
        } catch {
          // Ignore localStorage errors
        }

        const combined = [...announcementNotifications, ...systemNotifications].map((item) => ({
          ...item,
          isRead: readIds.includes(item.id),
        }));

        if (active) {
          setNotifications(combined);
        }
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadNotifications();

    return () => {
      active = false;
    };
  }, [user]);

  const markAllAsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((item) => ({ ...item, isRead: true }));
      try {
        localStorage.setItem(
          'payrollpro_read_notifs',
          JSON.stringify(updated.map((item) => item.id))
        );
      } catch {
        // Ignore localStorage errors
      }
      return updated;
    });
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, isRead: true } : item
      );
      try {
        const readIds = updated.filter((item) => item.isRead).map((item) => item.id);
        localStorage.setItem('payrollpro_read_notifs', JSON.stringify(readIds));
      } catch {
        // Ignore localStorage errors
      }
      return updated;
    });
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (filter === 'unread') return !item.isRead;
      if (filter === 'announcement') return item.type === 'announcement';
      if (filter === 'system') return item.type !== 'announcement';
      return true;
    });
  }, [notifications, filter]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'announcement':
        return <Megaphone className="h-5 w-5 text-amber-500" />;
      case 'leave':
        return <CalendarDays className="h-5 w-5 text-blue-500" />;
      case 'payroll':
        return <Wallet className="h-5 w-5 text-emerald-500" />;
      case 'attendance':
        return <Clock className="h-5 w-5 text-purple-500" />;
      default:
        return <Bell className="h-5 w-5 text-blue-600" />;
    }
  };

  // Timestamp captured at mount so Date.now() is not called during render.
  const [nowMs] = useState(() => Date.now());

  const formatRelativeTime = (isoDate: string, now: number = nowMs) => {
    try {
      const date = new Date(isoDate);
      const diffMs = now - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) return 'Baru saja';
      if (diffMinutes < 60) return `${diffMinutes} menit yang lalu`;
      if (diffHours < 24) return `${diffHours} jam yang lalu`;
      if (diffDays === 1) return 'Kemarin';
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoDate;
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">Notifikasi</h1>
              {unreadCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                  {unreadCount} baru
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Pemberitahuan aktivitas, pengumuman perusahaan, dan sistem
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <CheckCheck className="h-4 w-4 text-blue-600" />
            Tandai semua dibaca
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
            filter === 'all'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Semua ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
            filter === 'unread'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Belum Dibaca ({unreadCount})
        </button>
        <button
          onClick={() => setFilter('announcement')}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
            filter === 'announcement'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Pengumuman
        </button>
        <button
          onClick={() => setFilter('system')}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
            filter === 'system'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Sistem
        </button>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="flex min-h-[250px] items-center justify-center rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <div className="text-center text-gray-500">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-sm">Memuat notifikasi...</p>
          </div>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-500">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">
            {filter === 'unread'
              ? 'Tidak ada notifikasi yang belum dibaca'
              : 'Belum ada notifikasi'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {filter === 'unread'
              ? 'Semua notifikasi sudah Anda baca.'
              : 'Pemberitahuan terbaru akan muncul di sini.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((item) => (
            <div
              key={item.id}
              className={`group relative flex flex-col gap-4 rounded-xl border p-4 transition hover:shadow-md sm:flex-row sm:items-start sm:justify-between ${
                item.isRead
                  ? 'border-gray-200 bg-white'
                  : 'border-blue-200 bg-blue-50/40'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white shadow-sm border border-gray-100">
                  {getIcon(item.type)}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {item.title}
                    </h4>
                    {item.priority === 'urgent' && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        Penting
                      </span>
                    )}
                    {!item.isRead && (
                      <span className="h-2 w-2 rounded-full bg-blue-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-line line-clamp-3">
                    {item.message}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatRelativeTime(item.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:self-center">
                {item.actionUrl && (
                  <Link
                    href={item.actionUrl}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition"
                  >
                    {item.actionLabel || 'Lihat'}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}

                {!item.isRead && (
                  <button
                    onClick={() => markAsRead(item.id)}
                    title="Tandai telah dibaca"
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                )}

                <button
                  onClick={() => deleteNotification(item.id)}
                  title="Hapus notifikasi"
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
