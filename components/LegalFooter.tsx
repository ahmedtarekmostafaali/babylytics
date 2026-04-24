import Link from 'next/link';
import { AlertTriangle, Heart } from 'lucide-react';

/**
 * Compact footer with the medical disclaimer + links to privacy/terms.
 * Rendered once in the root layout so it shows on every page of the app.
 */
export function LegalFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white/80 backdrop-blur no-export print:hidden">
      {/* Medical disclaimer strip — always visible so users are reminded on every screen. */}
      <div className="bg-coral-50/70 border-b border-coral-100">
        <div className="max-w-6xl mx-auto px-4 py-2 text-[11px] text-coral-900 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-coral-600" />
          <span className="leading-tight">
            Babylytics is not a medical device. Information shown is for tracking only — always consult your pediatrician.{' '}
            <Link href="/disclaimer" className="underline font-semibold hover:text-coral-700">Read more</Link>.
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2 text-[11px] text-ink-muted">
        <div className="flex items-center gap-1.5">
          <Heart className="h-3 w-3 text-coral-400" />
          <span>© {year} Babylytics. Made with care.</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/privacy"    className="hover:text-ink">Privacy</Link>
          <span className="text-slate-300">·</span>
          <Link href="/terms"      className="hover:text-ink">Terms</Link>
          <span className="text-slate-300">·</span>
          <Link href="/disclaimer" className="hover:text-ink">Medical disclaimer</Link>
          <span className="text-slate-300">·</span>
          <a href="mailto:ahmedtarekmostafaali@gmail.com" className="hover:text-ink">Contact</a>
        </nav>
      </div>
    </footer>
  );
}
