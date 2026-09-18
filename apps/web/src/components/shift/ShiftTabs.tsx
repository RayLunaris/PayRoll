'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { label: 'Manajemen', href: '/shift' },
  { label: 'Kalender', href: '/shift/calendar' },
  { label: 'Penugasan', href: '/shift/assign' },
];

export default function ShiftTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={isActive ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary'}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}