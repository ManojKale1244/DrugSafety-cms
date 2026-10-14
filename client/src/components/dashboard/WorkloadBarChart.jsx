import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';

export default function WorkloadBarChart({ data = [], isGlobalScope = true }) {
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs">
          <p className="font-semibold text-slate-900 mb-1.5 border-b border-slate-100 pb-1">
            {label}
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-blue-700 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-600" /> Active Cases:
              </span>
              <span className="font-bold font-mono text-slate-900">{payload[0]?.value || 0}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-red-700 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" /> Overdue Tasks:
              </span>
              <span className="font-bold font-mono text-slate-900">{payload[1]?.value || 0}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card p-5 h-full flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base">
            {isGlobalScope ? 'Team Workload & Overdue Allocation' : 'Your Assigned Workload Distribution'}
          </h3>
          <p className="text-xs text-slate-400">
            {isGlobalScope
              ? 'Active safety case reviews and overdue action items per processor'
              : 'Summary of active case investigations and task obligations'}
          </p>
        </div>
      </div>

      <div className="h-64 w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            No active assignment data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis
                type="number"
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }}
                width={120}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }}
              />
              <Bar
                dataKey="activeCases"
                name="Active Cases"
                fill="#3b82f6"
                radius={[0, 4, 4, 0]}
                barSize={14}
              />
              <Bar
                dataKey="overdueActions"
                name="Overdue Tasks"
                fill="#ef4444"
                radius={[0, 4, 4, 0]}
                barSize={14}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
