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
import { isActionLate, getActionDisplayStatus, isActionDone } from "@/components/qhse/actionUtils";
import { PROCESSUS } from "@/components/qhse/constants";
import AssigneMemberSelect from "./AssigneMemberSelect";
import { normalizePiece } from "@/components/qhse/fileUtils";

// Statuts sélectionnables à l'étape Traitement
const STATUTS_TRAITEMENT = ["À faire", "En cours", "En vérification", "Terminé"];

function InefficaceBadge() {
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
      Inefficace
    </span>
  );
}

// mode:
//   "investigation" → titre + suppression uniquement (pas de statut/responsable/échéance)
//   "traitement"    → édition responsable, échéance, statut + contrôles de réalisation
//   "readonly"     → tout en lecture seule
export default function ActionRow({ action, mode, isQHSE, isResponsableProcessus, isMyAction, isClosed, isEditable, isInefficace,
  onDelete, onMarkDone, onUploadJustif, onRemoveJustif, onSaveComment, onUpdateAction, membres, userEmail, userName, onAssign }) {
  const [comment, setComment] = useState(action.commentaireRealisation || "");
  const [showHistory, setShowHistory] = useState(false);
  const [realDate, setRealDate] = useState(action.dateRealisationEffective || "");
  const [submitting, setSubmitting] = useState(false);
  // Anti double-envoi : un seul clic pris en compte pendant le traitement asynchrone
  const handleMarkDoneClick = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onMarkDone(action, realDate);
    } finally {
      setSubmitting(false);
    }
  };
  const late = isActionLate(action);
  const done = isActionDone(action);

  const cardClass = isInefficace
    ? "border rounded-xl p-4 bg-red-50 border-red-200 opacity-80"
    : late
      ? "border rounded-xl p-4 bg-red-50 border-red-200"
      : "border rounded-xl p-4 bg-white border-slate-200";

  // === Investigation : titre + suppression uniquement ===
  if (mode === "investigation") {
    return (
      <div className={cardClass}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-slate-800 flex-1">{action.description}</p>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowHistory(s => !s)}
              className={`p-1.5 rounded-md transition-colors ${showHistory ? "text-slate-600 bg-slate-100" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
              title={showHistory ? "Masquer l'historique des statuts" : "Voir l'historique des statuts"}
            >
              <History className="w-3.5 h-3.5" />
            </button>
            {isQHSE && isEditable && !isClosed && !isInefficace && (
              <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600" onClick={() => onDelete(action.id)} title="Supprimer cette action">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
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

  // === Traitement / readonly ===
  // Mappe l'ancien "Réalisée" sur "Terminé" pour l'affichage du select
  const statutSelectValue = action.statut === "Réalisée" ? "Terminé" : (STATUTS_TRAITEMENT.includes(action.statut) ? action.statut : "À faire");

  const canPilot = isQHSE || isResponsableProcessus;
  const canEditMeta = canPilot && isEditable && !isClosed && !isInefficace;
  const canEditStatut = (canPilot || isMyAction) && isEditable && !isClosed && !isInefficace;
  const canRealize = (canPilot || isMyAction) && !done && isEditable && !isClosed && !isInefficace;

  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-slate-800">{action.description}</p>

          <div className="flex flex-wrap items-center gap-2">
            {isInefficace ? (
              <InefficaceBadge />
            ) : canEditStatut ? (
              <Select value={statutSelectValue} onValueChange={v => onUpdateAction(action, "statut", v)}>
                <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUTS_TRAITEMENT.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <StatusBadge statut={late ? "En retard" : getActionDisplayStatus(action)} type="action" />
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
              canEdit={canPilot && isEditable && !isClosed && !isInefficace}
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
          {isQHSE && isEditable && !isClosed && !isInefficace && (
            <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600" onClick={() => onDelete(action.id)} title="Supprimer cette action">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Contrôles de réalisation — uniquement en mode traitement, pour QHSE ou le responsable */}
      {mode === "traitement" && canRealize && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date réelle de réalisation</Label>
              <Input type="date" value={realDate} onChange={e => setRealDate(e.target.value)} className="mt-1 text-xs" />
              {realDate && action.dateFinPrevue && (
                new Date(realDate) > new Date(action.dateFinPrevue)
                  ? <p className="text-xs text-red-600 mt-1">⚠ Retard de {Math.ceil((new Date(realDate) - new Date(action.dateFinPrevue)) / 86400000)} jour(s)</p>
                  : <p className="text-xs text-green-600 mt-1">✓ Dans les délais</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Pièces justificatives</Label>
              <label className="mt-1 flex items-center gap-1 text-xs text-blue-600 cursor-pointer hover:underline h-9">
                <Upload className="w-3 h-3" /> Ajouter un fichier
                <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={e => onUploadJustif(action, e)} className="hidden" />
              </label>
              {action.piecesJustificatives?.length > 0 && (
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
          <Textarea placeholder="Commentaire de réalisation (optionnel)..." className="text-xs" rows={2} value={comment} onChange={e => setComment(e.target.value)} />
          <div className="flex items-center gap-2">
            {comment !== (action.commentaireRealisation || "") && (
              <Button size="sm" variant="outline" className="text-xs" onClick={() => onSaveComment(action, comment)}>Sauvegarder le commentaire</Button>
            )}
            <Button size="sm" className="bg-green-600 hover:bg-green-700 ml-auto" onClick={handleMarkDoneClick} disabled={!realDate || submitting}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />} {submitting ? "Envoi..." : "Marquer comme terminée"}
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