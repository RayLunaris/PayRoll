'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notification';
import {
  Bell,
  CheckCircle2,
  CalendarDays,
  Wallet,
  Megaphone,
  Clock,
  CheckCheck,
  Trash2,
  ArrowRight,
  MessageCircle,
  CreditCard,
  Sparkles,
} from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  referenceId?: string | null;
  actionUrl?: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const user = useAuthStore((state) => state.user);
  const fetchUnreadCounts = useNotificationStore((state) => state.fetchUnreadCounts);
  const clearUnreadNotifications = useNotificationStore((state) => state.clearUnreadNotifications);
  const decrementUnreadNotifications = useNotificationStore((state) => state.decrementUnreadNotifications);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'payroll' | 'message' | 'announcement'>('all');

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{ success: boolean; data: NotificationItem[] }>('/notifications?limit=50');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setNotifications(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load notifications from database:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      void loadNotifications();
      void fetchUnreadCounts();
    }
  }, [user, loadNotifications, fetchUnreadCounts]);

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      clearUnreadNotifications();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
      );
      decrementUnreadNotifications();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const deleteNotification = async (id: string, wasRead: boolean) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((item) => item.id !== id));
      if (!wasRead) {
        decrementUnreadNotifications();
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (filter === 'unread') return !item.isRead;
      if (filter === 'payroll') return item.type === 'payroll' || item.type === 'cash_advance';
      if (filter === 'message') return item.type === 'message';
      if (filter === 'announcement') return item.type === 'announcement';
      return true;
    });
  }, [notifications, filter]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'payroll':
        return <Wallet className="h-5 w-5 text-emerald-600" />;
      case 'cash_advance':
        return <CreditCard className="h-5 w-5 text-amber-600" />;
      case 'message':
        return <MessageCircle className="h-5 w-5 text-blue-600" />;
      case 'announcement':
        return <Megaphone className="h-5 w-5 text-purple-600" />;
      case 'leave':
        return <CalendarDays className="h-5 w-5 text-indigo-600" />;
      case 'attendance':
        return <Clock className="h-5 w-5 text-teal-600" />;
      default:
        return <Bell className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'payroll':
        return <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Payroll</span>;
      case 'cash_advance':
        return <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Kasbon</span>;
      case 'message':
        return <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Pesan</span>;
      case 'announcement':
        return <span className="rounded bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">Pengumuman</span>;
      case 'leave':
        return <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">Cuti</span>;
      case 'attendance':
        return <span className="rounded bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">Absensi</span>;
      default:
        return <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">Sistem</span>;
    }
  };

  const formatRelativeTime = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      const diffMs = Date.now() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      if (diffMinutes < 1) return 'Baru saja';
      if (diffMinutes < 60) return `${diffMinutes} menit yang lalu`;
      if (diffHours < 24) return `${diffHours} jam yang lalu (${timeStr})`;
      if (diffDays === 1) return `Kemarin, ${timeStr}`;
      if (diffDays < 7) return `${diffDays} hari yang lalu`;
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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
                  {unreadCount} belum dibaca
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Riwayat notifikasi payroll, persetujuan kasbon, pesan, dan pengumuman
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

      {/* Filter Tabs */}
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
          onClick={() => setFilter('payroll')}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
            filter === 'payroll'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Payroll & Kasbon
        </button>
        <button
          onClick={() => setFilter('message')}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
            filter === 'message'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Pesan
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
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="flex min-h-[250px] items-center justify-center rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <div className="text-center text-gray-500">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-sm">Memuat riwayat notifikasi...</p>
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
              : 'Pemberitahuan aktivitas payroll, kasbon, dan pesan akan tersimpan di sini.'}
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
                  : 'border-blue-200 bg-blue-50/40 shadow-sm'
              }`}
            >
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white shadow-sm border border-gray-100">
                  {getIcon(item.type)}
                </div>

                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {item.title}
                    </h4>
                    {getTypeBadge(item.type)}
                    {!item.isRead && (
                      <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" title="Belum dibaca" />
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

              <div className="flex items-center gap-2 sm:self-center flex-shrink-0">
                {item.actionUrl && (
                  <Link
                    href={item.actionUrl}
                    onClick={() => {
                      if (!item.isRead) void markAsRead(item.id);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-600 shadow-xs hover:bg-blue-50 hover:border-blue-300 transition"
                  >
                    Buka
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}

                {!item.isRead && (
                  <button
                    onClick={() => markAsRead(item.id)}
                    title="Tandai telah dibaca"
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                )}

                <button
                  onClick={() => deleteNotification(item.id, item.isRead)}
                  title="Hapus notifikasi"
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition"
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
