import React from "react";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { getCauseRacine } from "@/components/qhse/nc/causeRacineUtils";

export default function NCStepCloturee({ nc, actions, inefficaceActionIds }) {
  const activeActions = actions.filter(a => !inefficaceActionIds.includes(a.id));

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
      <h2 className="text-sm font-semibold text-slate-900">Récapitulatif — NC Clôturée</h2>

      {/* Dates */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <Label className="text-xs text-slate-500">Date de clôture</Label>
          <p className="font-medium mt-1">{nc.dateCloture ? format(new Date(nc.dateCloture), "dd/MM/yyyy") : "—"}</p>
        </div>
        <div>
          <Label className="text-xs text-slate-500">Délai effectif</Label>
          <p className="font-medium mt-1">{nc.delaiTraitementEffectif || 0} jours</p>
        </div>
        <div>
          <Label className="text-xs text-slate-500">Clôturée dans les délais</Label>
          <p className={`font-medium mt-1 ${nc.clotureDansDelai ? "text-green-600" : "text-red-600"}`}>
            {nc.clotureDansDelai ? "✅ Oui" : "❌ Non"}
          </p>
        </div>
      </div>

      {/* Écart & corrections */}
      <div className="space-y-3">
        <div>
          <Label className="text-xs text-slate-500">Écart constaté</Label>
          <p className="text-sm text-slate-700 mt-1 bg-slate-50 rounded-lg p-3">{nc.ecartConstate}</p>
        </div>
        <div>
          <Label className="text-xs text-slate-500">Corrections immédiates</Label>
          <p className="text-sm text-slate-700 mt-1 bg-slate-50 rounded-lg p-3">{nc.correctionsImmediates}</p>
        </div>
      </div>

      {/* Investigation */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Investigation</h3>
        <div>
          <Label className="text-xs text-slate-500">Cause racine</Label>
          <p className="text-sm text-slate-700 mt-1 bg-slate-50 rounded-lg p-3">{getCauseRacine(nc) || "—"}</p>
        </div>
        <div>
          <Label className="text-xs text-slate-500">Critères d'efficacité</Label>
          <p className="text-sm text-slate-700 mt-1 bg-slate-50 rounded-lg p-3">{nc.criteresEfficacite || "—"}</p>
        </div>
        {nc.echeanceFixeeQHSE && (
          <div>
            <Label className="text-xs text-slate-500">Échéance fixée par QHSE</Label>
            <p className="text-sm text-slate-700 mt-1">{format(new Date(nc.echeanceFixeeQHSE), "dd/MM/yyyy")}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="pt-2 border-t border-slate-100">
        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">Actions correctives ({activeActions.length})</h3>
        <div className="space-y-2">
          {activeActions.map(action => (
            <div key={action.id} className="bg-slate-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-slate-800">{action.description}</p>
              <div className="flex gap-3 mt-1 text-xs text-slate-500">
                <span>Responsable : {action.responsableNom || action.responsable}</span>
                {action.dateRealisationEffective && (
                  <span className="text-green-600">Réalisée le {format(new Date(action.dateRealisationEffective), "dd/MM/yyyy")}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vérification */}
      <div className="pt-2 border-t border-slate-100">
        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Vérification d'efficacité</h3>
        {nc.criteresVerification && (
          <div>
            <Label className="text-xs text-slate-500">Critères de vérification</Label>
            <p className="text-sm text-slate-700 mt-1 bg-slate-50 rounded-lg p-3">{nc.criteresVerification}</p>
          </div>
        )}
        <div>
          <Label className="text-xs text-slate-500">Résultats</Label>
          <p className="text-sm text-slate-700 mt-1 bg-slate-50 rounded-lg p-3">{nc.resultatsVerification || "—"}</p>
        </div>
        {nc.verifiePar && (
          <p className="text-xs text-slate-500 mt-2">Vérifié par : {nc.verifiePar}</p>
        )}
      </div>
    </div>
  );
}