import React from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { parseStoredDate } from "@/components/qhse/dateFormat";

export default function NCTimeline({ historique = [] }) {
  if (historique.length === 0) return null;

  return (
    <div className="space-y-0">
      {historique.map((event, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-2.5 h-2.5 bg-blue-500 rounded-full mt-1.5" />
            {i < historique.length - 1 && <div className="w-px flex-1 bg-slate-200" />}
          </div>
          <div className="pb-4">
            <p className="text-sm font-medium text-slate-800">{event.type}</p>
            {event.detail && <p className="text-xs text-slate-500 mt-0.5">{event.detail}</p>}
            <p className="text-xs text-slate-400 mt-0.5">
              {event.date ? format(parseStoredDate(event.date), "dd MMM yyyy HH:mm", { locale: fr }) : ""} — {event.auteur}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}