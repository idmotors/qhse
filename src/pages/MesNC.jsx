import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useUserRole } from "@/components/qhse/useUserRole";
import { useMesProcessus } from "@/components/qhse/useMesProcessus";
import NCTable from "@/components/qhse/NCTable";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import ExportPanel from "@/components/qhse/export/ExportPanel";
import { NC_EXPORT_COLUMNS } from "@/components/qhse/export/exportColumns";

export default function MesNC() {
  const { user, isQHSE, isCollaborateur, isDirection, loading } = useUserRole();

  const { mesProcessus, isLoading: processusLoading } = useMesProcessus(user, !loading);
  const { data: ncs = [], isLoading } = useQuery({
    queryKey: ["mes-ncs", user?.email, mesProcessus.join(",")],
    queryFn: async () => {
      const all = await base44.entities.NonConformite.list("-created_date", 500);
      // Règle « Mes NC » (tous profils) : fiches dont le processus demandeur est
      // piloté par l'utilisateur, ou déclarées personnellement par l'utilisateur.
      return all.filter(nc =>
        mesProcessus.includes(nc.processusDemandeur) || nc.initiateurEmail === user.email
      );
    },
    enabled: !!user && !loading && !processusLoading,
  });

  if (loading || processusLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mes Non-Conformités</h1>
          <p className="text-sm text-slate-500 mt-1">{ncs.length} NC{ncs.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportPanel
            items={ncs}
            columns={NC_EXPORT_COLUMNS}
            title="Mes Non-Conformités"
            fileName="mes-non-conformites"
            sheetName="NC"
            fetchAll={async () => {
              const all = await base44.entities.NonConformite.list("-created_date", 1000);
              return all.filter(nc =>
                mesProcessus.includes(nc.processusDemandeur) || nc.initiateurEmail === user.email
              );
            }}
          />
          {!isDirection && (
            <Link to="/CreateNC">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Déclarer une NC
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <NCTable
          ncs={ncs}
          showInitiateur={!isCollaborateur}
          isQHSE={isQHSE}
        />
      </div>
    </div>
  );
}