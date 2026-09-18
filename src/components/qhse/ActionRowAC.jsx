import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "./StatusBadge";
import { Trash2, Upload, Check, History, Loader2 } from "lucide-react";
import ActionHistory from "./ActionHistory";
import { format } from "date-fns";
import { isActionLateAC } from "@/components/qhse/acActionUtils";
import { PROCESSUS } from "@/components/qhse/constants";
import AssigneMemberSelect from "./AssigneMemberSelect";
import { normalizePiece } from "@/components/qhse/fileUtils";

// Statuts sélectionnables pour une action AC
const STATUTS_AC = ["En cours", "Réalisée", "En standby", "Abandonnée"];

export default function ActionRowAC({ action, isQHSE, userEmail, isClosed, isEditable, onDelete, onMarkDone, onUploadJustif, onRemoveJustif, onUpdateAction, membres, userName, onAssign }) {
  const [comment, setComment] = useState(action.commentaireRealisation || "");
  const [realDate, setRealDate] = useState(action.dateRealisationEffective || "");
  const [showHistory, setShowHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Anti double-envoi : un seul clic pris en compte pendant le traitement asynchrone
  const handleMarkDoneClick = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onMarkDone(action, realDate, comment);
    } finally {
      setSubmitting(false);
    }
  };
  const late = isActionLateAC(action);
  const done = action.statut === "Réalisée" || !!action.dateRealisationEffective;

  const isResponsableAction = (action.responsablesProcessus || []).includes(userEmail);
  const canPilot = isQHSE || isResponsableAction;
  const canEditMeta = canPilot && isEditable && !isClosed;
  const canEditStatut = canPilot && isEditable && !isClosed;
  const canRealize = canPilot && !done && isEditable && !isClosed;

  const hasJustif = (action.piecesJustificatives || []).length > 0;
  // Réalisation OBLIGATOIRE : date + commentaire + au moins une pièce justificative
  const canMarkDone = !!(realDate && comment.trim() && hasJustif);

  const cardClass = late
    ? "border rounded-xl p-4 bg-red-50 border-red-200"
    : done
      ? "border rounded-xl p-4 bg-green-50/40 border-green-200"
      : "border rounded-xl p-4 bg-white border-slate-200";

  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-slate-800">{action.description}</p>

          <div className="flex flex-wrap items-center gap-2">
            {canEditStatut ? (
              <Select value={action.statut} onValueChange={v => onUpdateAction(action, "statut", v)}>
                <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUTS_AC.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : late ? (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">En retard</span>
            ) : (
              <StatusBadge statut={action.statut} type="action-ac" />
            )}

            {canEditMeta ? (
              <>
                <Select value={action.responsable || ""} onValueChange={v => onUpdateAction(action, "responsable", v)}>
                  <SelectTrigger className="h-7 w-[180px] text-xs"><SelectValue placeholder="Responsable" /></SelectTrigger>
                  <SelectContent>
                    {PROCESSUS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={action.dateFinPrevue || ""}
                  onChange={e => onUpdateAction(action, "dateFinPrevue", e.target.value)}
                  className="h-7 w-[140px] text-xs"
                />
              </>
            ) : (
              <>
                <span className="text-xs text-slate-500">Responsable : {action.responsableNom || action.responsable || "—"}</span>
                {action.dateFinPrevue && (
                  <span className="text-xs text-slate-500">Échéance : {format(new Date(action.dateFinPrevue), "dd/MM/yyyy")}</span>
                )}
              </>
            )}

            <AssigneMemberSelect
              action={action}
              membres={membres}
              canEdit={canPilot && isEditable && !isClosed}
              userEmail={userEmail}
              userName={userName}
              onAssign={onAssign}
            />

            {action.dateRealisationEffective && (
              <span className="text-xs text-green-600">Réalisée le : {format(new Date(action.dateRealisationEffective), "dd/MM/yyyy")}</span>
            )}
            {action.dateFinPrevue && action.dateRealisationEffective && (
              new Date(action.dateRealisationEffective) > new Date(action.dateFinPrevue)
                ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">⚠ En retard</span>
                : <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Dans les délais</span>
            )}
          </div>

          {action.commentaireRealisation && (
            <p className="text-xs text-slate-500 italic">"{action.commentaireRealisation}"</p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowHistory(s => !s)}
            className={`p-1.5 rounded-md transition-colors ${showHistory ? "text-slate-600 bg-slate-100" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
            title={showHistory ? "Masquer l'historique des statuts" : "Voir l'historique des statuts"}
          >
            <History className="w-3.5 h-3.5" />
          </button>
          {isQHSE && isEditable && !isClosed && (
            <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600" onClick={() => onDelete(action.id)} title="Supprimer cette action">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Contrôles de réalisation — date, commentaire et pièce justificative OBLIGATOIRES */}
      {canRealize && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date réelle de réalisation <span className="text-red-500">*</span></Label>
              <Input type="date" value={realDate} onChange={e => setRealDate(e.target.value)} className="mt-1 text-xs" />
              {realDate && action.dateFinPrevue && (
                new Date(realDate) > new Date(action.dateFinPrevue)
                  ? <p className="text-xs text-red-600 mt-1">⚠ Retard de {Math.ceil((new Date(realDate) - new Date(action.dateFinPrevue)) / 86400000)} jour(s)</p>
                  : <p className="text-xs text-green-600 mt-1">✓ Dans les délais</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Pièces justificatives <span className="text-red-500">*</span></Label>
              <label className="mt-1 flex items-center gap-1 text-xs text-blue-600 cursor-pointer hover:underline h-9">
                <Upload className="w-3 h-3" /> Ajouter un fichier
                {hasJustif && <span className="text-green-600 font-medium">({action.piecesJustificatives.length} jointe(s))</span>}
                <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={e => onUploadJustif(action, e)} className="hidden" />
              </label>
              {hasJustif && (
                <div className="mt-1 flex gap-2 flex-wrap">
                  {action.piecesJustificatives.map((item, i) => {
                    const p = normalizePiece(item);
                    return (
                      <span key={i} className="flex items-center gap-1">
                        <a href={p.url} target="_blank" rel="noopener noreferrer" title={p.nom}
                          className="text-xs text-blue-600 hover:underline truncate max-w-[220px]">{p.nom}</a>
                        <button type="button" onClick={() => onRemoveJustif(action, i)}
                          className="text-red-400 hover:text-red-600 flex-shrink-0" title="Retirer cette pièce jointe">×</button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <Textarea placeholder="Commentaire de réalisation (obligatoire)..." className="text-xs" rows={2} value={comment} onChange={e => setComment(e.target.value)} />
          <div className="flex items-center gap-2">
            {!canMarkDone && (
              <p className="text-[11px] text-slate-400">Date, commentaire et pièce justificative obligatoires pour marquer l'action comme réalisée.</p>
            )}
            <Button size="sm" className="bg-green-600 hover:bg-green-700 ml-auto" onClick={handleMarkDoneClick} disabled={!canMarkDone || submitting}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />} {submitting ? "Envoi..." : "Marquer comme réalisée"}
            </Button>
          </div>
        </div>
      )}

      {/* Historique des statuts — consultation seule, dépliable */}
      {showHistory && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-700 mb-2">Historique des statuts</p>
          <ActionHistory historique={action.historique} />
        </div>
      )}
    </div>
  );
}