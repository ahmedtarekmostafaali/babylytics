'use client';

// PrintGuideButton — Wave 42C. Tiny client widget that triggers the
// browser's print dialog. The /guide page has print-specific styles
// (print-compact + .print:hidden chrome) so saving as PDF from the
// print dialog produces a clean, branded document.

import { Printer } from 'lucide-react';

export function PrintGuideButton({ lang = 'en' }: { lang?: 'en' | 'ar' }) {
  const isAr = lang === 'ar';
  return (
    <button type="button" onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 hover:bg-slate-50 text-sm text-ink font-semibold px-3 py-1.5">
      <Printer className="h-3.5 w-3.5" />
      {isAr ? 'حفظ PDF' : 'Save as PDF'}
    </button>
  );
}
