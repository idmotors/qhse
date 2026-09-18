import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const truncate = (s, n = 16) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Barres « Répartition par source ».
 * Libellés de l'axe X tronqués pour éviter tout chevauchement.
 */
export default function SourceBar({ data }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-400 italic py-10 text-center">Aucune donnée</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} tickFormatter={v => truncate(v)} angle={-25} textAnchor="end" height={64} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}