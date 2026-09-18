import React from "react";

export default function KPICard({ title, value, subtitle, icon: Icon, color = "blue" }) {
  const colors = {
    blue: "from-blue-500 to-blue-600",
    green: "from-green-500 to-green-600",
    orange: "from-orange-500 to-orange-600",
    red: "from-red-500 to-red-600",
    violet: "from-violet-500 to-violet-600",
    yellow: "from-yellow-500 to-yellow-600",
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 mb-1 truncate">{title}</p>
          <p className="text-3xl font-bold text-slate-900 tabular-nums">{value}</p>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-2 inline-block bg-slate-50 border border-slate-100 rounded-full px-2.5 py-0.5">{subtitle}</p>
          )}
        </div>
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center flex-shrink-0 shadow-sm`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}