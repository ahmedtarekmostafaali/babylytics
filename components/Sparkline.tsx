'use client';

type Props = {
  data: number[];
  /** hex color for the line + gradient base */
  color?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
};

/**
 * Tiny inline SVG sparkline. Rendered with a soft gradient under the curve so
 * it feels alive, not clinical. Use inside KPI cards.
 */
export function Sparkline({
  data,
  color = '#7BAEDC',
  width = 120,
  height = 36,
  strokeWidth = 2,
}: Props) {
  if (!data || data.length === 0) {
    return <div style={{ width, height }} className="rounded-md bg-slate-100/70" />;
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const points = data.map((v, i) => {
    const x = pad + (i / Math.max(1, data.length - 1)) * w;
    const y = pad + h - ((v - min) / span) * h;
    return [x, y];
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const area = `${path} L${points[points.length - 1][0]},${height} L${points[0][0]},${height} Z`;
  const gradId = `sparkline-grad-${color.replace('#', '')}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area}   fill={`url(#${gradId})`} />
      <path d={path}   fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
