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
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="day" tickFormatter={v => String(v).slice(5)} />
          <YAxis unit=" ml" />
          <Tooltip />
          <Legend />
          <ReferenceLine y={recommended} stroke="#4f6df5" strokeDasharray="4 4" label={{ value: 'recommended', position: 'right' }} />
          <Bar dataKey="total_ml" name="actual (ml)" fill="#94a3b8" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="h-64 grid place-items-center text-sm text-slate-500">{children}</div>;
}
