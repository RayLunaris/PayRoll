'use client';

import { CalendarCheck, CalendarDays, Wallet } from 'lucide-react';

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  createdAt: string;
  icon: React.ReactNode;
  color: string;
}

const MOCK_ACTIVITIES: Activity[] = [
  {
    id: '1',
    type: 'attendance',
    title: 'Presensi masuk',
    description: 'Karyawan check-in di Kantor Pusat',
    createdAt: new Date().toISOString(),
    icon: <CalendarCheck className="h-4 w-4" />,
    color: 'green',
  },
  {
    id: '2',
    type: 'leave',
    title: 'Cuti disetujui',
    description: 'Cuti tahunan untuk 3 karyawan',
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    icon: <CalendarDays className="h-4 w-4" />,
    color: 'blue',
  },
  {
    id: '3',
    type: 'payroll',
    title: 'Payroll diproses',
    description: 'Payroll bulan sebelumnya selesai diproses',
    createdAt: new Date(Date.now() - 7_200_000).toISOString(),
    icon: <Wallet className="h-4 w-4" />,
    color: 'yellow',
  },
];

const colorMap: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-600',
  blue: 'bg-blue-50 text-blue-600',
  yellow: 'bg-yellow-50 text-yellow-600',
};

export default function RecentActivity() {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Aktivitas Terbaru
      </h3>
      <div className="space-y-4">
        {MOCK_ACTIVITIES.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${colorMap[activity.color] ?? ''}`}>
              {activity.icon}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{activity.title}</p>
              <p className="text-sm text-gray-500">{activity.description}</p>
              <p className="text-xs text-gray-400">
                {new Date(activity.createdAt).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
