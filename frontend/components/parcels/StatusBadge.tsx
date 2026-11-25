import React from 'react';

const STATUS_STYLES: Record<string, string> = {
  Expected: 'bg-slate-100 text-slate-700 border-slate-200',
  'Received at hub': 'bg-blue-50 text-blue-700 border-blue-200',
  Scanned: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Verified: 'bg-sky-50 text-sky-700 border-sky-200',
  Stored: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  'Ready for delivery': 'bg-teal-50 text-teal-800 border-teal-200',
  'Delivery scheduled': 'bg-violet-50 text-violet-700 border-violet-200',
  'Out for delivery': 'bg-amber-50 text-amber-800 border-amber-200',
  Delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Delivery attempted': 'bg-orange-50 text-orange-800 border-orange-200',
  Returned: 'bg-rose-50 text-rose-700 border-rose-200',
  Cancelled: 'bg-zinc-100 text-zinc-600 border-zinc-200',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}
