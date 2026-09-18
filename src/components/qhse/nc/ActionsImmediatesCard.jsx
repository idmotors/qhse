import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { format, addDays } from "date-fns";
import { PROCESSUS } from "@/components/qhse/constants";
import { getProcessusList, getResponsablesEmails, notifyProcessus } from "@/components/qhse/processusUtils";
import { logJournal } from "@/components/qhse/journalUtils";
import FieldError from "@/components/qhse/FieldError";
import ActionImmediateRow from "./ActionImmediateRow";

/**
 * Décision déjà actée ? Soit via le nouveau champ actionsImmediatesDecidees
 * (post-refonte), soit via la décision historique prise à la création de la NC
 * (NC antérieures : actionsImmediatesRequises true/false déjà renseigné).
 */
export const isActionsImmediatesDecidees = (nc) =>
  nc.actionsImmediatesDecidees === true ||
  nc.actionsImmediatesRequises === true ||
  nc.actionsImmediatesRequises === false;

const emptyAction = () => ({ description: "", responsable: "", dateFinPrevue: "" });

/**
 * Bloc « Actions immédiates » de la carte de prise en charge d'une NC Ouverte :
 * question obligatoire Oui/Non posée au responsable du processus assigné (ou QHSE)
 * après soumission de la NC. Ne modifie jamais le statut ni l'étape de la NC.
 */
export default function ActionsImmediatesCard({ nc, user, isQHSE, actionsImmediates }) {
  const queryClient = useQueryClient();
  const [reponse, setReponse] = useState(null);
  const [actions, setActions] = useState([emptyAction()]);
  const [attempted, setAttempted] = useState(false);
  const [validating, setValidating] = useState(false);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const maxJ2 = format(addDays(new Date(), 2), "yyyy-MM-dd");

  const decided = isActionsImmediatesDecidees(nc);
  // NC créée avant la refonte : décision déjà prise à la création par le demandeur
  const legacy = decided && nc.actionsImmediatesDecidees !== true;

  const actionsValides = actions.length > 0 && actions.every(a =>
    a.description.trim() && a.responsable && a.dateFinPrevue >= todayStr && a.dateFinPrevue <= maxJ2);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["nc-detail", nc.id] });
    queryClient.invalidateQueries({ queryKey: ["nc-actions-immediates", nc.id] });
  };

  const updateAction = (i, field, value) => setActions(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a));
  const addActionRow = () => setActions(prev => [...prev, emptyAction()]);
  const removeActionRow = (i) => setActions(prev => prev.filter((_, idx) => idx !== i));

  // Décision "Non" : simple tracé sur la NC (aucune ActionImmediate créée).
  // Décision "Oui" : une ActionImmediate par action saisie + notifications aux
  // processus désignés responsables (in-app + email, hors auto-assignation).
  const handleValider = async () => {
    setAttempted(true);
    if (reponse === null) return;
    if (reponse === "oui" && !actionsValides) return;
    setValidating(true);
    try {
      const processusList = await getProcessusList();
      let nbCreees = 0;
      if (reponse === "oui") {
        for (const a of actions) {
          await base44.entities.ActionImmediate.create({
            ncId: nc.id,
            initiateurEmail: nc.initiateurEmail || "",
            responsablesProcessus: nc.responsablesProcessus || [],
            responsableEmails: getResponsablesEmails(processusList, a.responsable),
            description: a.description.trim(),
            responsable: a.responsable,
            responsableNom: a.responsable,
            declarePar: isQHSE ? "QHSE" : (nc.processusAssigné || nc.processusConcerne || ""),
            declareParEmail: user?.email || "",
            dateFinPrevue: a.dateFinPrevue,
            statut: "À faire",
            historique: [{ date: new Date().toISOString(), ancienStatut: "—", nouveauStatut: "À faire", auteurEmail: user?.email || "", auteurNom: user?.full_name || "—" }],
          });
          nbCreees++;
        }
      }
      await base44.entities.NonConformite.update(nc.id, {
        actionsImmediatesDecidees: true,
        historique: [
          ...(nc.historique || []),
          {
            date: new Date().toISOString(),
            type: "Actions immédiates",
            auteur: user?.full_name || user?.email || "—",
            detail: reponse === "oui"
              ? `${nbCreees} action(s) immédiate(s) déclarée(s)`
              : "Aucune action immédiate jugée nécessaire",
          },
        ],
      });
      logJournal({
        user,
        type: "Action corrective",
        element: nc.numero || nc.id,
        details: reponse === "oui" ? `${nbCreees} action(s) immédiate(s) déclarée(s)` : "Actions immédiates : aucune jugée nécessaire",
      });
      if (reponse === "oui") {
        const auteur = { email: user?.email, nom: user?.full_name || user?.email };
        // Une notification par processus désigné (listant ses actions), sans
        // notification en auto-assignation (le déclarant ne se notifie pas lui-même)
        const parProcessus = {};
        actions.forEach(a => {
          if (!parProcessus[a.responsable]) parProcessus[a.responsable] = { descs: [], echeance: a.dateFinPrevue };
          parProcessus[a.responsable].descs.push(a.description.trim());
        });
        Object.entries(parProcessus).forEach(([proc, { descs, echeance }]) => {
          notifyProcessus({
            nc,
            event: "action_immediate_assigned",
            action: { description: descs.join(" | "), responsable: proc, responsableNom: proc, dateFinPrevue: echeance },
            auteur,
          }).catch(e => console.warn("[ActionsImmediatesCard] Échec de la notification 'action_immediate_assigned'", { processus: proc, err: String(e?.message || e) }));
        });
      }
      setReponse(null);
      setActions([emptyAction()]);
      setAttempted(false);
      refresh();
    } finally {
      setValidating(false);
    }
  };

  // Marquage « Réalisée » par le responsable désigné (ou QHSE) → alerte in-app + email à l'équipe QHSE
  const handleMarkDone = async (action, dateRealisation) => {
    await base44.entities.ActionImmediate.update(action.id, {
      statut: "Réalisée",
      dateRealisationEffective: dateRealisation,
      historique: [
        ...(action.historique || []),
        { date: new Date().toISOString(), ancienStatut: action.statut, nouveauStatut: "Réalisée", auteurEmail: user?.email || "", auteurNom: user?.full_name || "—" },
      ],
    });
    notifyProcessus({
      nc,
      event: "action_immediate_done",
      action: { ...action, dateRealisationEffective: dateRealisation },
      auteur: { email: user?.email, nom: user?.full_name || user?.email },
    }).catch(e => console.warn("[ActionsImmediatesCard] Échec de la notification 'action_immediate_done'", { action: action.description, err: String(e?.message || e) }));
    refresh();
  };

  return (
    <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-4 space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-slate-900">Actions immédiates</h4>
        <p className="text-xs text-slate-500 mt-0.5">Actions à mener sous 48h maximum (J+2). Elles ne bloquent pas le démarrage de l'investigation.</p>
      </div>

      {decided ? (
        <div className="space-y-3">
          {legacy ? (
            <p className="text-xs text-slate-500 italic">
              Décision historique actée à la création de cette NC (voir « Actions immédiates mises en place » ci-dessus).
            </p>
          ) : (actionsImmediates || []).length > 0 ? (
            <div className="space-y-2">
              {actionsImmediates.map(a => (
                <ActionImmediateRow key={a.id} action={a} user={user} isQHSE={isQHSE} onMarkDone={handleMarkDone} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">Aucune action immédiate jugée nécessaire.</p>
          )}
        </div>
      ) : (
        <>
          {/* Question obligatoire Oui / Non */}
          <div>
            <Label className="text-sm font-medium">Des actions immédiates sont-elles nécessaires ? <span className="text-red-500">*</span></Label>
            <div className="flex gap-3 mt-2">
              {["oui", "non"].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setReponse(val)}
                  className={`px-6 py-2.5 rounded-xl border-2 text-sm font-medium transition-all
                    ${reponse === val
                      ? val === "oui" ? "bg-green-50 border-green-500 text-green-700" : "bg-red-50 border-red-400 text-red-700"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
                >
                  {val === "oui" ? "✅ Oui" : "❌ Non"}
                </button>
              ))}
            </div>
            <FieldError show={attempted && reponse === null} message="Veuillez indiquer si des actions immédiates sont nécessaires." />
          </div>

          {reponse === "non" && (
            <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg p-3">
              Aucune action immédiate ne sera créée — la décision sera enregistrée pour tracer que la question a été tranchée.
            </p>
          )}

          {reponse === "oui" && (
            <div className="space-y-3">
              {actions.map((a, i) => (
                <div key={i} className="bg-white border border-blue-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-blue-800">Action #{i + 1}</span>
                    {actions.length > 1 && (
                      <button type="button" onClick={() => removeActionRow(i)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Description <span className="text-red-500">*</span></Label>
                    <Textarea value={a.description} onChange={e => updateAction(i, "description", e.target.value)} placeholder="Décrire l'action immédiate à mener..." rows={2} className="mt-1" />
                    <FieldError show={attempted && !a.description.trim()} message="Veuillez décrire l'action immédiate." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Processus responsable <span className="text-red-500">*</span></Label>
                      <Select value={a.responsable} onValueChange={v => updateAction(i, "responsable", v)}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent>
                          {PROCESSUS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FieldError show={attempted && !a.responsable} message="Veuillez sélectionner le processus responsable." />
                    </div>
                    <div>
                      <Label className="text-xs">Échéance (max J+2) <span className="text-red-500">*</span></Label>
                      <Input type="date" value={a.dateFinPrevue} onChange={e => updateAction(i, "dateFinPrevue", e.target.value)} min={todayStr} max={maxJ2} className="mt-1" />
                      <FieldError show={attempted && !a.dateFinPrevue} message="Veuillez renseigner une échéance." />
                      <FieldError show={attempted && !!a.dateFinPrevue && (a.dateFinPrevue < todayStr || a.dateFinPrevue > maxJ2)} message="L'échéance doit être comprise entre aujourd'hui et J+2 (48h)." />
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addActionRow} className="w-full border-dashed border-blue-300 text-blue-600 hover:bg-blue-50">
                <Plus className="w-4 h-4 mr-2" /> Ajouter une action
              </Button>
            </div>
          )}

          <Button onClick={handleValider} disabled={validating} className="bg-blue-600 hover:bg-blue-700">
            {validating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {validating ? "Enregistrement..." : reponse === "non" ? "Enregistrer la décision" : "Valider les actions immédiates"}
          </Button>
        </>
      )}
    </div>
  );
}