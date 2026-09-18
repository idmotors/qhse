import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Building2, History } from "lucide-react";
import { useUserRole } from "@/components/qhse/useUserRole";
import ProcessusHistorique from "@/components/qhse/ProcessusHistorique";

/**
 * « Mon processus » : historique en lecture seule des NC et AC des processus
 * pilotés par l'utilisateur connecté (email présent dans responsableEmails).
 * Accessible à tous les profils — l'accès aux fiches reste régi par les
 * règles de sécurité existantes.
 */
export default function MonProcessus() {
  const { user, loading } = useUserRole();

  const { data: mesProcessus = [], isLoading } = useQuery({
    queryKey: ["mon-processus-pilote", user?.email],
    queryFn: async () => {
      const list = await base44.entities.Processus.list();
      return (list || []).filter(p => (p.responsableEmails || []).includes(user.email));
    },
    enabled: !!user && !loading,
  });

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-indigo-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <History className="w-6 h-6 text-indigo-800" /> Historiques
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Historique des non-conformités et améliorations continues rattachées {mesProcessus.length > 1 ? "aux processus que vous pilotez" : "au processus que vous pilotez"}.
        </p>
      </div>

      {mesProcessus.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Vous n'êtes pas pilote d'un processus</p>
          <p className="text-xs text-slate-400 mt-1">
            Aucun historique à afficher. Si cela vous semble incorrect, contactez l'équipe QHSE.
          </p>
        </div>
      ) : (
        mesProcessus.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">{p.nom}</h2>
              {(p.responsableEmails || []).length > 1 && (
                <span className="text-xs text-slate-400">
                  ({(p.responsableEmails || []).length} pilotes)
                </span>
              )}
            </div>
            <div className="p-5">
              <ProcessusHistorique processus={p} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}