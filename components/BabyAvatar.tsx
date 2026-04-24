import { cn } from '@/lib/utils';
import { Baby as BabyIcon } from 'lucide-react';

type Size = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const sizePx: Record<Size, { outer: string; inner: string; icon: string }> = {
  sm:  { outer: 'h-10 w-10',  inner: 'h-8 w-8',   icon: 'h-4 w-4'  },
  md:  { outer: 'h-14 w-14',  inner: 'h-12 w-12', icon: 'h-6 w-6'  },
  lg:  { outer: 'h-16 w-16',  inner: 'h-14 w-14', icon: 'h-7 w-7'  },
  xl:  { outer: 'h-20 w-20',  inner: 'h-16 w-16', icon: 'h-8 w-8'  },
  '2xl': { outer: 'h-24 w-24', inner: 'h-20 w-20', icon: 'h-10 w-10' },
};

/**
 * Renders a baby's avatar from a signed URL, falling back to the brand icon
 * inside a gradient circle if no url is provided. The outer white ring makes
 * it pop on any background.
 */
export function BabyAvatar({
  url,
  size = 'md',
  className,
}: {
  url: string | null | undefined;
  size?: Size;
  className?: string;
}) {
  const s = sizePx[size];
  return (
    <div className={cn('relative rounded-full bg-white shadow-card p-1 shrink-0', s.outer, className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className={cn('rounded-full object-cover', s.inner)} />
      ) : (
        <div className={cn('rounded-full bg-gradient-to-br from-brand-100 to-mint-100 grid place-items-center', s.inner)}>
          <BabyIcon className={cn('text-brand-600', s.icon)} />
        </div>
      )}
    </div>
  );
}
