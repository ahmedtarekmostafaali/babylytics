'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';

export function StoolChart({ data }: { data: { day: string; stool_count: number | string; total_ml: number | string }[] }) {
  const rows = (data ?? []).map(d => ({
    day: d.day,
    stool_count: Number(d.stool_count),
    total_ml: Number(d.total_ml),
  }));
  if (rows.length === 0) return <Empty>No stool logs yet.</Empty>;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="day" tickFormatter={v => String(v).slice(5)} tick={{ fill: '#8A8A8A', fontSize: 11 }} />
          <YAxis yAxisId="left" allowDecimals={false} tick={{ fill: '#8A8A8A', fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" unit=" ml" tick={{ fill: '#8A8A8A', fontSize: 11 }} />
          <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="left"  dataKey="stool_count" name="count"    fill="#7FC8A9" radius={[6,6,0,0]} />
          <Bar yAxisId="right" dataKey="total_ml"    name="total ml" fill="#7BAEDC" radius={[6,6,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="h-64 grid place-items-center text-sm text-ink-muted">{children}</div>;
}
