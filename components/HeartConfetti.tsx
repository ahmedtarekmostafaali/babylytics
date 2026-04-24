/**
 * Fixed full-viewport decorative layer of scattered hearts in brand colors.
 * Pointer-events disabled. Behind everything but above the body gradient.
 * Renders 18 hearts at stable positions (seeded) so layout doesn't shift.
 */

const HEARTS: { x: number; y: number; size: number; rot: number; color: string; opacity: number }[] = [
  { x:  4, y:  8, size: 22, rot: -15, color: '#F4A6A6', opacity: 0.18 }, // coral
  { x: 18, y: 24, size: 14, rot:  20, color: '#B9A7D8', opacity: 0.14 }, // lavender
  { x: 32, y: 11, size: 18, rot:  -5, color: '#F6C177', opacity: 0.16 }, // peach
  { x: 72, y:  6, size: 16, rot:  10, color: '#7FC8A9', opacity: 0.16 }, // mint
  { x: 88, y: 15, size: 24, rot: -12, color: '#7BAEDC', opacity: 0.18 }, // brand
  { x: 93, y: 37, size: 16, rot:   8, color: '#F4A6A6', opacity: 0.14 },
  { x: 78, y: 52, size: 20, rot:  25, color: '#B9A7D8', opacity: 0.16 },
  { x: 60, y: 70, size: 18, rot: -18, color: '#F6C177', opacity: 0.15 },
  { x: 40, y: 84, size: 16, rot:  12, color: '#7FC8A9', opacity: 0.14 },
  { x: 10, y: 78, size: 22, rot:  -8, color: '#7BAEDC', opacity: 0.15 },
  { x:  6, y: 56, size: 14, rot:  15, color: '#F4A6A6', opacity: 0.13 },
  { x: 24, y: 46, size: 20, rot: -22, color: '#F6C177', opacity: 0.15 },
  { x: 50, y: 32, size: 14, rot:   4, color: '#B9A7D8', opacity: 0.13 },
  { x: 66, y: 20, size: 20, rot: -10, color: '#7BAEDC', opacity: 0.14 },
  { x: 84, y: 72, size: 24, rot:  18, color: '#7FC8A9', opacity: 0.15 },
  { x: 22, y: 92, size: 18, rot:  -6, color: '#F4A6A6', opacity: 0.13 },
  { x: 54, y: 54, size: 14, rot:  14, color: '#F6C177', opacity: 0.13 },
  { x: 70, y: 90, size: 18, rot: -20, color: '#B9A7D8', opacity: 0.14 },
];

export function HeartConfetti() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {HEARTS.map((h, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          width={h.size}
          height={h.size}
          style={{
            position: 'absolute',
            left: `${h.x}%`,
            top:  `${h.y}%`,
            transform: `rotate(${h.rot}deg)`,
            opacity: h.opacity,
            color: h.color,
          }}
        >
          <path
            fill="currentColor"
            d="M12 21s-7.5-4.63-10-9.5C.29 7.9 2.5 4 6.5 4c2.05 0 3.5.96 4.5 2.5C12 4.96 13.45 4 15.5 4 19.5 4 21.71 7.9 22 11.5 19.5 16.37 12 21 12 21z"
          />
        </svg>
      ))}
    </div>
  );
}
