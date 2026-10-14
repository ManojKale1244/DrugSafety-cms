import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function StatusDonutChart({ data = [] }) {
  const total = data.reduce((acc, curr) => acc + curr.count, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : 0;
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="font-semibold text-slate-800">{item.label}</span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-4 font-mono">
            <span className="text-slate-500">Cases:</span>
            <span className="font-bold text-slate-900">{item.count}</span>
          </div>
          <div className="flex items-baseline justify-between gap-4 font-mono text-[11px] text-slate-400">
            <span>Share:</span>
            <span>{pct}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card p-5 flex flex-col justify-between h-full">
      <div className="mb-2">
        <h3 className="font-bold text-slate-900 text-base">Cases by Workflow Status</h3>
        <p className="text-xs text-slate-400">Current lifecycle distribution of reports</p>
      </div>

      <div className="relative h-56 w-full flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={62}
              outerRadius={88}
              paddingAngle={3}
              dataKey="count"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center Donut Label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-black text-slate-900 tracking-tight">{total}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Cases</span>
        </div>
      </div>

      {/* Custom Legend */}
      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
        {data.map((item) => (
          <div key={item.status} className="flex items-center justify-between text-xs py-0.5">
            <div className="flex items-center gap-1.5 truncate">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-slate-600 truncate">{item.label}</span>
            </div>
            <span className="font-bold text-slate-800 ml-1 font-mono text-[11px]">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
