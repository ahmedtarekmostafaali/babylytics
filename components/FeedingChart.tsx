'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend, CartesianGrid } from 'recharts';

export function FeedingChart({ data }: { data: { day: string; total_ml: number | string; recommended_ml: number | string }[] }) {
  const rows = (data ?? []).map(d => ({
    day: d.day,
    total_ml: Number(d.total_ml),
    recommended_ml: Number(d.recommended_ml),
  }));
  if (rows.length === 0) return <Empty>No feeding data yet.</Empty>;
  const recommended = rows[0]?.recommended_ml ?? 0;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="day" tickFormatter={v => String(v).slice(5)} tick={{ fill: '#8A8A8A', fontSize: 11 }} />
          <YAxis unit=" ml" tick={{ fill: '#8A8A8A', fontSize: 11 }} />
          <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={recommended} stroke="#7BAEDC" strokeDasharray="4 4" label={{ value: 'recommended', position: 'right', fill: '#5690C8', fontSize: 11 }} />
          <Bar dataKey="total_ml" name="actual (ml)" fill="#F6C177" radius={[6,6,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="h-64 grid place-items-center text-sm text-ink-muted">{children}</div>;
}
