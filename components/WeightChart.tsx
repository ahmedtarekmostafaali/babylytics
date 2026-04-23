'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';

export function WeightChart({ data }: { data: { measured_at: string; weight_kg: number | null }[] }) {
  const rows = (data ?? [])
    .filter(d => d.weight_kg != null)
    .map(d => ({
      t: new Date(d.measured_at).getTime(),
      label: format(new Date(d.measured_at), 'MMM d'),
      weight_kg: Number(d.weight_kg),
    }))
    .sort((a, b) => a.t - b.t);

  if (rows.length === 0) return <Empty>No weight measurements yet.</Empty>;

  // Fixed domain with 1-decimal padding — avoids floating-point tick labels.
  const values = rows.map(r => r.weight_kg);
  const min = Math.max(0, Math.floor((Math.min(...values) - 0.2) * 10) / 10);
  const max = Math.ceil((Math.max(...values) + 0.2) * 10) / 10;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="label" tick={{ fill: '#8A8A8A', fontSize: 11 }} />
          <YAxis
            domain={[min, max]}
            tickFormatter={v => `${Number(v).toFixed(2)} kg`}
            tick={{ fill: '#8A8A8A', fontSize: 11 }}
            width={72}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
            formatter={(v: number | string) => `${Number(v).toFixed(2)} kg`}
          />
          <Line type="monotone" dataKey="weight_kg" stroke="#7BAEDC" strokeWidth={2.5} dot={{ r: 3, fill: '#7BAEDC' }} activeDot={{ r: 5 }} name="weight (kg)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="h-64 grid place-items-center text-sm text-ink-muted">{children}</div>;
}
