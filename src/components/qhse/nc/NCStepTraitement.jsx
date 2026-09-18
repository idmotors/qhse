import React from "react";
import ActionsList from "@/components/qhse/ActionsList";
import { isActionDone } from "@/components/qhse/actionUtils";

export default function NCStepTraitement({ nc, actions, ncId, isQHSE, isResponsableProcessus, user, inefficaceActionIds, onRefreshActions }) {
  const activeActions = actions.filter(a => !inefficaceActionIds.includes(a.id));
  const allActionsRealized = activeActions.length > 0 && activeActions.every(a => isActionDone(a));
  const isEditable = nc.statut === "En cours de traitement" || nc.statut === "En retard";

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
      <h2 className="text-sm font-semibold text-slate-900">Traitement des actions</h2>

      {nc.actionEfficace === false && isEditable && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          ⚠ L'action précédente a été jugée inefficace. Les actions marquées "Inefficace" sont en lecture seule. Veuillez définir une nouvelle action corrective.
        </div>
      )}

      <ActionsList
        ncId={ncId}
        ncNumero={nc.numero}
        ncTitre={nc.titre}
        ncInitiateurEmail={nc.initiateurEmail}
        actions={actions}
        onRefresh={onRefreshActions}
        isQHSE={isQHSE}
        isResponsableProcessus={isResponsableProcessus}
        ncResponsablesProcessus={nc.responsablesProcessus || []}
        isEditable={isEditable}
        userEmail={user?.email}
        user={user}
        ncStatut={nc.statut}
        mode="traitement"
        inefficaceActionIds={inefficaceActionIds}
      />

      {!allActionsRealized && activeActions.length > 0 && (isQHSE || isResponsableProcessus) && isEditable && (
        <p className="text-xs text-orange-600">⚠ Toutes les actions actives doivent être terminées avant de passer à la vérification.</p>
      )}
    </div>
  );
}