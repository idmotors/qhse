import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ActionRowAC from "./ActionRowAC";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { notifyAC } from "@/components/qhse/notifyAC";
import { logJournal } from "@/components/qhse/journalUtils";
import { getProcessusList, getResponsablesEmails, getMembresEmails } from "@/components/qhse/processusUtils";
import { PROCESSUS } from "@/components/qhse/constants";
import FieldError from "@/components/qhse/FieldError";

const emptyAction = { description: "", responsable: "", dateFinPrevue: "" };

export default function ActionsListAC({ acId, acNumero, acInitiateurEmail, acStatut, actions, onRefresh, isQHSE, isResponsableProcessus, isEditable, user, userEmail }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newAction, setNewAction] = useState(emptyAction);
  // Erreurs rouges : visibles uniquement après une tentative d'ajout
  const [addAttempted, setAddAttempted] = useState(false);

  // Membres d'équipe sous-assignables : membres du processus responsable de chaque action
  const { data: processusList = [] } = useQuery({ queryKey: ["processus-list"], queryFn: getProcessusList });
  const { data: users = [] } = useQuery({ queryKey: ["users-list"], queryFn: () => base44.entities.User.list().catch(() => []) });
  const nameByEmail = {};
  (users || []).forEach(u => { if (u.email) nameByEmail[u.email] = u.full_name || u.email; });
  const membresFor = (a) => (getMembresEmails(processusList, a.responsable) || []).map(email => ({ email, nom: nameByEmail[email] || email }));

  const isClosed = ["Clôturée", "Abandonnée"].includes(acStatut);
  const canAdd = (isQHSE || isResponsableProcessus) && isEditable && !isClosed;

  // Actions dont l'échéance est dans ≤ 3 jours et non terminées
  const upcomingDeadlines = actions.filter(a => {
    if (a.statut !== "En cours" || !a.dateFinPrevue) return false;
    const diff = Math.ceil((new Date(a.dateFinPrevue) - new Date()) / 86400000);
    return diff <= 3;
  });

  // Union des responsables de toutes les actions liées → fiche.responsablesProcessus
  const syncFicheResponsables = async (allActions) => {
    const union = [...new Set((allActions || []).flatMap(a => a.responsablesProcessus || []))];
    await base44.entities.AmeliorationContinue.update(acId, { responsablesProcessus: union });
  };

  // Clôture automatique : déclenchée après chaque mise à jour de statut d'action.
  // La vérification et la clôture sont faites côté backend (lecture privilégiée service
  // role, non soumise aux restrictions de l'appelant) : la fiche est clôturée si toutes ses
  // actions sont en état final avec au moins une « Réalisée », ou passe à « Abandonnée »
  // si toutes sont abandonnées. La notification « all_actions_done »
  // (in-app + email) est envoyée atomiquement par le backend.
  const checkAutoClosure = async () => {
    try {
      const res = await base44.functions.invoke("checkAcClosure", { acId });
      if (res?.data?.closed) {
        logJournal({ user, type: "Clôture AC", element: acNumero || acId, details: "Clôture automatique : toutes les actions réalisées ou abandonnées" });
      }
      if (res?.data?.abandoned) {
        logJournal({ user, type: "Changement de statut", element: acNumero || acId, details: "Passage automatique à « Abandonnée » : toutes les actions abandonnées" });
      }
      return res?.data || null;
    } catch (e) {
      console.warn("[ActionsListAC] Vérification de clôture (backend) échouée", { acId, err: String(e?.message || e) });
      return null;
    }
  };

  const handleAdd = async () => {
    const list = await getProcessusList();
    const respEmails = getResponsablesEmails(list, newAction.responsable);
    await base44.entities.ActionAmelioration.create({
      acId,
      initiateurEmail: acInitiateurEmail,
      responsablesProcessus: respEmails,
      description: newAction.description.trim(),
      responsable: newAction.responsable,
      responsableNom: newAction.responsable,
      dateFinPrevue: newAction.dateFinPrevue,
      statut: "En cours",
      historique: [{ date: new Date().toISOString(), ancienStatut: "—", nouveauStatut: "En cours", auteurEmail: user?.email || "", auteurNom: user?.full_name || user?.email || "—" }],
    });
    logJournal({ user, type: "Action AC", element: acNumero || acId, details: `Action ajoutée : ${newAction.description}` });
    const all = await base44.entities.ActionAmelioration.filter({ acId });
    await syncFicheResponsables(all);
    notifyAC({ ac: { id: acId, numero: acNumero }, event: "action_assigned", action: { ...newAction } })
      .catch(e => console.warn("[ActionsListAC] Échec de la notification 'action_assigned'", { acId, err: String(e?.message || e) }));
    setNewAction(emptyAction);
    setShowAdd(false);
    onRefresh();
  };

  const handleDelete = async (actionId) => {
    const action = actions.find(a => a.id === actionId);
    await base44.entities.ActionAmelioration.delete(actionId);
    logJournal({ user, type: "Action AC", element: acNumero || acId, details: `Action supprimée : ${action?.description || ""}` });
    const all = await base44.entities.ActionAmelioration.filter({ acId });
    await syncFicheResponsables(all);
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
    await base44.entities.ActionAmelioration.update(action.id, update);
    logJournal({ user, type: "Action AC", element: acNumero || acId, details: newEmail ? `Action sous-assignée à ${member?.nom || newEmail}` : "Sous-assignation retirée" });
    // Notification au membre assigné uniquement — aucun message en cas d'auto-assignation
    if (newEmail && newEmail !== user?.email) {
      notifyAC({
        ac: { id: acId, numero: acNumero, initiateurEmail: acInitiateurEmail },
        event: "action_sub_assigned",
        action: { ...action, assigneEmail: newEmail, assigneNom: member?.nom || "" },
        auteur: { email: user?.email, nom: user?.full_name || user?.email },
      }).catch(e => console.warn("[ActionsListAC] Échec de la notification 'action_sub_assigned'", { action: action.description, err: String(e?.message || e) }));
    }
    onRefresh();
  };

  const handleMarkDone = async (action, realDate, comment) => {
    // Contrainte côté logique : date + commentaire + pièce justificative obligatoires
    if (!realDate || !(comment || "").trim() || (action.piecesJustificatives || []).length === 0) {
      alert("La date de réalisation, le commentaire et au moins une pièce justificative sont obligatoires pour marquer l'action comme réalisée.");
      return;
    }
    // Garde anti double-envoi : si l'action est déjà réalisée en base (donnée la plus récente), ne rien refaire ni notifier
    const fresh = await base44.entities.ActionAmelioration.get(action.id).catch(() => null);
    if (fresh && fresh.statut === "Réalisée") return;
    await base44.entities.ActionAmelioration.update(action.id, {
      statut: "Réalisée",
      dateRealisationEffective: realDate,
      commentaireRealisation: comment.trim(),
      historique: [
        ...(action.historique || []),
        { date: new Date().toISOString(), ancienStatut: action.statut, nouveauStatut: "Réalisée", auteurEmail: user?.email || "", auteurNom: user?.full_name || user?.email || "—" },
      ],
    });
    logJournal({ user, type: "Action AC", element: acNumero || acId, details: `Action réalisée : ${action.description}` });
    // Action sous-assignée réalisée : informer les pilotes du processus (hors membre assigné)
    if (action.assigneEmail) {
      notifyAC({
        ac: { id: acId, numero: acNumero },
        event: "team_actions_done",
        action: { ...action, dateRealisationEffective: realDate, auteurNom: user?.full_name || user?.email || "—" },
      }).catch(e => console.warn("[ActionsListAC] Échec de la notification 'team_actions_done'", { action: action.description, err: String(e?.message || e) }));
    }
    notifyAC({
      ac: { id: acId, numero: acNumero, initiateurEmail: acInitiateurEmail },
      event: "action_realized",
      action: { ...action, dateRealisationEffective: realDate, commentaireRealisation: comment.trim(), auteurNom: user?.full_name || user?.email || "—" },
    })
      .catch(e => console.warn("[ActionsListAC] Échec de la notification 'action_realized'", { acId, err: String(e?.message || e) }));
    await checkAutoClosure();
    onRefresh();
  };

  const handleUploadJustif = async (action, e) => {
    const files = Array.from(e.target.files);
    const urls = [...(action.piecesJustificatives || [])];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push({ url: file_url, nom: file.name });
    }
    await base44.entities.ActionAmelioration.update(action.id, { piecesJustificatives: urls });
    onRefresh();
  };

  const handleRemoveJustif = async (action, index) => {
    const urls = (action.piecesJustificatives || []).filter((_, i) => i !== index);
    await base44.entities.ActionAmelioration.update(action.id, { piecesJustificatives: urls });
    onRefresh();
  };

  // Mise à jour d'un champ de l'action (responsable, échéance, statut)
  const handleUpdateAction = async (action, field, value) => {
    if (field === "statut" && value === "Réalisée" && value !== action.statut) {
      // Contrainte côté logique : pas de "Réalisée" sans réalisation complète
      if (!action.dateRealisationEffective || !(action.commentaireRealisation || "").trim() || (action.piecesJustificatives || []).length === 0) {
        alert("Réalisation incomplète : la date, le commentaire et une pièce justificative sont obligatoires avant de passer à « Réalisée » (utilisez le bouton « Marquer comme réalisée »).");
        return;
      }
    }
    const update = { [field]: value };
    if (field === "responsable") update.responsableNom = value;
    // Échéance modifiée : réinitialiser le rappel préventif (un nouveau rappel partira pour la nouvelle date)
    if (field === "dateFinPrevue" && value !== action.dateFinPrevue) update.rappelPreventifNotifie = false;
    if (field === "statut" && value !== action.statut) {
      // (Re)passe à "En cours" → réinitialiser le suivi "vu" (pastille type non-lu)
      if (value === "En cours") update.vuParEmails = [];
      update.historique = [
        ...(action.historique || []),
        { date: new Date().toISOString(), ancienStatut: action.statut, nouveauStatut: value, auteurEmail: user?.email || "", auteurNom: user?.full_name || user?.email || "—" },
      ];
    }
    await base44.entities.ActionAmelioration.update(action.id, update);
    logJournal({ user, type: "Action AC", element: acNumero || acId, details: `Action modifiée : ${action.description} (${field})` });
    if (field === "statut" && value === "Réalisée") {
      if (value !== action.statut) {
        if (action.assigneEmail) {
          notifyAC({
            ac: { id: acId, numero: acNumero },
            event: "team_actions_done",
            action: { ...action, statut: value, auteurNom: user?.full_name || user?.email || "—" },
          }).catch(e => console.warn("[ActionsListAC] Échec de la notification 'team_actions_done'", { action: action.description, err: String(e?.message || e) }));
        }
        notifyAC({
          ac: { id: acId, numero: acNumero, initiateurEmail: acInitiateurEmail },
          event: "action_realized",
          action: { ...action, statut: value, auteurNom: user?.full_name || user?.email || "—" },
        })
          .catch(e => console.warn("[ActionsListAC] Échec de la notification 'action_realized'", { acId, err: String(e?.message || e) }));
      }
      await checkAutoClosure();
    }
    if (field === "statut" && value === "En standby" && value !== action.statut) {
      notifyAC({ ac: { id: acId, numero: acNumero, initiateurEmail: acInitiateurEmail }, event: "action_standby" })
        .catch(e => console.warn("[ActionsListAC] Échec de la notification 'action_standby'", { acId, err: String(e?.message || e) }));
    }
    if (field === "statut" && value === "Abandonnée" && value !== action.statut) {
      notifyAC({ ac: { id: acId, numero: acNumero, initiateurEmail: acInitiateurEmail }, event: "action_abandoned", action: { ...action, statut: value } })
        .catch(e => console.warn("[ActionsListAC] Échec de la notification 'action_abandoned'", { acId, err: String(e?.message || e) }));
      // L'abandon de la dernière action en attente peut déclencher la clôture (ou le passage à « Abandonnée ») de la fiche
      await checkAutoClosure();
    }
    onRefresh();
  };

  const addEnabled = !!newAction.description.trim() && !!newAction.responsable && !!newAction.dateFinPrevue;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Actions d'amélioration</h3>
        {canAdd && (
          <Button size="sm" variant="outline" onClick={() => { setAddAttempted(false); setShowAdd(true); }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter une action
          </Button>
        )}
      </div>

      {/* Alerte échéances proches ou dépassées — relance manuelle réservée à la QHSE vers les responsables de l'action */}
      {isQHSE && !isClosed && upcomingDeadlines.length > 0 && (
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
                    onClick={() => notifyAC({ ac: { id: acId, numero: acNumero }, event: "action_late", action: a }).catch(e => console.warn("[ActionsListAC] Échec de la notification 'action_late'", { acId, err: String(e?.message || e) }))}
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
          {actions.map(action => (
            <ActionRowAC
              key={action.id}
              action={action}
              isQHSE={isQHSE}
              userEmail={userEmail}
              isClosed={isClosed}
              isEditable={isEditable}
              onDelete={handleDelete}
              onMarkDone={handleMarkDone}
              onUploadJustif={handleUploadJustif}
              onRemoveJustif={handleRemoveJustif}
              onUpdateAction={handleUpdateAction}
              membres={membresFor(action)}
              userName={user?.full_name || user?.email}
              onAssign={handleAssign}
            />
          ))}
        </div>
      )}
    </div>
  );
}