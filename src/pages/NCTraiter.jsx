import React from "react";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/components/qhse/useUserRole";
import { useNcATraiter, STATUTS_ACTION } from "@/components/qhse/useNcATraiter";
import { useMesProcessus } from "@/components/qhse/useMesProcessus";
import NCTable from "@/components/qhse/NCTable";
import ExportPanel from "@/components/qhse/export/ExportPanel";
import { NC_EXPORT_COLUMNS } from "@/components/qhse/export/exportColumns";

export default function NCTraiter() {
  const { user, isCollaborateur, loading } = useUserRole();
  const { ncs, nbATraiter, isLoading } = useNcATraiter(user, !loading);
  const { mesProcessus } = useMesProcessus(user, !loading);

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  const nbLectureSeule = ncs.length - nbATraiter;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">NC à traiter</h1>
          <ExportPanel
            items={ncs}
            columns={NC_EXPORT_COLUMNS}
            title="NC à traiter"
            fileName="nc-a-traiter"
            sheetName="NC"
            // Export aligné sur la liste : NC assignées à vos processus,
            // hors NC initiées par vos processus (exclusivité « Mes NC »)
            fetchAll={async () => {
              const list = await base44.entities.NonConformite.list("-created_date", 1000);
              return list.filter(
                (n) =>
                  (n.responsablesProcessus || []).includes(user?.email) &&
                  n.initiateurEmail !== user?.email &&
                  !mesProcessus.includes(n.processusDemandeur)
              );
            }}
          />
        </div>
        <p className="text-sm text-slate-500 mt-1">
          {nbATraiter} NC{nbATraiter > 1 ? "s" : ""} nécessitant votre action
          {nbLectureSeule > 0 && ` · ${nbLectureSeule} en lecture seule (vérification/clôture)`}
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Non-conformités assignées à un processus dont vous êtes pilote. Vous disposez des droits de
          traitement jusqu'à la vérification d'efficacité, assurée par la QHSE.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <NCTable
          ncs={ncs}
          showInitiateur={!isCollaborateur}
          canDelete={false}
          readOnlyWhen={(nc) => !STATUTS_ACTION.includes(nc.statut)}
        />
      </div>
    </div>
  );
}