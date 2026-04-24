import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Lightweight page header shared by list pages and form wrappers. Accepts an
 * optional back link and a right-side action slot.
 */
export function PageHeader({
  backHref,
  backLabel,
  title,
  subtitle,
  right,
  eyebrow,
  eyebrowTint = 'brand',
}: {
  backHref?: string;
  backLabel?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  eyebrow?: string;
  eyebrowTint?: 'brand' | 'mint' | 'coral' | 'peach' | 'lavender';
}) {
  const eyebrowColor = {
    brand: 'text-brand-600',
    mint: 'text-mint-600',
    coral: 'text-coral-600',
    peach: 'text-peach-600',
    lavender: 'text-lavender-600',
  }[eyebrowTint];

  return (
    <div className="flex items-end justify-between flex-wrap gap-4">
      <div>
        {backHref && (
          <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink-strong">
            <ChevronLeft className="h-4 w-4" />
            {backLabel ?? 'back'}
          </Link>
        )}
        {eyebrow && (
          <div className={cn('mt-2 text-[11px] font-semibold uppercase tracking-wider', eyebrowColor)}>
            {eyebrow}
          </div>
        )}
        <h1 className="mt-0.5 text-2xl sm:text-3xl font-bold tracking-tight text-ink-strong">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

/**
 * Standard page scaffold — provides max-width, padding, and a HeroCard-style
 * wrapper. Use in nearly every app page.
 */
export function PageShell({
  children,
  className,
  max = '3xl',
}: {
  children: React.ReactNode;
  className?: string;
  max?: '3xl' | '4xl' | '5xl' | '6xl';
}) {
  const maxCls = { '3xl': 'max-w-3xl', '4xl': 'max-w-4xl', '5xl': 'max-w-5xl', '6xl': 'max-w-6xl' }[max];
  return (
    <div className={cn('mx-auto px-4 lg:px-8 py-6 space-y-5', maxCls, className)}>
      {children}
    </div>
  );
}
