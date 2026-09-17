'use client';

const colorStyles = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
  green: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600' },
  red: { bg: 'bg-red-50', text: 'text-red-600' },
} as const;

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: keyof typeof colorStyles;
  subtitle?: string;
}

export default function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  const style = colorStyles[color];

  return (
    <div className="bg-white rounded-xl shadow-card p-6 hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className={`mt-1 text-sm ${style.text}`}>{subtitle}</p>
          )}
        </div>
        <div className={`${style.bg} ${style.text} p-3 rounded-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
