'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'mint' | 'peach' | 'lavender';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:   'bg-brand-500 text-white hover:bg-brand-600 disabled:bg-brand-500/50',
  secondary: 'bg-white border border-slate-300 text-ink hover:bg-slate-50',
  ghost:     'bg-transparent text-ink hover:bg-slate-100',
  danger:    'bg-coral-600 text-white hover:bg-coral-700',
  mint:      'bg-mint-500 text-white hover:bg-mint-600',
  peach:     'bg-peach-500 text-white hover:bg-peach-600',
  lavender:  'bg-lavender-500 text-white hover:bg-lavender-600',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm rounded-md',
  md: 'h-10 px-4 text-sm rounded-md',
  lg: 'h-12 px-5 text-base rounded-lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition disabled:opacity-60 disabled:cursor-not-allowed',
        variants[variant], sizes[size], className
      )}
      {...props}
    />
  )
);
Button.displayName = 'Button';
