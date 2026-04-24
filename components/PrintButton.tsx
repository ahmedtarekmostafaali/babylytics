'use client';

import { Printer } from 'lucide-react';

export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
      title="Print this report"
    >
      <Printer className="h-4 w-4" />
      {label}
    </button>
  );
}
