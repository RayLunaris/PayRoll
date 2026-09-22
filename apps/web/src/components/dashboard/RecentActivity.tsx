'use client';

import { useEffect, useState } from 'react';
import {
  LogIn,
  LogOut,
  CalendarCheck,
  XCircle,
  Activity as ActivityIcon,
  Clock,
} from 'lucide-react';
import api from '@/lib/api';
import type { ActivityItem } from '@/types';

function getActivityConfig(type: string) {
  switch (type) {
    case 'attendance_check_in':
      return {
        icon: LogIn,
        color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      };
    case 'attendance_check_out':
      return {
        icon: LogOut,
        color: 'bg-blue-50 text-blue-600 border-blue-100',
      };
    case 'leave_approved':
      return {
        icon: CalendarCheck,
        color: 'bg-purple-50 text-purple-600 border-purple-100',
      };
    case 'leave_rejected':
      return {
        icon: XCircle,
        color: 'bg-red-50 text-red-600 border-red-100',
      };
    default:
      return {
        icon: ActivityIcon,
        color: 'bg-gray-50 text-gray-600 border-gray-100',
      };
  }
}

function formatActivityDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const timePart = d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (isToday) {
      return `Hari ini, ${timePart} WIB`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return `Kemarin, ${timePart} WIB`;
    }

    return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}, ${timePart} WIB`;
  } catch {
    return dateString;
  }
}

export default function RecentActivity() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        setLoading(true);
        // Call API Gateway aggregated endpoint
        const res = await api.get('/dashboard/recent-activity');
        if (active && Array.isArray(res.data?.data)) {
          setActivities(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load recent activities:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Aktivitas Terbaru
          </h3>
          <p className="text-xs text-gray-500">
            Log presensi & perizinan terkini
          </p>
        </div>
        {loading && (
          <span className="text-xs text-gray-400 animate-pulse flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Memuat...
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3 py-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse p-2.5 rounded-xl bg-gray-50/50">
              <div className="h-9 w-9 bg-gray-200 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5 py-0.5">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-4/5" />
              </div>
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
            <ActivityIcon className="h-6 w-6 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-700">Belum ada aktivitas terbaru</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">
            Presensi masuk/pulang serta persetujuan cuti yang diproses akan tercatat di sini secara otomatis
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => {
            const config = getActivityConfig(activity.type);
            const Icon = config.icon;

            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50/80 transition-colors border border-transparent hover:border-gray-100"
              >
                <div className={`p-2 rounded-xl border flex-shrink-0 ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {activity.title}
                    </p>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">
                      {formatActivityDate(activity.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                    {activity.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
