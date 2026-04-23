'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';

export function WeightChart({ data }: { data: { measured_at: string; weight_kg: number | null }[] }) {
  const rows = (data ?? [])
    .filter(d => d.weight_kg != null)
    .map(d => ({ t: new Date(d.measured_at).getTime(), label: format(new Date(d.measured_at), 'MMM d'), weight_kg: Number(d.weight_kg) }));
  if (rows.length === 0) return <Empty>No weight measurements yet.</Empty>;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" />
          <YAxis unit=" kg" domain={['dataMin - 0.2', 'dataMax + 0.2']} />
          <Tooltip />
          <Line type="monotone" dataKey="weight_kg" stroke="#4f6df5" strokeWidth={2} dot={{ r: 3 }} name="weight (kg)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="h-64 grid place-items-center text-sm text-slate-500">{children}</div>;
}
