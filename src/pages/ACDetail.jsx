import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useUserRole } from "@/components/qhse/useUserRole";
import StatusBadge from "@/components/qhse/StatusBadge";
import ActionsListAC from "@/components/qhse/ActionsListAC";
import NCTimeline from "@/components/qhse/NCTimeline";
import CommentairesSection from "@/components/qhse/commentaires/CommentairesSection";
import { notifyAC } from "@/components/qhse/notifyAC";
import { logJournal } from "@/components/qhse/journalUtils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { parseStoredDate } from "@/components/qhse/dateFormat";

export default function ACDetail() {
  const { user, isQHSE, loading: userLoading } = useUserRole();
  const queryClient = useQueryClient();
  const id = new URLSearchParams(window.location.search).get("id");
  const [motif, setMotif] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ constat: "", descriptionAmelioration: "" });

  const { data: ac, isLoading } = useQuery({
    queryKey: ["ac-detail", id],
    queryFn: () => base44.entities.AmeliorationContinue.get(id),
    enabled: !!id,
  });

  const { data: actions = [], isLoading: actionsLoading } = useQuery({
    queryKey: ["ac-detail-actions", id],
    queryFn: () => base44.entities.ActionAmelioration.filter({ acId: id }),
    enabled: !!id,
  });

  useEffect(() => {
    if (ac) setDraft({ constat: ac.constat || "", descriptionAmelioration: ac.descriptionAmelioration || "" });
  }, [ac?.id]);

  // Marque comme "vues" les actions de la fiche consultées par le pilote responsable (pastille type non-lu) — silencieux
  useEffect(() => {
    if (!user?.email || !id) return;
    const toMark = actions.filter(a =>
      (a.responsablesProcessus || []).includes(user.email) &&
      a.statut === "En cours" &&
      !(a.vuParEmails || []).includes(user.email)
    );
    if (toMark.length === 0) return;
    (async () => {
      try {
        await Promise.all(toMark.map(a =>
          base44.entities.ActionAmelioration.update(a.id, { vuParEmails: [...(a.vuParEmails || []), user.email] })
        ));
        queryClient.invalidateQueries({ queryKey: ["ac-actions-a-traiter"] });
        queryClient.invalidateQueries({ queryKey: ["ac-detail-actions", id] });
      } catch (e) {
        console.warn("[ACDetail] Marquage 'vu' des actions AC échoué", { err: String(e?.message || e) });
      }
    })();
  }, [actions, user?.email, id]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["ac-detail", id] });
    queryClient.invalidateQueries({ queryKey: ["ac-detail-actions", id] });
    queryClient.invalidateQueries({ queryKey: ["mes-ac"] });
    queryClient.invalidateQueries({ queryKey: ["ac-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["traitement-acs"] });
    queryClient.invalidateQueries({ queryKey: ["ac-fiches-a-traiter"] });
    queryClient.invalidateQueries({ queryKey: ["ac-actions-a-traiter"] });
  };

  if (userLoading || isLoading || actionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!ac) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-slate-500 mb-4">Fiche AC introuvable.</p>
        <Link to="/MesAC" className="text-sm text-blue-600 hover:underline">← Retour à la liste</Link>
      </div>
    );
  }

  const isClosed = ["Clôturée", "Abandonnée"].includes(ac.statut);
  const isInitiateur = !!user?.email && user.email === ac.initiateurEmail;
  const isResponsableProcessus = (ac.responsablesProcessus || []).includes(user?.email);
  const anyStandby = actions.some(a => a.statut === "En standby");
  const canArbitrage = anyStandby && !isClosed && (isQHSE || isInitiateur);
  const canEditContent = ac.statut === "Brouillon" && (isQHSE || isInitiateur);

  const saveContent = async () => {
    setSaving(true);
    await base44.entities.AmeliorationContinue.update(ac.id, draft);
    setSaving(false);
    refresh();
  };

  // Arbitrage manuel : relancer (En cours), abandonner, ou clôturer avec motif obligatoire
  const setStatut = async (statut, motifCloture) => {
    setSaving(true);
    await base44.entities.AmeliorationContinue.update(ac.id, {
      statut,
      ...(statut === "Clôturée" ? { motifCloture, dateCloture: new Date().toISOString() } : {}),
      historique: [
        ...(ac.historique || []),
        {
          date: new Date().toISOString(),
          type: "Changement de statut",
          auteur: user?.full_name || user?.email || "—",
          detail: `Statut fixé manuellement : ${statut}${motifCloture ? ` — motif : ${motifCloture}` : ""}`,
        },
      ],
    });
    logJournal({
      user,
      type: statut === "Clôturée" ? "Clôture AC" : "Changement de statut",
      element: ac.numero || ac.id,
      details: `Statut fixé manuellement : ${statut}`,
    });
    if (statut === "Clôturée") {
      notifyAC({ ac: { id: ac.id, numero: ac.numero }, event: "all_actions_done", label: "clôture manuelle" })
        .catch(e => console.warn("[ACDetail] Échec de la notification de clôture", { err: String(e?.message || e) }));
    }
    setSaving(false);
    setMotif("");
    refresh();
  };

  // Filet de sécurité : clôture manuelle via la même fonction backend que la clôture
  // automatique (aucune logique dupliquée) — active uniquement quand toutes les actions
  // sont « Réalisée » mais que la fiche n'est pas encore clôturée.
  const handleManualClosure = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("checkAcClosure", { acId: ac.id });
      if (res?.data?.closed) {
        logJournal({ user, type: "Clôture AC", element: ac.numero || ac.id, details: "Clôture manuelle (filet de sécurité) : toutes les actions réalisées" });
      }
    } catch (e) {
      console.warn("[ACDetail] Clôture manuelle (backend) échouée", { id: ac.id, err: String(e?.message || e) });
    }
    setSaving(false);
    refresh();
  };

  return (
    <div className="space-y-6">
      <Link to="/MesAC" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600">
        <ArrowLeft className="w-4 h-4" /> Retour à la liste
      </Link>

      {/* En-tête */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{ac.numero}</h1>
              <StatusBadge statut={ac.statut} type="ac" />
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Déclarée par {ac.initiateur || ac.initiateurEmail} · Processus initiateur : {ac.processusInitiateur} · Source : {ac.source}
              {ac.created_date && ` · ${format(parseStoredDate(ac.created_date), "dd/MM/yyyy")}`}
            </p>
          </div>
          {ac.motifCloture && (
            <div className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 max-w-sm">
              Motif de clôture : {ac.motifCloture}
            </div>
          )}
        </div>
      </div>

      {/* Constat & amélioration souhaitée — lecture seule sauf Brouillon */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Constat / opportunité identifiée</h2>
          {canEditContent ? (
            <Textarea value={draft.constat} onChange={e => setDraft(d => ({ ...d, constat: e.target.value }))} rows={4} className="mt-2" />
          ) : (
            <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{ac.constat}</p>
          )}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Amélioration souhaitée</h2>
          {canEditContent ? (
            <Textarea value={draft.descriptionAmelioration} onChange={e => setDraft(d => ({ ...d, descriptionAmelioration: e.target.value }))} rows={4} className="mt-2" />
          ) : (
            <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{ac.descriptionAmelioration}</p>
          )}
        </div>
        {canEditContent && (
          <Button size="sm" onClick={saveContent} disabled={saving} className="bg-blue-600 hover:bg-blue-700">Enregistrer</Button>
        )}
      </div>

      {/* Bloc arbitrage manuel — visible si au moins une action en standby, réservé initiateur + QHSE */}
      {canArbitrage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-amber-800">Arbitrage manuel requis</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Au moins une action de cette AC est en standby. Décidez du sort de la fiche : relancer le traitement, clôturer (motif obligatoire) ou abandonner.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={saving} onClick={() => setStatut("En cours")}>Relancer (En cours)</Button>
            <Button size="sm" variant="outline" disabled={saving} onClick={() => setStatut("Abandonnée")}>Abandonner</Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
            <div className="flex-1 w-full">
              <label className="text-xs font-medium text-amber-800">Motif de clôture (obligatoire)</label>
              <Textarea value={motif} onChange={e => setMotif(e.target.value)} rows={2} className="mt-1" placeholder="Justifiez la clôture malgré les actions non réalisées..." />
            </div>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={saving || !motif.trim()} onClick={() => setStatut("Clôturée", motif.trim())}>
              Clôturer
            </Button>
          </div>
        </div>
      )}

      {/* Filet de sécurité : clôture manuelle quand toutes les actions sont en état final avec au moins une réalisée */}
      {!isClosed && (isQHSE || isResponsableProcessus) && actions.length > 0
        && actions.every(a => ["Réalisée", "Abandonnée"].includes(a.statut))
        && actions.some(a => a.statut === "Réalisée") && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
          <div>
            <p className="text-sm font-semibold text-green-800">Toutes les actions sont réalisées ou abandonnées</p>
            <p className="text-xs text-green-700 mt-0.5">La fiche n'est pas encore clôturée. Vous pouvez clôturer l'AC maintenant.</p>
          </div>
          <Button size="sm" className="bg-green-600 hover:bg-green-700 flex-shrink-0" disabled={saving} onClick={handleManualClosure}>
            Clôturer l'AC
          </Button>
        </div>
      )}

      {/* Actions liées */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <ActionsListAC
          acId={ac.id}
          acNumero={ac.numero}
          acInitiateurEmail={ac.initiateurEmail}
          acStatut={ac.statut}
          actions={actions}
          onRefresh={refresh}
          isQHSE={isQHSE}
          isResponsableProcessus={isResponsableProcessus}
          isEditable={!isClosed}
          user={user}
          userEmail={user?.email}
        />
      </div>

      {/* Historique */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Historique</h2>
        {(!ac.historique || ac.historique.length === 0) ? (
          <p className="text-sm text-slate-400 italic">Aucun événement enregistré</p>
        ) : (
          <NCTimeline historique={ac.historique} />
        )}
      </div>

      {/* Commentaires */}
      <CommentairesSection
        entityType="AC"
        entityId={ac.id}
        numero={ac.numero}
        initiateurEmail={ac.initiateurEmail}
        responsablesProcessus={ac.responsablesProcessus || []}
        user={user}
      />
    </div>
  );
}