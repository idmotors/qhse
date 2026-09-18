import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Loader2 } from "lucide-react";
import { format } from "date-fns";
import FieldError from "@/components/qhse/FieldError";

/**
 * Ligne d'action immédiate : lecture + marquage « Réalisée » (avec date) par
 * le processus désigné responsable de l'action (ou QHSE). Ne modifie jamais
 * le statut ni l'étape de la NC parente.
 */
export default function ActionImmediateRow({ action, user, isQHSE, onMarkDone }) {
  const done = action.statut === "Réalisée";
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const late = !done && action.dateFinPrevue && action.dateFinPrevue < todayStr;
  const canMarkDone = !done && (isQHSE ||
    (action.responsableEmails || []).includes(user?.email) ||
    (action.responsablesProcessus || []).includes(user?.email));

  const [realDate, setRealDate] = useState(todayStr);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Anti double-envoi : un seul clic pris en compte pendant le traitement asynchrone
  const handleMarkDoneClick = async () => {
    if (submitting) return;
    if (!realDate) { setAttempted(true); return; }
    setSubmitting(true);
    try {
      await onMarkDone(action, realDate);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`border rounded-xl p-4 ${done ? "bg-green-50/40 border-green-200" : late ? "bg-red-50 border-red-200" : "bg-white border-slate-200"}`}>
      <p className="text-sm font-medium text-slate-800">{action.description}</p>
      <div className="flex flex-wrap items-center gap-2 mt-1.5">
        {done ? (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200">Réalisée</span>
        ) : late ? (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">En retard</span>
        ) : (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">À faire</span>
        )}
        <span className="text-xs text-slate-500">Responsable : {action.responsableNom || action.responsable || "—"}</span>
        {action.dateFinPrevue && <span className="text-xs text-slate-500">Échéance : {format(new Date(action.dateFinPrevue), "dd/MM/yyyy")}</span>}
        {action.declarePar && <span className="text-xs text-slate-400">Déclarée par : {action.declarePar}</span>}
        {action.dateRealisationEffective && <span className="text-xs text-green-600">Réalisée le : {format(new Date(action.dateRealisationEffective), "dd/MM/yyyy")}</span>}
      </div>

      {canMarkDone && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Date de réalisation <span className="text-red-500">*</span></Label>
            <Input type="date" value={realDate} onChange={e => setRealDate(e.target.value)} className="mt-1 h-8 text-xs w-[150px]" />
            <FieldError show={attempted && !realDate} message="Veuillez renseigner la date de réalisation." />
          </div>
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleMarkDoneClick} disabled={submitting}>
            {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
            {submitting ? "Envoi..." : "Marquer comme réalisée"}
          </Button>
        </div>
      )}
    </div>
  );
}