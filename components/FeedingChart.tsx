'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend, CartesianGrid, Cell } from 'recharts';

export function FeedingChart({ data }: { data: { day: string; total_ml: number | string; recommended_ml: number | string }[] }) {
  const rows = (data ?? []).map(d => ({
    day: d.day,
    total_ml: Number(d.total_ml),
    recommended_ml: Number(d.recommended_ml),
  }));
  if (rows.length === 0) return <Empty>No feeding data yet.</Empty>;
  const recommended = rows[0]?.recommended_ml ?? 0;
  const max = Math.max(...rows.map(r => r.total_ml), 1);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 16, right: 12, left: 0, bottom: 8 }} barCategoryGap="22%">
          <defs>
            <linearGradient id="peachBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="#F6C177" stopOpacity={1} />
              <stop offset="100%" stopColor="#F6C177" stopOpacity={0.45} />
            </linearGradient>
            <linearGradient id="peachBarGradHot" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="#F4A6A6" stopOpacity={1} />
              <stop offset="100%" stopColor="#F6C177" stopOpacity={0.5} />
            </linearGradient>
            <filter id="barShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#000" floodOpacity="0.08" />
            </filter>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="#E5E7EB" />
          <XAxis dataKey="day" tickFormatter={v => String(v).slice(5)} tick={{ fill: '#8A8A8A', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis unit=" ml" tick={{ fill: '#8A8A8A', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: 'rgba(246,193,119,0.12)' }}
            contentStyle={{ borderRadius: 12, border: '1px solid #F6C177', boxShadow: '0 6px 20px rgba(15,23,42,0.08)', fontSize: 12, padding: 10 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
          <ReferenceLine y={recommended} stroke="#7BAEDC" strokeDasharray="4 4" strokeWidth={1.5}
            label={{ value: `recommended ${recommended} ml`, position: 'right', fill: '#5690C8', fontSize: 11 }} />
          <Bar dataKey="total_ml" name="actual (ml)" radius={[10, 10, 3, 3]} filter="url(#barShadow)">
            {rows.map((r, i) => (
              <Cell key={i} fill={r.total_ml / max > 0.9 ? 'url(#peachBarGradHot)' : 'url(#peachBarGrad)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="h-72 grid place-items-center text-sm text-ink-muted">{children}</div>;
}
