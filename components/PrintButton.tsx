'use client';

import { useEffect, useState } from 'react';
import { Download, Printer, X, Share2 } from 'lucide-react';

/**
 * Save-as-PDF button that works on desktop AND mobile.
 *
 *  - Desktop:   window.print() → destination "Save as PDF"
 *  - Android:   window.print() → native print sheet has "Save as PDF"
 *  - iOS:       prefers window.print(); if that fails offers "Share sheet"
 *               which users can use to "Save to Files" as PDF via the
 *               built-in print preview
 *
 * A help modal explains how to disable browser headers/footers and keep
 * background graphics on.
 */
export function PrintButton({ label = 'Save as PDF' }: { label?: string }) {
  const [showHelp, setShowHelp] = useState(false);
  const [ua, setUa] = useState<{ iOS: boolean; Android: boolean } | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const a = navigator.userAgent;
    setUa({
      iOS: /iPad|iPhone|iPod/.test(a) && !(window as { MSStream?: unknown }).MSStream,
      Android: /Android/.test(a),
    });
  }, []);

  async function handleClick() {
    // Use the heading as the default PDF filename.
    const prevTitle = document.title;
    const name = document.querySelector('h1')?.textContent?.trim() || 'Babylytics report';
    document.title = name.slice(0, 80);

    try {
      if (ua?.iOS) {
        // iOS Safari: window.print() renders a print preview with a Share icon
        // that lets the user save as PDF to Files. If print is blocked
        // (Safari in standalone PWA mode sometimes), fall back to share.
        try { window.print(); }
        catch {
          if (typeof navigator !== 'undefined' && 'share' in navigator) {
            // Share just the URL; user can "Open in Safari" → share → PDF
            await (navigator as Navigator & { share: (x: ShareData) => Promise<void> })
              .share({ title: name, url: window.location.href });
          }
        }
      } else {
        window.print();
      }
    } finally {
      setTimeout(() => { document.title = prevTitle; }, 500);
    }
  }

  async function handleShare() {
    if (typeof navigator === 'undefined') return;
    if ('share' in navigator) {
      const name = document.querySelector('h1')?.textContent?.trim() || 'Babylytics report';
      try {
        await (navigator as Navigator & { share: (x: ShareData) => Promise<void> }).share({
          title: name,
          text: `${name} — open this link on a desktop browser to save as a one-page PDF.`,
          url: window.location.href,
        });
      } catch { /* user cancelled */ }
    } else {
      setShowHelp(true);
    }
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
        {/* Mobile share button for iOS/Android */}
        {ua && (ua.iOS || ua.Android) && (
          <button
            onClick={handleShare}
            aria-label="Share"
            className="h-9 w-9 grid place-items-center rounded-full bg-white border border-slate-200 text-ink hover:bg-slate-50"
            title="Share link"
          >
            <Share2 className="h-4 w-4" />
          </button>
        )}
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
            <h3 className="text-lg font-semibold text-ink-strong">Save as PDF</h3>

            <div className="mt-3 space-y-4 text-sm text-ink">
              <div>
                <div className="font-semibold">On desktop (Chrome / Edge / Safari)</div>
                <ol className="mt-1 space-y-1 list-decimal list-inside text-ink-muted">
                  <li>Tap <strong>Save as PDF</strong>.</li>
                  <li>Set <strong>Destination</strong> → <em>Save as PDF</em>.</li>
                  <li>Open <strong>More settings</strong>, uncheck <em>Headers and footers</em>.</li>
                  <li>Keep <em>Background graphics</em> checked.</li>
                  <li>Click <strong>Save</strong>.</li>
                </ol>
              </div>

              <div>
                <div className="font-semibold">On iPhone / iPad (Safari)</div>
                <ol className="mt-1 space-y-1 list-decimal list-inside text-ink-muted">
                  <li>Tap <strong>Save as PDF</strong>.</li>
                  <li>In the print preview, <strong>pinch out</strong> the thumbnail.</li>
                  <li>Tap the <strong>Share</strong> icon → <em>Save to Files</em>.</li>
                </ol>
                <p className="mt-2 text-xs text-ink-muted">
                  If nothing happens, use the <Share2 className="inline h-3 w-3" /> share button and open the link on a desktop browser.
                </p>
              </div>

              <div>
                <div className="font-semibold">On Android (Chrome)</div>
                <ol className="mt-1 space-y-1 list-decimal list-inside text-ink-muted">
                  <li>Tap <strong>Save as PDF</strong>.</li>
                  <li>Destination → <em>Save as PDF</em>.</li>
                  <li>Open <strong>More settings</strong>, turn off <em>Headers and footers</em>, keep <em>Background graphics</em> on.</li>
                  <li>Tap the download icon.</li>
                </ol>
              </div>
            </div>

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
