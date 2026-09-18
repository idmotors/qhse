import React from "react";

/**
 * Carte blanche réutilisable pour les graphiques et sections du tableau de bord.
 * Présentation uniquement — aucune logique métier.
 */
export default function ChartCard({ title, subtitle, icon: Icon, children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow ${className}`}>
      <div className="flex items-center gap-2.5 mb-5">
        {Icon && (
          <span className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-slate-500" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 truncate">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}