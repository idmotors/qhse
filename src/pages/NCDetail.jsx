import React, { useState, useCallback, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/components/qhse/useUserRole";
import StepProgressBar from "@/components/qhse/StepProgressBar";
import StepNavButtons from "@/components/qhse/StepNavButtons";
import NCTimeline from "@/components/qhse/NCTimeline";
import CommentairesSection from "@/components/qhse/commentaires/CommentairesSection";
import StatusBadge from "@/components/qhse/StatusBadge";
import NCStepOuverte from "@/components/qhse/nc/NCStepOuverte";
import NCStepInvestigation from "@/components/qhse/nc/NCStepInvestigation";
import NCStepTraitement from "@/components/qhse/nc/NCStepTraitement";
import NCStepVerification from "@/components/qhse/nc/NCStepVerification";
import NCStepCloture from "@/components/qhse/nc/NCStepCloture";
import NCStepCloturee from "@/components/qhse/nc/NCStepCloturee";
import { Button } from "@/components/ui/button";
import DeleteConfirmDialog from "@/components/qhse/DeleteConfirmDialog";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Trash2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import NCExportPDF from "@/components/qhse/nc/NCExportPDF";
import { isAnalyseComplete } from "@/components/qhse/nc/causeRacineUtils";
import { isActionDone } from "@/components/qhse/actionUtils";
import { logJournal } from "@/components/qhse/journalUtils";
import { formatDateFr, parseStoredDate } from "@/components/qhse/dateFormat";
import { notifyProcessus } from "@/components/qhse/processusUtils";
import { STATUTS_ACTION } from "@/components/qhse/useNcATraiter";

// Correspondance statut → index d'étape
const STATUT_TO_STEP = {
  "Ouverte": 0,
  "En investigation": 1,
  "En cours de traitement": 2,
  "En retard": 2,
  "En vérification d'efficacité": 3,
  "Clôturée": 4,
};

const NC_STEPS = [
  { label: "Ouverte" },
  { label: "Investigation" },
  { label: "Traitement" },
  { label: "Vérification" },
  { label: "Clôturée" },
];

export default function NCDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const ncId = urlParams.get("id");
  const { user, isQHSE, isCollaborateur } = useUserRole();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteNC = async () => {
    setDeleting(true);
    logJournal({ user, type: "Suppression NC", element: nc?.numero, details: nc?.titre ? `NC "${nc.titre}" supprimée` : "NC supprimée" });
    await base44.entities.NonConformite.delete(ncId);
    // Supprimer les actions liées
    const allActions = await base44.entities.Action.list("-created_date", 500);
    const linkedActions = allActions.filter(a => a.ncId === ncId);
    await Promise.all(linkedActions.map(a => base44.entities.Action.delete(a.id)));
    // Actions immédiates liées (nouveau workflow)
    const linkedImmediates = await base44.entities.ActionImmediate.filter({ ncId });
    await Promise.all(linkedImmediates.map(a => base44.entities.ActionImmediate.delete(a.id)));
    queryClient.invalidateQueries({ queryKey: ["mes-ncs"] });
    queryClient.invalidateQueries({ queryKey: ["ncs-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["traitement-ncs"] });
    setDeleting(false);
    navigate("/MesNC");
  };

  const { data: nc, isLoading } = useQuery({
    queryKey: ["nc-detail", ncId],
    queryFn: async () => {
      const list = await base44.entities.NonConformite.list("-created_date", 500);
      return list.find(n => n.id === ncId) || null;
    },
    enabled: !!ncId,
  });

  const { data: actions = [], refetch: refetchActions } = useQuery({
    queryKey: ["nc-actions", ncId],
    queryFn: () => base44.entities.Action.filter({ ncId }, "created_date"),
    enabled: !!ncId,
  });

  const { data: actionsImmediates = [] } = useQuery({
    queryKey: ["nc-actions-immediates", ncId],
    queryFn: () => base44.entities.ActionImmediate.filter({ ncId }, "created_date"),
    enabled: !!ncId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["all-users"],
    queryFn: () => base44.entities.User.list(),
  });

  const [saving, setSaving] = useState(false);

  // Étape active affichée (peut différer du statut si on navigue en lecture seule)
  const currentStatutStep = nc ? (STATUT_TO_STEP[nc.statut] ?? 0) : 0;
  const [activeStep, setActiveStep] = useState(0);

  // Synchronise l'étape affichée avec le statut dès chargement
  useEffect(() => {
    if (nc) setActiveStep(STATUT_TO_STEP[nc.statut] ?? 0);
  }, [nc?.statut]);

  // Marque la NC comme "vue" par le pilote responsable (pastille type non-lu) — silencieux
  useEffect(() => {
    if (!nc || !user?.email) return;
    if (!(nc.responsablesProcessus || []).includes(user.email)) return;
    if (!STATUTS_ACTION.includes(nc.statut)) return;
    if ((nc.vuParEmails || []).includes(user.email)) return;
    (async () => {
      try {
        await base44.entities.NonConformite.update(ncId, { vuParEmails: [...(nc.vuParEmails || []), user.email] });
        queryClient.invalidateQueries({ queryKey: ["nc-a-traiter"] });
        queryClient.invalidateQueries({ queryKey: ["nc-detail", ncId] });
      } catch (e) {
        console.warn("[NCDetail] Marquage 'vu' de la NC échoué", { err: String(e?.message || e) });
      }
    })();
  }, [nc, user?.email]);

  // Responsable du processus assigné (figé à la création de la NC) — accès autorisé quel que soit son profil
  const isResponsableProcessus = !!user && (nc?.responsablesProcessus || []).includes(user.email);
  const inefficaceActionIds = nc?.inefficaceActionIds || [];
  const activeActions = actions.filter(a => !inefficaceActionIds.includes(a.id));
  const allActionsRealized = activeActions.length > 0 && activeActions.every(a => isActionDone(a));

  // Helpers
  const addHistoryEvent = (ncData, type, detail) => [
    ...(ncData.historique || []),
    { date: new Date().toISOString(), type, auteur: user?.full_name, detail },
  ];

  const updateNC = async (data) => {
    setSaving(true);
    // (Re)transition vers un statut actionnable → réinitialiser le suivi "vu" (pastille type non-lu)
    if (data.statut && data.statut !== nc?.statut && STATUTS_ACTION.includes(data.statut)) {
      data.vuParEmails = [];
    }
    await base44.entities.NonConformite.update(ncId, data);
    queryClient.invalidateQueries({ queryKey: ["nc-detail", ncId] });
    queryClient.invalidateQueries({ queryKey: ["ncs-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["nc-a-traiter"] });
    queryClient.invalidateQueries({ queryKey: ["traitement-ncs"] });
    setSaving(false);
  };

  const sendNotification = (destinataire, type, titre, message) => {
    base44.entities.Notification.create({ destinataire, type, titre, message, lu: false, lienType: "nc", lienId: ncId })
      .catch(e => console.warn("[NCDetail] Échec d'envoi de la notification in-app", { destinataire, type, titre, err: String(e?.message || e) }));
  };
  const notifyDirection = (type, titre, message) => {
    users.filter(u => u.role === "direction").forEach(u => sendNotification(u.email, type, titre, message));
  };

  const handleFieldUpdate = useCallback(async (field, value) => {
    await updateNC({ [field]: value });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ncId]);

  const refreshActions = useCallback(() => {
    refetchActions();
    queryClient.invalidateQueries({ queryKey: ["nc-detail", ncId] });
  }, [refetchActions, ncId, queryClient]);

  // === Transitions de statut ===
  const handleStartInvestigation = async () => {
    // Garde : déjà au-delà de cette étape → navigation simple
    if (nc.statut !== "Ouverte") {
      setActiveStep(1);
      return;
    }
    const hist = addHistoryEvent(nc, "Passage à En investigation", `Ouverture de l'investigation par ${user?.full_name}`);
    await updateNC({ statut: "En investigation", historique: hist });
    logJournal({ user, type: "Changement de statut", element: nc.numero, details: "Ouverte → En investigation" });
    notifyProcessus({ nc, event: "status_change", label: "En investigation" }).catch(e => console.warn("[NCDetail] Échec de la notification processus (status_change)", e));
    setActiveStep(1);
  };

  const handlePassToTraitement = async () => {
    if (nc.statut === "En cours de traitement" || nc.statut === "En retard" || nc.statut === "En vérification d'efficacité" || nc.statut === "Clôturée") {
      setActiveStep(2);
      return;
    }
    const hist = addHistoryEvent(nc, "Passage en cours de traitement", `Actions correctives assignées par ${user?.full_name}`);
    await updateNC({ statut: "En cours de traitement", historique: hist });
    actions.forEach(action => {
      if (action.responsable) {
        sendNotification(action.responsable, "Assignation", `Action assignée : ${nc.numero}`,
          `Vous êtes responsable de l'action : ${action.description} — Échéance : ${formatDateFr(action.dateFinPrevue)}`);
      }
    });
    logJournal({ user, type: "Changement de statut", element: nc.numero, details: "→ En cours de traitement" });
    notifyProcessus({ nc, event: "status_change", label: "En cours de traitement" }).catch(e => console.warn("[NCDetail] Échec de la notification processus (status_change)", e));
    setActiveStep(2);
  };

  const handleSubmitVerification = async () => {
    if (!allActionsRealized) return;
    if (nc.statut === "En vérification d'efficacité" || nc.statut === "Clôturée") {
      setActiveStep(3);
      return;
    }
    const hist = addHistoryEvent(nc, "Soumission pour vérification", `Toutes les actions réalisées`);
    await updateNC({ statut: "En vérification d'efficacité", historique: hist });
    logJournal({ user, type: "Changement de statut", element: nc.numero, details: "→ En vérification d'efficacité" });
    // Notification unique pour cette transition (QHSE + processus demandeur + initiateur), fusion des anciens appels status_change + verification_required
    notifyProcessus({ nc, event: "verification_required" }).catch(e => console.warn("[NCDetail] Échec de la notification processus (verification_required)", e));
    setActiveStep(3);
  };

  const handleVerification = async (efficace) => {
    if (efficace) {
      const hist = addHistoryEvent(nc, "Action jugée efficace", `Vérification positive par ${user?.full_name}`);
      await updateNC({ actionEfficace: true, verifiePar: user?.full_name, dateVerification: new Date().toISOString(), historique: hist });
      logJournal({ user, type: "Vérification efficacité", element: nc.numero, details: "Action jugée efficace" });
    } else {
      const currentActionIds = actions.map(a => a.id);
      const newInefficaceIds = [...inefficaceActionIds, ...currentActionIds];
      const hist = addHistoryEvent(nc, "Action jugée inefficace", `Retour en traitement — nouvelles actions requises`);
      await updateNC({ statut: "En cours de traitement", actionEfficace: false, resultatsVerification: "", verifiePar: "", dateVerification: "", inefficaceActionIds: newInefficaceIds, historique: hist });
      logJournal({ user, type: "Vérification efficacité", element: nc.numero, details: "Action jugée inefficace — retour en traitement" });
      if (nc.responsableSuivi) {
        sendNotification(nc.responsableSuivi, "Efficacité", `Action inefficace : ${nc.numero}`, "L'action a été jugée inefficace. Veuillez définir une nouvelle action corrective.");
      }
      notifyProcessus({ nc, event: "status_change", label: "En cours de traitement" }).catch(e => console.warn("[NCDetail] Échec de la notification processus (status_change)", e));
      // Alerte dédiée au processus assigné : son action a été jugée inefficace, la NC est de retour en traitement
      notifyProcessus({ nc, event: "action_inefficace" }).catch(e => console.warn("[NCDetail] Échec de la notification processus (action_inefficace)", e));
      setActiveStep(2);
    }
  };

  const handleCloture = async () => {
    if (nc.statut === "Clôturée") {
      setActiveStep(4);
      return;
    }
    const delai = differenceInDays(new Date(), new Date(nc.created_date));
    const echeance = nc.echeanceFixeeQHSE ? new Date(nc.echeanceFixeeQHSE) : null;
    const dateCloture = new Date();
    const dansDelai = echeance ? dateCloture <= echeance : delai <= 30;
    const hist = addHistoryEvent(nc, "NC clôturée", `NC clôturée par ${user?.full_name}`);
    await updateNC({ statut: "Clôturée", dateCloture: dateCloture.toISOString(), delaiTraitementEffectif: delai, clotureDansDelai: dansDelai, historique: hist });
    notifyDirection("Clôture", `NC clôturée : ${nc.numero}`, `La NC ${nc.numero} a été clôturée.`);
    logJournal({ user, type: "Clôture NC", element: nc.numero, details: `Clôturée par ${user?.full_name || ""}` });
    notifyProcessus({ nc, event: "status_change", label: "Clôturée" }).catch(e => console.warn("[NCDetail] Échec de la notification processus (status_change)", e));
    setActiveStep(4);
  };

  // === Conditions de passage à l'étape suivante ===
  // Si l'utilisateur consulte une étape déjà dépassée → navigation passive toujours autorisée
  const isNavigationOnly = activeStep < currentStatutStep;

  const getCanGoNext = () => {
    if (isNavigationOnly) return true; // navigation passive, toujours permise
    // Pilotage investigation → traitement → soumission vérification : QHSE ou responsable du processus ; clôture : QHSE seul
    if (!(isQHSE || isResponsableProcessus)) return false;
    switch (activeStep) {
      case 0: return false; // step 0 : navigation passive via isNavigationOnly gérée avant le switch
      case 1: return isAnalyseComplete(nc) && activeActions.length > 0 && (!activeActions.some(a => a.responsable) || !!nc?.criteresEfficacite);
      case 2: return allActionsRealized;
      case 3: return isQHSE && nc?.actionEfficace === true && allActionsRealized;
      default: return false;
    }
  };

  const handleNext = () => {
    // Navigation passive : l'étape est déjà validée, simple déplacement
    if (isNavigationOnly) {
      setActiveStep(s => s + 1);
      return;
    }
    if (activeStep === 0) return; // géré dans NCStepOuverte
    if (activeStep === 1) handlePassToTraitement();
    else if (activeStep === 2) handleSubmitVerification();
    else if (activeStep === 3) handleCloture();
  };

  const getNextLabel = () => {
    // Si navigation passive : label neutre sans connotation d'action métier
    if (isNavigationOnly) return "Suivant →";
    if (activeStep === 1) return "Passer en traitement";
    if (activeStep === 2) return "Soumettre pour vérification";
    if (activeStep === 3) return "Clôturer la NC";
    return "Étape suivante";
  };

  // Message rouge affiché après une tentative quand l'étape entière est bloquante
  const getBlockedMessage = () => {
    if (isNavigationOnly) return null;
    switch (activeStep) {
      case 0: return "Veuillez indiquer si des actions immédiates sont nécessaires, puis démarrer l'investigation.";
      case 1: return "Veuillez compléter l'analyse des causes et ajouter au moins une action corrective avant de passer au traitement.";
      case 2: return "Toutes les actions actives doivent être terminées avant de passer à la vérification.";
      default: return null;
    }
  };

  if (!ncId) {
    return <div className="text-center py-20 text-slate-500">Identifiant NC manquant.</div>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!nc) {
    return <div className="text-center py-20 text-slate-500">NC introuvable.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/MesNC" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>
        <div className="flex items-center gap-3">
          <NCExportPDF nc={nc} actions={actions} inefficaceActionIds={inefficaceActionIds} actionsImmediates={actionsImmediates} />
          {isQHSE && (
            <button
              onClick={() => setDeleteDialogOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors"
              title="Supprimer cette NC"
            >
              <Trash2 className="w-3.5 h-3.5" /> Supprimer
            </button>
          )}
        </div>
      </div>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        title="Supprimer la NC ?"
        description={`La NC "${nc?.numero}" et toutes ses actions seront définitivement supprimées. Cette action est irréversible.`}
        onConfirm={handleDeleteNC}
        onCancel={() => setDeleteDialogOpen(false)}
        loading={deleting}
      />

      {/* En-tête permanent */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <h1 className="text-xl font-bold text-slate-900">{nc.numero}</h1>
          <StatusBadge statut={nc.statut} />
          {nc.circuitCreation === "Papier" && (
            <span className="bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">📋 Saisie Papier</span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><span className="text-slate-500">Date :</span> <span className="font-medium">{nc.created_date ? format(parseStoredDate(nc.created_date), "dd/MM/yyyy") : "-"}</span></div>
          <div><span className="text-slate-500">Initiateur :</span> <span className="font-medium">{nc.initiateur}</span></div>
          <div><span className="text-slate-500">Source :</span> <span className="font-medium">{nc.source}</span></div>
          <div><span className="text-slate-500">Département :</span> <span className="font-medium">{nc.departement}</span></div>
        </div>
      </div>

      {/* Barre de progression */}
      <StepProgressBar
        steps={NC_STEPS}
        currentStep={activeStep}
        completedUpTo={currentStatutStep}
        onStepClick={setActiveStep}
      />

      {/* Contenu de l'étape active */}
      {activeStep === 0 && (
        <NCStepOuverte
          nc={nc}
          canStartInvestigation={isQHSE || isResponsableProcessus}
          saving={saving}
          onStartInvestigation={handleStartInvestigation}
          user={user}
          isQHSE={isQHSE}
          actionsImmediates={actionsImmediates}
        />
      )}

      {activeStep === 1 && (
        <NCStepInvestigation
          nc={nc}
          actions={actions}
          ncId={ncId}
          isQHSE={isQHSE}
          isResponsableProcessus={isResponsableProcessus}
          isEditable={(isQHSE || isResponsableProcessus) && nc.statut === "En investigation"}
          user={user}
          inefficaceActionIds={inefficaceActionIds}
          onFieldUpdate={handleFieldUpdate}
          onRefreshActions={refreshActions}
        />
      )}

      {activeStep === 2 && (
        <NCStepTraitement
          nc={nc}
          actions={actions}
          ncId={ncId}
          isQHSE={isQHSE}
          isResponsableProcessus={isResponsableProcessus}
          user={user}
          inefficaceActionIds={inefficaceActionIds}
          onRefreshActions={refreshActions}
        />
      )}

      {activeStep === 3 && (
        <NCStepVerification
          nc={nc}
          actions={actions}
          isQHSE={isQHSE}
          saving={saving}
          inefficaceActionIds={inefficaceActionIds}
          onFieldUpdate={handleFieldUpdate}
          onVerification={handleVerification}
        />
      )}

      {activeStep === 3 && nc.actionEfficace === true && (
        <NCStepCloture
          nc={nc}
          isQHSE={isQHSE}
          saving={saving}
          onFieldUpdate={handleFieldUpdate}
          onCloture={handleCloture}
        />
      )}

      {activeStep === 4 && (
        <NCStepCloturee
          nc={nc}
          actions={actions}
          inefficaceActionIds={inefficaceActionIds}
        />
      )}

      {/* Boutons de navigation — masqués à l'étape 3 (la clôture a son propre bouton dans NCStepCloture) */}
      {activeStep < NC_STEPS.length - 1 && activeStep !== 3 && (
        <StepNavButtons
          currentStep={activeStep}
          totalSteps={NC_STEPS.length}
          showNext={isQHSE || isResponsableProcessus}
          canGoNext={getCanGoNext()}
          onPrev={() => setActiveStep(s => s - 1)}
          onNext={handleNext}
          nextLabel={getNextLabel()}
          blockedMessage={getBlockedMessage()}
        />
      )}
      {/* À l'étape 3 : bouton "Précédent" seul si l'action n'est pas encore jugée efficace */}
      {activeStep === 3 && nc.actionEfficace !== true && (
        <div className="flex justify-start">
          <button
            onClick={() => setActiveStep(s => s - 1)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            ← Étape précédente
          </button>
        </div>
      )}

      {/* Historique */}
      {nc.historique?.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Historique</h2>
          <NCTimeline historique={nc.historique} />
        </div>
      )}

      {/* Commentaires */}
      <CommentairesSection
        entityType="NC"
        entityId={ncId}
        numero={nc.numero}
        initiateurEmail={nc.initiateurEmail}
        responsablesProcessus={nc.responsablesProcessus || []}
        user={user}
      />
    </div>
  );
}