import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export const CHART_COLORS = ["#3b82f6", "#8b5cf6", "#f97316", "#ef4444", "#eab308", "#22c55e"];

const colorOf = (i) => CHART_COLORS[i % CHART_COLORS.length];

/**
 * Donut « Répartition par statut ».
 * Aucun libellé posé sur les parts (source des chevauchements) :
 * les valeurs sont lisibles via le tooltip et la légende personnalisée.
 */
export default function StatutDonut({ data }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-400 italic py-10 text-center">Aucune donnée</p>;
  }
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={58} outerRadius={88} dataKey="value" paddingAngle={2} stroke="none">
            {data.map((_, i) => <Cell key={i} fill={colorOf(i)} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 pt-3 border-t border-slate-50 flex flex-wrap gap-x-4 gap-y-2">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colorOf(i) }} />
            <span className="font-semibold text-slate-800 tabular-nums">{d.value}</span>
            <span className="truncate">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}