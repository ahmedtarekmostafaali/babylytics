'use client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';

export function WeightChart({ data }: { data: { measured_at: string; weight_kg: number | null }[] }) {
  const rows = (data ?? [])
    .filter(d => d.weight_kg != null)
    .map(d => ({
      label: format(new Date(d.measured_at), 'MMM d'),
      weight_kg: Number(d.weight_kg),
    }));
  if (rows.length === 0) return <Empty>No weight measurements yet.</Empty>;

  const values = rows.map(r => r.weight_kg);
  const min = Math.max(0, Math.floor((Math.min(...values) - 0.2) * 10) / 10);
  const max = Math.ceil((Math.max(...values) + 0.2) * 10) / 10;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <AreaChart data={rows} margin={{ top: 16, right: 12, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="weightArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#7BAEDC" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#7BAEDC" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="#E5E7EB" />
          <XAxis dataKey="label" tick={{ fill: '#8A8A8A', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            domain={[min, max]}
            tickFormatter={v => `${Number(v).toFixed(2)} kg`}
            tick={{ fill: '#8A8A8A', fontSize: 11 }}
            axisLine={false} tickLine={false} width={80}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #7BAEDC', boxShadow: '0 6px 20px rgba(15,23,42,0.08)', fontSize: 12, padding: 10 }}
            formatter={(v: number | string) => `${Number(v).toFixed(2)} kg`}
            cursor={{ stroke: '#7BAEDC', strokeWidth: 1, strokeDasharray: '3 3' }}
          />
          <Area type="monotone" dataKey="weight_kg" stroke="#5690C8" strokeWidth={3}
                fill="url(#weightArea)"
                dot={{ r: 4, fill: '#7BAEDC', stroke: 'white', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#5690C8', stroke: 'white', strokeWidth: 2 }}
                name="weight (kg)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="h-72 grid place-items-center text-sm text-ink-muted">{children}</div>;
}
