import Link from 'next/link';
import { Wordmark } from '@/components/Wordmark';
import { Milk, Moon, Baby, Heart, Scale } from 'lucide-react';

/**
 * Left-hand decorative panel on auth pages. Plays back the brand palette with
 * soft blobs + orbiting icons. Hidden on small screens.
 */
export function AuthSidePanel({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-coral-50">
      {/* soft colored blobs */}
      <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-coral-200/40 blur-3xl" />
      <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-mint-200/40 blur-3xl" />
      <div className="absolute top-1/3 right-1/4 h-48 w-48 rounded-full bg-lavender-200/30 blur-3xl" />

      <div className="relative flex flex-col justify-between p-10 w-full">
        <Link href="/"><Wordmark size="md" /></Link>

        {/* centerpiece: babylytics circle with orbiting icons */}
        <div className="flex-1 grid place-items-center">
          <div className="relative h-72 w-72">
            <div className="absolute inset-0 rounded-full bg-white shadow-panel" />
            <div className="absolute inset-6 rounded-full bg-gradient-to-br from-brand-100 to-mint-100 grid place-items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/Logo.png" alt="" className="h-36 w-36 rounded-full object-cover" />
            </div>
            {/* orbiting icons */}
            <Orbit className="top-0 left-1/2 -translate-x-1/2 -translate-y-4 bg-coral-100 text-coral-600">
              <Milk className="h-5 w-5" />
            </Orbit>
            <Orbit className="top-1/4 right-0 translate-x-2 bg-peach-100 text-peach-600">
              <Baby className="h-5 w-5" />
            </Orbit>
            <Orbit className="bottom-1/4 right-0 translate-x-4 bg-brand-100 text-brand-600">
              <Scale className="h-5 w-5" />
            </Orbit>
            <Orbit className="bottom-0 left-1/2 -translate-x-1/2 translate-y-4 bg-coral-100 text-coral-600">
              <Heart className="h-5 w-5" />
            </Orbit>
            <Orbit className="top-1/2 left-0 -translate-x-4 -translate-y-1/2 bg-lavender-100 text-lavender-600">
              <Moon className="h-5 w-5" />
            </Orbit>
          </div>
        </div>

        <div className="max-w-md">
          <h2 className="text-3xl font-bold tracking-tight text-ink-strong">{title}</h2>
          <p className="mt-2 text-ink">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function Orbit({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div className={`absolute h-12 w-12 rounded-full shadow-card grid place-items-center ${className}`}>
      {children}
    </div>
  );
}
