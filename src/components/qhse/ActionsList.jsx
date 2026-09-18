import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ActionRow from "./ActionRow";
import { Plus } from "lucide-react";
import { isActionDone } from "@/components/qhse/actionUtils";
import { useQuery } from "@tanstack/react-query";
import { notifyProcessus, getProcessusList, getMembresEmails } from "@/components/qhse/processusUtils";
import { logJournal } from "@/components/qhse/journalUtils";
import { PROCESSUS } from "@/components/qhse/constants";
import FieldError from "@/components/qhse/FieldError";

// Props :
//   mode : "investigation" | "traitement"
//   inefficaceActionIds : tableau d'IDs d'actions jugées inefficaces (règle 5)
export default function ActionsList({ ncId, ncNumero, ncTitre, ncInitiateurEmail, actions, onRefresh, isQHSE, isResponsableProcessus, ncResponsablesProcessus, isEditable, userEmail, user, ncStatut, mode = "investigation", inefficaceActionIds = [] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newAction, setNewAction] = useState({ description: "", responsable: "", dateFinPrevue: "" });
  // Erreurs rouges : visibles uniquement après une tentative d'ajout
  const [addAttempted, setAddAttempted] = useState(false);

  // Membres d'équipe sous-assignables : membres du processus responsable de chaque action
  const { data: processusList = [] } = useQuery({ queryKey: ["processus-list"], queryFn: getProcessusList });
  const { data: users = [] } = useQuery({ queryKey: ["users-list"], queryFn: () => base44.entities.User.list().catch(() => []) });
  const nameByEmail = {};
  (users || []).forEach(u => { if (u.email) nameByEmail[u.email] = u.full_name || u.email; });
  const membresFor = (a) => (getMembresEmails(processusList, a.responsable) || []).map(email => ({ email, nom: nameByEmail[email] || email }));

  // Actions dont l'échéance est dans ≤ 3 jours et non terminées (visible QHSE en traitement)
  const upcomingDeadlines = actions.filter(a => {
    if (isActionDone(a) || !a.dateFinPrevue) return false;
    const diff = Math.ceil((new Date(a.dateFinPrevue) - new Date()) / 86400000);
    return diff <= 3;
  });

  const handleAdd = async () => {
    if (mode === "investigation") {
      // À l'investigation : titre uniquement
      await base44.entities.Action.create({
        ncId,
        initiateurEmail: ncInitiateurEmail,
        responsablesProcessus: ncResponsablesProcessus,
        description: newAction.description,
        statut: "À faire",
      });
    } else {
      // Au traitement : titre + responsable + échéance
      await base44.entities.Action.create({
        ncId,
        initiateurEmail: ncInitiateurEmail,
        responsablesProcessus: ncResponsablesProcessus,
        description: newAction.description,
        responsable: newAction.responsable,
        responsableNom: newAction.responsable,
        dateFinPrevue: newAction.dateFinPrevue,
        statut: "À faire",
      });
    }
    logJournal({ user, type: "Action corrective", element: ncNumero || ncId, details: `Action ajoutée : ${newAction.description}` });
    setNewAction({ description: "", responsable: "", dateFinPrevue: "" });
    setShowAdd(false);
    onRefresh();
  };

  const handleDelete = async (actionId) => {
    const action = actions.find(a => a.id === actionId);
    await base44.entities.Action.delete(actionId);
    logJournal({ user, type: "Action corrective", element: ncNumero || ncId, details: `Action supprimée : ${action?.description || ""}` });
    onRefresh();
  };

  // Sous-assignation d'une action à un membre de l'équipe du processus responsable (ou retrait)
  const handleAssign = async (action, member) => {
    const newEmail = member?.email || "";
    const update = {
      assigneEmail: newEmail,
      assigneNom: member?.nom || "",
      dateAssignation: newEmail ? new Date().toISOString().split("T")[0] : null,
      historique: [
        ...(action.historique || []),
        { date: new Date().toISOString(), type: "assignation", ancienAssigne: action.assigneEmail || "", nouvelAssigne: newEmail, auteurEmail: user?.email || "", auteurNom: user?.full_name || user?.email || "—" },
      ],
    };
    await base44.entities.Action.update(action.id, update);
    logJournal({ user, type: "Action corrective", element: ncNumero || ncId, details: newEmail ? `Action sous-assignée à ${member?.nom || newEmail}` : "Sous-assignation retirée" });
    // Notification au membre assigné uniquement — aucun message en cas d'auto-assignation
    if (newEmail && newEmail !== user?.email) {
      notifyProcessus({
        nc: { id: ncId, numero: ncNumero, titre: ncTitre },
        event: "action_sub_assigned",
        action: { ...action, assigneEmail: newEmail, assigneNom: member?.nom || "" },
        auteur: { email: user?.email, nom: user?.full_name || user?.email },
      }).catch(e => console.warn("[ActionsList] Échec de la notification 'action_sub_assigned'", { action: action.description, err: String(e?.message || e) }));
    }
    onRefresh();
  };

  const handleMarkDone = async (action, realDate) => {
    // Garde anti double-envoi : si l'action est déjà terminée en base (donnée la plus récente), ne rien refaire ni notifier
    const fresh = await base44.entities.Action.get(action.id).catch(() => null);
    if (fresh && (fresh.statut === "Terminé" || fresh.statut === "Réalisée")) return;
    await base44.entities.Action.update(action.id, {
      statut: "Terminé",
      dateRealisationEffective: realDate || new Date().toISOString().split("T")[0],
      historique: [
        ...(action.historique || []),
        { date: new Date().toISOString(), ancienStatut: action.statut, nouveauStatut: "Terminé", auteurEmail: user?.email || "", auteurNom: user?.full_name || user?.email || "—" },
      ],
    });
    logJournal({ user, type: "Action corrective", element: ncNumero || ncId, details: `Action terminée : ${action.description}` });
    // Action sous-assignée terminée : informer les pilotes du processus (hors membre assigné)
    if (action.assigneEmail) {
      notifyProcessus({
        nc: { id: ncId, numero: ncNumero, titre: ncTitre },
        event: "team_actions_done",
        action: { ...action, dateRealisationEffective: realDate || new Date().toISOString().split("T")[0], auteurNom: user?.full_name || user?.email || "—" },
      }).catch(e => console.warn("[ActionsList] Échec de la notification 'team_actions_done'", { action: action.description, err: String(e?.message || e) }));
    }
    base44.entities.Notification.create({
      destinataire: "qhse-broadcast",
      type: "Changement statut",
      titre: `Action terminée`,
      message: `L'action "${action.description}" a été marquée comme terminée.`,
      lu: false, lienType: "nc", lienId: action.ncId,
    }).catch(e => console.warn("[ActionsList] Échec de la notification in-app (action terminée)", { action: action.description, err: String(e?.message || e) }));
    // Règle d : toutes les actions actives terminées → notifier HSE (prête pour vérification d'efficacité)
    const active = actions.filter(a => !inefficaceActionIds.includes(a.id));
    const allDone = active.length > 0 && active.every(a => a.id === action.id || isActionDone(a));
    if (allDone) {
      notifyProcessus({ nc: { id: ncId, numero: ncNumero, titre: ncTitre }, event: "all_actions_done" }).catch(e => console.warn("[ActionsList] Échec de la notification 'all_actions_done'", { ncId, err: String(e?.message || e) }));
    }
    onRefresh();
  };

  const handleSaveComment = async (action, commentaire) => {
    await base44.entities.Action.update(action.id, { commentaireRealisation: commentaire });
    onRefresh();
  };

  const handleUploadJustif = async (action, e) => {
    const files = Array.from(e.target.files);
    const urls = [...(action.piecesJustificatives || [])];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push({ url: file_url, nom: file.name });
    }
    await base44.entities.Action.update(action.id, { piecesJustificatives: urls });
    onRefresh();
  };

  const handleRemoveJustif = async (action, index) => {
    const urls = (action.piecesJustificatives || []).filter((_, i) => i !== index);
    await base44.entities.Action.update(action.id, { piecesJustificatives: urls });
    onRefresh();
  };

  // Mise à jour d'un champ de l'action (responsable, échéance, statut) depuis l'étape Traitement
  const handleUpdateAction = async (action, field, value) => {
    const update = { [field]: value };
    if (field === "responsable") update.responsableNom = value;
    // Échéance modifiée : réinitialiser le rappel préventif (un nouveau rappel partira pour la nouvelle date)
    if (field === "dateFinPrevue" && value !== action.dateFinPrevue) update.rappelPreventifNotifie = false;
    if (field === "statut" && value === "Terminé" && !action.dateRealisationEffective) {
      update.dateRealisationEffective = new Date().toISOString().split("T")[0];
    }
    if (field === "statut" && value !== action.statut) {
      update.historique = [
        ...(action.historique || []),
        { date: new Date().toISOString(), ancienStatut: action.statut, nouveauStatut: value, auteurEmail: user?.email || "", auteurNom: user?.full_name || user?.email || "—" },
      ];
    }
    await base44.entities.Action.update(action.id, update);
    logJournal({ user, type: "Action corrective", element: ncNumero || ncId, details: `Action modifiée : ${action.description} (${field})` });
    if (field === "statut" && value === "Terminé") {
      if (value !== action.statut && action.assigneEmail) {
        notifyProcessus({
          nc: { id: ncId, numero: ncNumero, titre: ncTitre },
          event: "team_actions_done",
          action: { ...action, statut: value, auteurNom: user?.full_name || user?.email || "—" },
        }).catch(e => console.warn("[ActionsList] Échec de la notification 'team_actions_done'", { action: action.description, err: String(e?.message || e) }));
      }
      const active = actions.filter(a => !inefficaceActionIds.includes(a.id));
      const allDone = active.length > 0 && active.every(a => a.id === action.id || isActionDone(a));
      if (allDone) {
        notifyProcessus({ nc: { id: ncId, numero: ncNumero, titre: ncTitre }, event: "all_actions_done" }).catch(e => console.warn("[ActionsList] Échec de la notification 'all_actions_done'", { ncId, err: String(e?.message || e) }));
      }
    }
    onRefresh();
  };

  const isClosed = ncStatut === "Clôturée";
  const canAdd = (isQHSE || isResponsableProcessus) && isEditable && !isClosed;
  const addEnabled = mode === "investigation"
    ? !!newAction.description.trim()
    : !!newAction.description.trim() && !!newAction.responsable && !!newAction.dateFinPrevue;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Actions correctives</h3>
        {canAdd && (
          <Button size="sm" variant="outline" onClick={() => { setAddAttempted(false); setShowAdd(true); }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter une action
          </Button>
        )}
      </div>

      {/* Alerte échéances proches — visible pour QHSE en traitement */}
      {isQHSE && mode === "traitement" && upcomingDeadlines.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-orange-700 flex items-center gap-1.5">
            ⏰ {upcomingDeadlines.length} action{upcomingDeadlines.length > 1 ? "s" : ""} avec échéance proche ou dépassée
          </p>
          <div className="space-y-1.5">
            {upcomingDeadlines.map(a => {
              const diff = Math.ceil((new Date(a.dateFinPrevue) - new Date()) / 86400000);
              const label = diff <= 0 ? "Échéance dépassée" : diff === 1 ? "Demain" : `J-${diff}`;
              return (
                <div key={a.id} className="flex items-center justify-between gap-2 text-xs text-orange-800">
                  <span className="truncate flex-1">{a.description} — <span className="font-medium">{a.responsableNom || a.responsable}</span></span>
                  <span className={`flex-shrink-0 font-semibold px-1.5 py-0.5 rounded ${diff <= 0 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>{label}</span>
                  <button
                    onClick={() => notifyProcessus({ nc: { id: ncId, numero: ncNumero, titre: ncTitre }, event: "action_late", action: a }).catch(e => console.warn("[ActionsList] Échec de la notification 'action_late'", { ncId, err: String(e?.message || e) }))}
                    className="flex-shrink-0 text-orange-600 hover:text-orange-800 underline text-[11px]"
                    title="Relancer les responsables de l'action (copie QHSE)"
                  >
                    Relancer
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div>
            <Label className="text-xs">Titre de l'action <span className="text-red-500">*</span></Label>
            <Input value={newAction.description} onChange={e => setNewAction({ ...newAction, description: e.target.value })} placeholder="Titre de l'action" className="mt-1" />
            <FieldError show={addAttempted && !newAction.description.trim()} message="Veuillez saisir le titre de l'action." />
          </div>
          {mode === "traitement" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Responsable <span className="text-red-500">*</span></Label>
                <Select value={newAction.responsable} onValueChange={v => setNewAction({ ...newAction, responsable: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {PROCESSUS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError show={addAttempted && !newAction.responsable} message="Veuillez sélectionner le processus responsable." />
              </div>
              <div>
                <Label className="text-xs">Date d'échéance <span className="text-red-500">*</span></Label>
                <Input type="date" value={newAction.dateFinPrevue} onChange={e => setNewAction({ ...newAction, dateFinPrevue: e.target.value })} className="mt-1" />
                <FieldError show={addAttempted && !newAction.dateFinPrevue} message="Veuillez renseigner la date d'échéance." />
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { if (!addEnabled) { setAddAttempted(true); return; } handleAdd(); }} className="bg-blue-600 hover:bg-blue-700">Ajouter</Button>
            <Button size="sm" variant="outline" onClick={() => { setAddAttempted(false); setShowAdd(false); }}>Annuler</Button>
          </div>
        </div>
      )}

      {actions.length === 0 ? (
        <p className="text-sm text-slate-400 italic">Aucune action définie</p>
      ) : (
        <div className="space-y-3">
          {actions.map(action => {
            const isInefficace = inefficaceActionIds.includes(action.id);
            const effectiveMode = isInefficace ? "readonly" : mode;
            return (
              <ActionRow
                key={action.id}
                action={action}
                mode={effectiveMode}
                isQHSE={isQHSE}
                isResponsableProcessus={isResponsableProcessus}
                isMyAction={action.responsable === userEmail}
                isClosed={isClosed}
                isEditable={isEditable}
                isInefficace={isInefficace}
                onDelete={handleDelete}
                onMarkDone={handleMarkDone}
                onUploadJustif={handleUploadJustif}
                onRemoveJustif={handleRemoveJustif}
                onSaveComment={handleSaveComment}
                onUpdateAction={handleUpdateAction}
                membres={membresFor(action)}
                userEmail={userEmail}
                userName={user?.full_name || user?.email}
                onAssign={handleAssign}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}