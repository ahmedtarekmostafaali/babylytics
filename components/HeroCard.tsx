import { cn } from '@/lib/utils';

type Tint = 'brand' | 'mint' | 'coral' | 'peach' | 'lavender' | 'mixed';

const gradients: Record<Tint, string> = {
  brand:    'from-brand-50 via-white to-brand-50/50',
  mint:     'from-mint-50  via-white to-mint-50/50',
  coral:    'from-coral-50 via-white to-coral-50/50',
  peach:    'from-peach-50 via-white to-peach-50/50',
  lavender: 'from-lavender-50 via-white to-lavender-50/50',
  mixed:    'from-brand-50 via-white to-coral-50',
};

const blobs: Record<Tint, { a: string; b: string }> = {
  brand:    { a: 'bg-brand-200',    b: 'bg-mint-200' },
  mint:     { a: 'bg-mint-200',     b: 'bg-brand-200' },
  coral:    { a: 'bg-coral-200',    b: 'bg-peach-200' },
  peach:    { a: 'bg-peach-200',    b: 'bg-coral-200' },
  lavender: { a: 'bg-lavender-200', b: 'bg-brand-200' },
  mixed:    { a: 'bg-coral-200',    b: 'bg-mint-200' },
};

/**
 * Decorative hero card with gradient background + two blurred color blobs.
 * Use as a page header. Content goes inside — padding is handled by the card.
 */
export function HeroCard({
  tint = 'mixed',
  children,
  className,
}: {
  tint?: Tint;
  children: React.ReactNode;
  className?: string;
}) {
  const b = blobs[tint];
  return (
    <div className={cn(
      'relative overflow-hidden rounded-3xl border border-slate-200/70 shadow-card',
      'bg-gradient-to-br', gradients[tint],
      className,
    )}>
      <div className={cn('blob-top-right', b.a)} />
      <div className={cn('blob-bottom-left', b.b)} />
      <div className="relative p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}
