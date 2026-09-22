'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Megaphone, AlertCircle, ArrowRight, Calendar, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import type { Announcement } from '@/types';

function formatDate(dateStr?: string | Date): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function RecentAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        const res = await api.get<{ data: Announcement[] }>('/announcements?publishedOnly=true');
        if (active && Array.isArray(res.data?.data)) {
          // Take top 3 latest published announcements
          setAnnouncements(res.data.data.slice(0, 3));
        }
      } catch (err) {
        console.error('Failed to load announcements:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (!loading && announcements.length === 0) {
    return null; // Do not clutter top if no announcements exist
  }

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50/40 to-sky-50 border border-blue-100/80 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-600 text-white rounded-xl shadow-sm">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              Pengumuman Terbaru
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                <Sparkles className="h-3 w-3" /> Info Resmi
              </span>
            </h2>
            <p className="text-xs text-gray-500">
              Pemberitahuan dan pengumuman operasional penting untuk seluruh staf
            </p>
          </div>
        </div>

        <Link
          href="/social/announcements"
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors group"
        >
          Lihat semua pengumuman
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white/90 backdrop-blur rounded-xl p-4 border border-blue-100/60 shadow-xs animate-pulse space-y-2.5"
            >
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {announcements.map((item) => {
            const isUrgent = item.priority === 'urgent';
            return (
              <div
                key={item.id}
                className={`flex flex-col justify-between p-4 rounded-xl bg-white border transition-all hover:shadow-md ${
                  isUrgent
                    ? 'border-red-200 bg-red-50/30'
                    : 'border-blue-100/80 hover:border-blue-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-bold text-gray-900 line-clamp-1">
                      {item.title}
                    </h3>
                    {isUrgent && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 uppercase tracking-wider animate-pulse">
                        <AlertCircle className="h-3 w-3" />
                        Penting
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                    {item.content}
                  </p>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(item.publishedAt || item.createdAt)}
                  </span>
                  <Link
                    href="/social/announcements"
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Buka detail
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
