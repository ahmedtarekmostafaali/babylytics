'use client';

import { useState } from 'react';
import { Download, FileImage, FileText, Loader2, X, Share2, Check } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

/**
 * Capture the element matching the given selector and download it as either
 * a PDF or a PNG. Works on mobile (iOS/Android) because everything is done in
 * the browser — no `window.print()` dialog that mobile Safari mangles.
 *
 * PDF output: renders the capture as a single image onto one A4 page, scaled
 * to fit proportionally so the full report always lands on one page.
 * PNG output: saves the raw capture at 2× pixel density.
 *
 * The target element must opt in with an id (default: "report-capture") so
 * we know exactly what to serialize.
 */
export function ExportButton({
  target = 'report-capture',
  label,
  filenameHint,
}: {
  target?: string;
  label?: string;
  filenameHint?: string;
}) {
  const t = useT();
  const buttonLabel = label ?? t('exporter.default_label');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'pdf' | 'png' | 'share' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<'pdf' | 'png' | 'share' | null>(null);

  function filename(ext: 'pdf' | 'png') {
    const title = filenameHint
      || (typeof document !== 'undefined'
          ? document.querySelector('h1')?.textContent?.trim()
          : null)
      || t('exporter.default_filename');
    const safe = title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 80);
    const date = new Date().toISOString().slice(0, 10);
    return `${safe} — ${date}.${ext}`;
  }

  async function capture(): Promise<{ dataUrl: string; width: number; height: number } | null> {
    const el = document.getElementById(target);
    if (!el) { setErr(t('exporter.not_found', { target })); return null; }

    // Dynamic import keeps html-to-image out of the main bundle.
    const { toPng } = await import('html-to-image');
    const rect = el.getBoundingClientRect();
    const dataUrl = await toPng(el, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      width: Math.ceil(rect.width),
      height: Math.ceil(el.scrollHeight),
      style: {
        // Neutralize any ancestor transform that would confuse html-to-image
        transform: 'none',
        transformOrigin: 'top left',
      },
      filter: (node: HTMLElement) => {
        // Exclude nodes the author has marked as not-for-export (e.g. the
        // export button itself, navigation overlays).
        if (!node.classList) return true;
        if (node.classList.contains('no-export')) return false;
        return true;
      },
    });

    // We need the rendered bitmap dimensions to fit onto an A4 page. Reading
    // them back via an <img> is the simplest way.
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ dataUrl, width: img.width, height: img.height });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  async function asPng() {
    setErr(null); setBusy('png'); setDone(null);
    try {
      const cap = await capture();
      if (!cap) return;
      const a = document.createElement('a');
      a.href = cap.dataUrl;
      a.download = filename('png');
      document.body.appendChild(a);
      a.click();
      a.remove();
      setDone('png');
      setTimeout(() => { setOpen(false); setDone(null); }, 1200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('exporter.export_failed'));
    } finally {
      setBusy(null);
    }
  }

  async function asPdf() {
    setErr(null); setBusy('pdf'); setDone(null);
    try {
      const cap = await capture();
      if (!cap) return;
      const { jsPDF } = await import('jspdf');

      // A4 in millimeters: 210 × 297. Leave a small margin for print.
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;
      const aspect = cap.width / cap.height;
      let drawW = maxW;
      let drawH = drawW / aspect;
      if (drawH > maxH) {
        drawH = maxH;
        drawW = drawH * aspect;
      }
      const x = (pageW - drawW) / 2;
      const y = (pageH - drawH) / 2;
      pdf.addImage(cap.dataUrl, 'PNG', x, y, drawW, drawH, undefined, 'FAST');
      pdf.save(filename('pdf'));
      setDone('pdf');
      setTimeout(() => { setOpen(false); setDone(null); }, 1200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('exporter.export_failed'));
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setErr(null); setBusy('share'); setDone(null);
    try {
      const cap = await capture();
      if (!cap) return;
      const blob = await (await fetch(cap.dataUrl)).blob();
      const file = new File([blob], filename('png'), { type: 'image/png' });
      if (typeof navigator !== 'undefined' && 'share' in navigator && typeof (navigator as Navigator & { canShare?: (d: ShareData) => boolean }).canShare === 'function') {
        const canShare = (navigator as Navigator & { canShare: (d: ShareData) => boolean }).canShare({ files: [file] });
        if (canShare) {
          await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
            title: filename('png').replace(/\.png$/, ''),
            files: [file],
          });
          setDone('share');
          setTimeout(() => { setOpen(false); setDone(null); }, 1200);
          return;
        }
      }
      // Fallback: download the PNG, then let the user share from their gallery.
      await asPng();
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return; // user cancelled
      setErr(e instanceof Error ? e.message : t('exporter.share_failed'));
    } finally {
      setBusy(null);
    }
  }

  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  return (
    <div className="inline-flex items-center no-export">
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 shadow-sm">
        <Download className="h-4 w-4" /> {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4 no-export" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-panel p-6 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setOpen(false)}
              className="absolute top-3 right-3 h-8 w-8 grid place-items-center rounded-full hover:bg-slate-100"
              aria-label={t('exporter.close')}>
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-bold text-ink-strong">{t('exporter.title')}</h3>
            <p className="text-xs text-ink-muted mt-1">
              {t('exporter.intro')}
            </p>

            <div className="mt-5 grid gap-3">
              <ExportOption
                icon={FileText}
                title={t('exporter.pdf_h')}
                body={t('exporter.pdf_b')}
                disabled={busy !== null}
                busy={busy === 'pdf'}
                done={done === 'pdf'}
                onClick={asPdf}
                tint="brand" />

              <ExportOption
                icon={FileImage}
                title={t('exporter.img_h')}
                body={t('exporter.img_b')}
                disabled={busy !== null}
                busy={busy === 'png'}
                done={done === 'png'}
                onClick={asPng}
                tint="peach" />

              {isMobile && (
                <ExportOption
                  icon={Share2}
                  title={t('exporter.share_h')}
                  body={t('exporter.share_b')}
                  disabled={busy !== null}
                  busy={busy === 'share'}
                  done={done === 'share'}
                  onClick={share}
                  tint="mint" />
              )}
            </div>

            {err && <p className="mt-3 text-xs text-coral-600 font-medium">{err}</p>}

            <p className="mt-4 text-[11px] text-ink-muted">
              {t('exporter.privacy_tip')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ExportOption({
  icon: Icon, title, body, disabled, busy, done, onClick, tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  disabled: boolean;
  busy: boolean;
  done: boolean;
  onClick: () => void;
  tint: 'brand' | 'peach' | 'mint';
}) {
  const tintCss = {
    brand: 'bg-brand-100 text-brand-600',
    peach: 'bg-peach-100 text-peach-600',
    mint:  'bg-mint-100  text-mint-600',
  }[tint];
  const borderCss = done
    ? 'border-mint-400 ring-2 ring-mint-300'
    : busy
      ? 'border-brand-400 ring-2 ring-brand-200'
      : 'border-slate-200 hover:border-slate-300';
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`w-full flex items-center gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-60 ${borderCss}`}>
      <span className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${tintCss}`}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-ink-strong">{title}</span>
        <span className="block text-xs text-ink-muted">{body}</span>
      </span>
    </button>
  );
}
