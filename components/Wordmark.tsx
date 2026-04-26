import { cn } from '@/lib/utils';

/**
 * Colorful brand wordmark. Each letter uses a different palette token so the
 * word feels playful without departing from the palette we already established.
 *
 * Sizes map to tailwind text sizes; the logo (if provided) scales with the text.
 */
export function Wordmark({
  size = 'md',
  showLogo = true,
  className,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLogo?: boolean;
  className?: string;
}) {
  const text = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-3xl',
    xl: 'text-5xl',
  }[size];

  const logoSize = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
    xl: 'h-14 w-14',
  }[size];

  // Letters coloured: b (brand blue), a (mint), b (peach), y (coral), l (lavender), y (brand), t (mint), i (peach), c (coral), s (lavender).
  const colors = [
    'text-brand-500',    // b
    'text-mint-500',     // a
    'text-peach-500',    // b
    'text-coral-500',    // y
    'text-lavender-500', // l
    'text-brand-500',    // y
    'text-mint-500',     // t
    'text-peach-500',    // i
    'text-coral-500',    // c
    'text-lavender-500', // s
  ];
  const letters = 'babylytics'.split('');

  // dir="ltr" is critical: the brand name is "babylytics" — never mirror it
  // even when the surrounding page is in RTL (Arabic, Hebrew, etc.).
  return (
    <span dir="ltr" className={cn('inline-flex items-center gap-2 font-extrabold tracking-tight', text, className)}>
      {showLogo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/Logo.png" alt="Babylytics" className={cn(logoSize, 'rounded-lg object-cover')} />
      )}
      <span className="flex items-baseline">
        {letters.map((l, i) => (
          <span key={i} className={colors[i]}>{l}</span>
        ))}
      </span>
    </span>
  );
}
