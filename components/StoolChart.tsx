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
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 16, right: 12, left: 0, bottom: 8 }} barCategoryGap="22%" barGap={6}>
          <defs>
            <linearGradient id="mintBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="#7FC8A9" stopOpacity={1} />
              <stop offset="100%" stopColor="#7FC8A9" stopOpacity={0.45} />
            </linearGradient>
            <linearGradient id="brandBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="#7BAEDC" stopOpacity={1} />
              <stop offset="100%" stopColor="#7BAEDC" stopOpacity={0.45} />
            </linearGradient>
            <filter id="stoolBarShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#000" floodOpacity="0.08" />
            </filter>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="#E5E7EB" />
          <XAxis dataKey="day" tickFormatter={v => String(v).slice(5)} tick={{ fill: '#8A8A8A', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left"  allowDecimals={false} tick={{ fill: '#8A8A8A', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" unit=" ml" tick={{ fill: '#8A8A8A', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: 'rgba(127,200,169,0.12)' }}
            contentStyle={{ borderRadius: 12, border: '1px solid #7FC8A9', boxShadow: '0 6px 20px rgba(15,23,42,0.08)', fontSize: 12, padding: 10 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
          <Bar yAxisId="left"  dataKey="stool_count" name="count"    fill="url(#mintBarGrad)"  radius={[10, 10, 3, 3]} filter="url(#stoolBarShadow)" />
          <Bar yAxisId="right" dataKey="total_ml"    name="total ml" fill="url(#brandBarGrad)" radius={[10, 10, 3, 3]} filter="url(#stoolBarShadow)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="h-72 grid place-items-center text-sm text-ink-muted">{children}</div>;
}
