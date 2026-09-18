import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { format } from "date-fns";
import { normalizePiece } from "@/components/qhse/fileUtils";
import ActionsImmediatesCard from "@/components/qhse/nc/ActionsImmediatesCard";
import { isActionsImmediatesDecidees } from "@/components/qhse/nc/ActionsImmediatesCard";
import FieldError from "@/components/qhse/FieldError";

export default function NCStepOuverte({ nc, canStartInvestigation, saving, onStartInvestigation, user, isQHSE, actionsImmediates = [] }) {
  const decisionPrise = isActionsImmediatesDecidees(nc);
  const [startAttempted, setStartAttempted] = useState(false);
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Ouverture de la NC</h2>

        {/* Titre */}
        {nc.titre && (
          <div>
            <Label className="text-xs text-slate-500">Titre</Label>
            <p className="text-sm font-medium text-slate-800 mt-1">{nc.titre}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          {nc.dateConstatation && (
            <div>
              <Label className="text-xs text-slate-500">Date de constatation</Label>
              <p className="font-medium mt-1">{format(new Date(nc.dateConstatation), "dd/MM/yyyy")}</p>
            </div>
          )}
          {nc.processusConcerne && (
            <div>
              <Label className="text-xs text-slate-500">Processus concerné</Label>
              <p className="font-medium mt-1">{nc.processusConcerne}</p>
            </div>
          )}
          {nc.source && (
            <div>
              <Label className="text-xs text-slate-500">Source</Label>
              <p className="font-medium mt-1">{nc.source}</p>
            </div>
          )}
        </div>

        <div>
          <Label className="text-xs text-slate-500">Description de l'écart / constatation</Label>
          <p className="text-sm text-slate-700 mt-1 bg-slate-50 rounded-lg p-3">{nc.ecartConstate}</p>
        </div>

        {/* Actions immédiates */}
        {nc.actionsImmediatesRequises === true && nc["actionsImmédiates"]?.length > 0 && (
          <div>
            <Label className="text-xs text-slate-500">Actions immédiates mises en place</Label>
            <div className="space-y-2 mt-2">
              {nc["actionsImmédiates"].map((a, i) => (
                <div key={i} className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <p className="font-medium text-blue-800">{a.description}</p>
                  <div className="flex gap-3 mt-1 text-xs text-blue-600">
                    <span>Responsable : {a.responsableNom || a.responsable}</span>
                    {a.echeance && <span>Échéance : {format(new Date(a.echeance), "dd/MM/yyyy")}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {nc.actionsImmediatesRequises === false && (
          <div>
            <Label className="text-xs text-slate-500">Actions immédiates</Label>
            <p className="text-sm text-slate-500 mt-1 italic">Aucune action immédiate déclarée</p>
          </div>
        )}

        {nc.derogationRequise && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
            <span className="font-medium text-amber-800">Dérogation :</span> du{" "}
            {nc.derogationDateDebut ? format(new Date(nc.derogationDateDebut), "dd/MM/yyyy") : "-"} au{" "}
            {nc.derogationDateEcheance ? format(new Date(nc.derogationDateEcheance), "dd/MM/yyyy") : "-"}
          </div>
        )}

        {nc.piecesJointes?.length > 0 && (
          <div>
            <Label className="text-xs text-slate-500">Pièces jointes</Label>
            <div className="flex gap-2 flex-wrap mt-2">
              {nc.piecesJointes.map((item, i) => {
                const p = normalizePiece(item);
                return (
                  <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" title={p.nom}
                    className="text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded max-w-[220px] truncate">
                    {p.nom}
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Prise en charge : QHSE ou responsable du processus assigné (identifié automatiquement) */}
      {canStartInvestigation && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Prise en charge</h3>
          <p className="text-xs text-slate-500">
            Cette NC est attribuée au processus <span className="font-medium text-slate-700">{nc.processusConcerne || nc.processusAssigné}</span>.
            Le responsable du processus est identifié automatiquement — démarrer l'investigation pour commencer le traitement.
          </p>
          {/* Décision « Actions immédiates » — obligatoire avant de démarrer l'investigation,
              puis affichage en lecture des actions déclarées (avec marquage « Réalisée ») */}
          <ActionsImmediatesCard nc={nc} user={user} isQHSE={isQHSE} actionsImmediates={actionsImmediates} />
          {/* Bouton d'action seulement si la NC est encore Ouverte */}
          {nc.statut === "Ouverte" ? (
            <div>
              <Button
                onClick={() => {
                  if (!decisionPrise) { setStartAttempted(true); return; }
                  onStartInvestigation();
                }}
                disabled={saving}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {saving
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 inline-block" />
                  : <Search className="w-4 h-4 mr-2" />}
                Démarrer l'investigation
              </Button>
              <FieldError show={startAttempted && !decisionPrise} message="Veuillez indiquer si des actions immédiates sont nécessaires avant de démarrer l'investigation." />
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <Search className="w-4 h-4" /> Investigation déjà démarrée
            </div>
          )}
        </div>
      )}
    </div>
  );
}