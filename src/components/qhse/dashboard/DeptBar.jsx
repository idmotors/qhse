import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const truncate = (s, n = 20) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Barres horizontales « Répartition par département ».
 * Axe Y élargi + libellés tronqués pour éviter les coupures et chevauchements.
 */
export default function DeptBar({ data }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-400 italic py-10 text-center">Aucune donnée</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 15, left: 5, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} tickFormatter={v => truncate(v)} />
        <Tooltip />
        <Bar dataKey="value" fill="#8b5cf6" radius={[0, 6, 6, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}