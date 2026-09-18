import React from "react";
import { format } from "date-fns";
import { parseStoredDate } from "@/components/qhse/dateFormat";

// Liste chronologique (la plus récente en premier) des changements de statut d'une action corrective.
// Purement consultatif : aucune modification ni suppression possible depuis l'interface.
export default function ActionHistory({ historique }) {
  const entries = [...(historique || [])].sort((a, b) => parseStoredDate(b.date) - parseStoredDate(a.date));

  if (entries.length === 0) {
    return <p className="text-xs text-slate-400 italic">Aucun changement de statut enregistré pour cette action.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {entries.map((h, i) => (
        <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
          <span className="text-slate-400 tabular-nums">{format(parseStoredDate(h.date), "dd/MM/yyyy 'à' HH:mm")}</span>
          {h.type === "assignation" ? (
            <>
              <span className="italic text-slate-500">Assignation</span>
              <span className="text-slate-400">→</span>
              <span className="font-medium text-slate-800">{h.nouvelAssigne || "—"}</span>
              {h.ancienAssigne && <span className="text-slate-400">(avant : {h.ancienAssigne})</span>}
              <span className="text-slate-400">par {h.auteurNom || h.auteurEmail || "—"}</span>
            </>
          ) : (
            <>
              <span>{h.ancienStatut || "—"}</span>
              <span className="text-slate-400">→</span>
              <span className="font-medium text-slate-800">{h.nouveauStatut}</span>
              <span className="text-slate-400">par {h.auteurNom || h.auteurEmail || "—"}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}