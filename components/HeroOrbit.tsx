import { Milk, Moon, Baby, Scale, Heart } from 'lucide-react';

/**
 * Circular hero graphic — the Logo.png in the center, five colour-coded
 * feature icons arranged around it on an invisible orbit. Pure SVG + divs,
 * no external images beyond the logo.
 */
export function HeroOrbit() {
  // Positions on the orbit, expressed as angles (0° = top, clockwise).
  const nodes = [
    { angle:   0, bg: 'bg-coral-100',    fg: 'text-coral-600',    Icon: Milk  },
    { angle:  72, bg: 'bg-peach-100',    fg: 'text-peach-600',    Icon: Baby  },
    { angle: 144, bg: 'bg-brand-100',    fg: 'text-brand-600',    Icon: Scale },
    { angle: 216, bg: 'bg-coral-100',    fg: 'text-coral-600',    Icon: Heart },
    { angle: 288, bg: 'bg-lavender-100', fg: 'text-lavender-600', Icon: Moon  },
  ];

  return (
    <div className="relative mx-auto h-[22rem] w-[22rem] sm:h-[26rem] sm:w-[26rem]">
      {/* Orbit ring */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="orbit-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#7BAEDC" stopOpacity="0.45" />
            <stop offset="50%"  stopColor="#7FC8A9" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#F4A6A6" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="38" fill="none" stroke="url(#orbit-grad)" strokeWidth="0.6" strokeDasharray="1 1.5" />
      </svg>

      {/* Centre logo */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-44 w-44 sm:h-52 sm:w-52 rounded-full bg-white shadow-panel grid place-items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Logo.png" alt="Babylytics" className="h-32 w-32 sm:h-36 sm:w-36 rounded-full object-cover" />
      </div>

      {/* Orbiting icons */}
      {nodes.map((n, i) => {
        const rad = (n.angle - 90) * (Math.PI / 180); // -90 so 0° is top
        const radius = 42; // % of container
        const x = 50 + radius * Math.cos(rad);
        const y = 50 + radius * Math.sin(rad);
        return (
          <div
            key={i}
            className={`absolute h-16 w-16 sm:h-20 sm:w-20 rounded-full shadow-card grid place-items-center ${n.bg}`}
            style={{
              left: `${x}%`,
              top:  `${y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <n.Icon className={`h-7 w-7 sm:h-9 sm:w-9 ${n.fg}`} />
          </div>
        );
      })}
    </div>
  );
}
