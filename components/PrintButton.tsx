'use client';

import { useState } from 'react';
import { Download, Printer, X } from 'lucide-react';

/**
 * Triggers the browser's print dialog with settings pre-hinted for "Save as PDF".
 * Chrome/Edge/Safari all surface "Save as PDF" in the destination dropdown.
 * A one-time help hint shown on first click explains how to disable browser
 * headers/footers and switch destination to PDF.
 */
export function PrintButton({ label = 'Save as PDF' }: { label?: string }) {
  const [showHelp, setShowHelp] = useState(false);

  function handleClick() {
    // Update the document title for a cleaner default filename.
    const prevTitle = document.title;
    const name = document.querySelector('h1')?.textContent?.trim() || 'Babylytics report';
    document.title = `${name.slice(0, 60)}.pdf`;
    // Short timeout so the title change flushes before the print dialog reads it.
    setTimeout(() => {
      window.print();
      setTimeout(() => { document.title = prevTitle; }, 200);
    }, 50);
  }

  return (
    <>
      <div className="inline-flex items-center gap-1">
        <button
          onClick={handleClick}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 shadow-sm"
          title="Open print dialog → choose 'Save as PDF'"
        >
          <Download className="h-4 w-4" />
          {label}
        </button>
        <button
          onClick={() => setShowHelp(true)}
          aria-label="How to save as PDF"
          className="h-9 w-9 grid place-items-center rounded-full text-ink-muted hover:text-ink hover:bg-slate-100"
          title="How to save as PDF"
        >
          <Printer className="h-4 w-4" />
        </button>
      </div>

      {showHelp && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShowHelp(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-panel p-6 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowHelp(false)} className="absolute top-3 right-3 h-8 w-8 grid place-items-center rounded-full hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-semibold text-ink-strong">Save as PDF — quick tips</h3>
            <ol className="mt-3 space-y-2 text-sm text-ink list-decimal list-inside">
              <li>Click <strong>Save as PDF</strong>.</li>
              <li>
                In the print dialog, set <strong>Destination</strong> →
                <span className="inline-block ml-1 px-1.5 py-0.5 rounded bg-slate-100 text-ink-strong">Save as PDF</span>.
              </li>
              <li>
                Click <strong>More settings</strong>, then uncheck
                <span className="inline-block ml-1 px-1.5 py-0.5 rounded bg-slate-100 text-ink-strong">Headers and footers</span>
                to remove the URL / date printed by the browser.
              </li>
              <li>
                Make sure <strong>Background graphics</strong> is <em>checked</em> — otherwise the colored tiles print as plain grey.
              </li>
              <li>Click <strong>Save</strong>.</li>
            </ol>
            <button onClick={() => setShowHelp(false)}
              className="mt-5 w-full rounded-full bg-brand-500 hover:bg-brand-600 text-white font-medium py-2">
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
