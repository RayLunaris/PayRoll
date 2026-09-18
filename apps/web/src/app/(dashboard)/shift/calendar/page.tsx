'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import ShiftTabs from '@/components/shift/ShiftTabs';
import api from '@/lib/api';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface CalendarAssignment {
  id: string;
  employeeId: string;
  shiftId: string;
  date: string;
  shiftName: string;
  startTime: string;
  endTime: string;
}

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-green-100 text-green-800',
  'bg-amber-100 text-amber-800',
  'bg-purple-100 text-purple-800',
  'bg-rose-100 text-rose-800',
  'bg-cyan-100 text-cyan-800',
  'bg-indigo-100 text-indigo-800',
  'bg-emerald-100 text-emerald-800',
];

function formatTime(time: string): string {
  return time.length > 5 ? time.slice(0, 5) : time;
}

export default function ShiftCalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<CalendarAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const changeMonth = (delta: number) => {
    const current = new Date(year, month - 1 + delta, 1);
    setMonth(current.getMonth() + 1);
    setYear(current.getFullYear());
  };

  const resetToToday = () => {
    setMonth(today.getMonth() + 1);
    setYear(today.getFullYear());
  };

  const shiftColor = (shiftId: string) => {
    const index = shifts.findIndex((s) => s.id === shiftId);
    return COLORS[((index % COLORS.length) + COLORS.length) % COLORS.length];
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [shiftRes, calendarRes] = await Promise.all([
          api.get<{ data: Shift[] }>('/shifts'),
          api.get<{ data: CalendarAssignment[] }>(
            `/shifts/calendar?month=${month}&year=${year}`,
          ),
        ]);
        setShifts(shiftRes.data.data || []);
        setAssignments(calendarRes.data.data || []);
      } catch (error) {
        console.error('Failed to fetch calendar:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [year, month]);

  const firstDay = new Date(year, month - 1, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const cells: (number | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    const day = i - startOffset + 1;
    cells.push(day >= 1 && day <= daysInMonth ? day : null);
  }

  const todayStr = (() => {
    const d = new Date();
    const yy = d.getFullYear();
    const mm = `${d.getMonth() + 1}`.padStart(2, '0');
    const dd = `${d.getDate()}`.padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  })();

  const dateKey = (day: number) =>
    `${year}-${`${month}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`;

  const monthName = new Date(year, month - 1, 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div>
      <Breadcrumb />
      <ShiftTabs />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <CalendarDays className="h-6 w-6 text-blue-600" />
            Kalender Shift
          </h1>
          <p className="text-gray-500 mt-1">
            Lihat jadwal shift karyawan per bulan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="btn btn-sm btn-secondary"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-lg font-semibold text-gray-900 min-w-[150px] text-center">
            {monthName}
          </span>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="btn btn-sm btn-secondary"
            aria-label="Bulan berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={resetToToday}
            className="btn btn-sm btn-secondary"
          >
            Hari Ini
          </button>
        </div>
      </div>

      {/* Legend */}
      {shifts.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Legenda Shift</h3>
          <div className="flex flex-wrap gap-2">
            {shifts.map((shift) => (
              <span
                key={shift.id}
                className={`px-3 py-1 rounded-full text-xs font-medium ${shiftColor(shift.id)}`}
              >
                {shift.name} ({formatTime(shift.startTime)}-{formatTime(shift.endTime)})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="card">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 border-b border-gray-200">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="py-2 text-center text-sm font-semibold text-gray-500"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {cells.map((day, index) => {
                if (day === null) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="min-h-[108px] border-b border-r border-gray-100 bg-gray-50"
                    />
                  );
                }

                const key = dateKey(day);
                const dayAssignments = assignments.filter((a) => a.date === key);
                const isToday = key === todayStr;

                return (
                  <div
                    key={key}
                    className={`min-h-[108px] p-1.5 border-b border-r border-gray-100 ${
                      isToday ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-sm font-medium ${
                          isToday
                            ? 'rounded-full bg-blue-600 text-white h-6 w-6 flex items-center justify-center'
                            : 'text-gray-700'
                        }`}
                      >
                        {day}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {dayAssignments.map((a) => (
                        <div
                          key={a.id}
                          className={`px-1.5 py-0.5 rounded text-[11px] leading-tight ${shiftColor(a.shiftId)}`}
                          title={`${a.shiftName} (${formatTime(a.startTime)}-${formatTime(a.endTime)})`}
                        >
                          {a.shiftName}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}