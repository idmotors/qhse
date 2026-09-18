import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

/**
 * Courbes « Évolution mensuelle » (12 derniers mois).
 */
export default function MonthlyLine({ data }) {
  if (data.every(d => d.Ouvertes === 0 && d.Clôturées === 0)) {
    return <p className="text-sm text-slate-400 italic py-10 text-center">Aucune NC sur les 12 derniers mois.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Line type="monotone" dataKey="Ouvertes" stroke="#f97316" strokeWidth={2.25} dot={false} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="Clôturées" stroke="#22c55e" strokeWidth={2.25} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}