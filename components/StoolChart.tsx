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
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="day" tickFormatter={v => String(v).slice(5)} />
          <YAxis yAxisId="left" allowDecimals={false} />
          <YAxis yAxisId="right" orientation="right" unit=" ml" />
          <Tooltip />
          <Legend />
          <Bar yAxisId="left"  dataKey="stool_count" name="count"    fill="#94a3b8" radius={[4,4,0,0]} />
          <Bar yAxisId="right" dataKey="total_ml"    name="total ml" fill="#4f6df5" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="h-64 grid place-items-center text-sm text-slate-500">{children}</div>;
}
