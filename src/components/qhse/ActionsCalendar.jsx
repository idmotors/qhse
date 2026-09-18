import React, { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { isActionDone } from "@/components/qhse/actionUtils";

const STATUS_COLORS = {
  "À faire": "bg-slate-200 text-slate-700",
  "En cours": "bg-blue-100 text-blue-800",
  "En vérification": "bg-violet-100 text-violet-800",
  "Terminé": "bg-green-100 text-green-800",
  "Réalisée": "bg-green-100 text-green-800",
  "En retard": "bg-red-100 text-red-800",
};

export default function ActionsCalendar({ actions, ncs }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Regrouper les actions par date de fin prévue
  const actionsByDate = useMemo(() => {
    const map = {};
    actions.forEach(action => {
      if (!action.dateFinPrevue) return;
      const key = action.dateFinPrevue.slice(0, 10); // YYYY-MM-DD
      if (!map[key]) map[key] = [];
      map[key].push(action);
    });
    return map;
  }, [actions]);

  // Trouver le nom de la NC parente
  const ncMap = useMemo(() => {
    const m = {};
    ncs.forEach(nc => { m[nc.id] = nc; });
    return m;
  }, [ncs]);

  // Générer les jours à afficher (grille 6x7)
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    const days = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const [selectedDay, setSelectedDay] = useState(null);
  const selectedKey = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
  const selectedActions = selectedKey ? (actionsByDate[selectedKey] || []) : [];

  const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Calendrier des actions — Dates de fin prévues
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 rounded-lg hover:bg-slate-100">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-sm font-medium text-slate-700 w-32 text-center capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: fr })}
          </span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 rounded-lg hover:bg-slate-100">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Grille calendrier */}
      <div>
        {/* En-têtes jours */}
        <div className="grid grid-cols-7 mb-1">
          {weekDays.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
          ))}
        </div>

        {/* Jours */}
        <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-xl overflow-hidden">
          {calendarDays.map((day, i) => {
            const key = format(day, "yyyy-MM-dd");
            const dayActions = actionsByDate[key] || [];
            const inMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const todayDay = isToday(day);

            return (
              <div
                key={i}
                onClick={() => setSelectedDay(isSameDay(day, selectedDay) ? null : day)}
                className={`bg-white min-h-[72px] p-1.5 cursor-pointer transition-colors
                  ${!inMonth ? "opacity-30" : ""}
                  ${isSelected ? "ring-2 ring-inset ring-blue-400 bg-blue-50" : "hover:bg-slate-50"}
                `}
              >
                <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full
                  ${todayDay ? "bg-blue-600 text-white" : "text-slate-600"}
                `}>
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5">
                  {dayActions.slice(0, 2).map((action, j) => {
                    const isLate = !isActionDone(action) && new Date(action.dateFinPrevue) < new Date(new Date().toDateString());
                    const colorClass = isLate ? "bg-red-100 text-red-700" : STATUS_COLORS[action.statut] || "bg-slate-100 text-slate-600";
                    return (
                      <div key={j} className={`text-[10px] font-medium px-1 py-0.5 rounded truncate ${colorClass}`}>
                        {action.responsableNom || action.responsable?.split("@")[0]}
                      </div>
                    );
                  })}
                  {dayActions.length > 2 && (
                    <div className="text-[10px] text-slate-400 px-1">+{dayActions.length - 2} autres</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        {[["À faire", "bg-slate-200"], ["En cours", "bg-blue-100"], ["En vérification", "bg-violet-100"], ["Terminé", "bg-green-100"], ["En retard", "bg-red-100"]].map(([label, cls]) => (
          <div key={label} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded ${cls}`} />
            {label}
          </div>
        ))}
      </div>

      {/* Détail du jour sélectionné */}
      {selectedDay && (
        <div className="border-t border-slate-100 pt-4 space-y-2">
          <h4 className="text-sm font-semibold text-slate-800">
            {format(selectedDay, "EEEE d MMMM yyyy", { locale: fr })} — {selectedActions.length} action{selectedActions.length !== 1 ? "s" : ""}
          </h4>
          {selectedActions.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Aucune action prévue ce jour.</p>
          ) : (
            <div className="space-y-2">
              {selectedActions.map(action => {
                const nc = ncMap[action.ncId];
                const isLate = !isActionDone(action) && new Date(action.dateFinPrevue) < new Date(new Date().toDateString());
                return (
                  <div key={action.id} className={`rounded-xl p-3 border text-sm ${isLate ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-100"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-800">{action.description}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${isLate ? "bg-red-100 text-red-700" : STATUS_COLORS[action.statut] || "bg-slate-100"}`}>
                        {isLate ? "En retard" : action.statut}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>👤 {action.responsableNom || action.responsable}</span>
                      {nc && (
                        <Link to={`/NCDetail?id=${nc.id}`} className="text-blue-600 hover:underline">
                          🔗 {nc.numero}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}