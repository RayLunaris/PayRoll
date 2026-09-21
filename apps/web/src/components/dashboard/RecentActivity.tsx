'use client';

import { useEffect, useState } from 'react';
import { CalendarCheck, CalendarDays, Wallet, Activity as ActivityIcon } from 'lucide-react';
import api from '@/lib/api';

interface ActivityItem {
  id: string;
  type: 'attendance' | 'leave' | 'payroll' | string;
  title: string;
  description: string;
  createdAt: string;
  color: string;
}

const colorMap: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-600',
  blue: 'bg-blue-50 text-blue-600',
  yellow: 'bg-yellow-50 text-yellow-600',
};

function getActivityIcon(type: string) {
  switch (type) {
    case 'attendance':
      return <CalendarCheck className="h-4 w-4" />;
    case 'leave':
      return <CalendarDays className="h-4 w-4" />;
    case 'payroll':
      return <Wallet className="h-4 w-4" />;
    default:
      return <ActivityIcon className="h-4 w-4" />;
  }
}

function formatActivityDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
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
        const res = await api.get('/attendance/activities');
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
        <h3 className="text-lg font-semibold text-gray-900">
          Aktivitas Terbaru
        </h3>
        {loading && (
          <span className="text-xs text-gray-400 animate-pulse">Memuat...</span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3 py-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="h-8 w-8 bg-gray-200 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="py-8 flex flex-col items-center justify-center text-center">
          <ActivityIcon className="h-10 w-10 text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-600">Belum ada aktivitas terbaru</p>
          <p className="text-xs text-gray-400 mt-1">
            Riwayat presensi, pengajuan cuti, dan payroll akan otomatis tercatat di sini
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${colorMap[activity.color] ?? 'bg-gray-100 text-gray-600'}`}>
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                <p className="text-sm text-gray-500 truncate">{activity.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatActivityDate(activity.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
