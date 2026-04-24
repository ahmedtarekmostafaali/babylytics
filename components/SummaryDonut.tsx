import { cn } from '@/lib/utils';

type Segment = {
  label: string;
  value: number;
  color: string; // hex
};

/**
 * Small centred donut with legend on the right. Pure SVG.
 */
export function SummaryDonut({
  centerLabel,
  centerValue,
  segments,
  size = 140,
  strokeWidth = 14,
  className,
}: {
  centerLabel?: string;
  centerValue: React.ReactNode;
  segments: Segment[];
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;

  // Build each arc segment as stroke-dasharray + offset
  let cumulative = 0;
  const arcs = segments.map((seg, i) => {
    const fraction = total > 0 ? Math.max(0, seg.value) / total : 0;
    const length = fraction * c;
    const dashOffset = -cumulative;
    cumulative += length;
    return { key: i, color: seg.color, length, dashOffset };
  });

  return (
    <div className={cn('flex items-center gap-5', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          {/* track */}
          <circle cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="#EEF2F7" strokeWidth={strokeWidth} />
          {/* segments */}
          {total > 0 && arcs.map(a => (
            <circle key={a.key}
              cx={size / 2} cy={size / 2} r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${a.length} ${c}`}
              strokeDashoffset={a.dashOffset}
            />
          ))}
        </svg>
        {/* center label */}
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            {centerLabel && <div className="text-[10px] uppercase tracking-wider text-ink-muted">{centerLabel}</div>}
            <div className="text-xl font-bold text-ink-strong leading-tight">{centerValue}</div>
          </div>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-ink">{s.label}</span>
            </span>
            <span className="font-semibold text-ink-strong">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
