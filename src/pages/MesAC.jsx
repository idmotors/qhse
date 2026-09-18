import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/components/qhse/useUserRole";
import { useMesProcessus } from "@/components/qhse/useMesProcessus";
import StatusBadge from "@/components/qhse/StatusBadge";
import DeleteConfirmDialog from "@/components/qhse/DeleteConfirmDialog";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ExportPanel from "@/components/qhse/export/ExportPanel";
import { AC_EXPORT_COLUMNS } from "@/components/qhse/export/exportColumns";

export default function MesAC() {
  const { user, isQHSE, isDirection, loading } = useUserRole();
  const queryClient = useQueryClient();
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const linkedActions = await base44.entities.ActionAmelioration.filter({ acId: toDelete.id });
    await Promise.all(linkedActions.map(a => base44.entities.ActionAmelioration.delete(a.id)));
    await base44.entities.AmeliorationContinue.delete(toDelete.id);
    queryClient.invalidateQueries({ queryKey: ["mes-ac"] });
    queryClient.invalidateQueries({ queryKey: ["ac-dashboard"] });
    setDeleting(false);
    setToDelete(null);
  };

  const { mesProcessus, isLoading: processusLoading } = useMesProcessus(user, !loading);
  const { data: acs = [], isLoading } = useQuery({
    queryKey: ["mes-ac", user?.email, mesProcessus.join(",")],
    queryFn: async () => {
      const all = await base44.entities.AmeliorationContinue.list("-created_date", 500);
      // Règle « Mes AC » (tous profils) : fiches dont le processus initiateur est
      // piloté par l'utilisateur, ou soumises personnellement par l'utilisateur.
      return all.filter(ac =>
        mesProcessus.includes(ac.processusInitiateur) || ac.initiateurEmail === user.email
      );
    },
    enabled: !!user && !processusLoading,
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
          <h1 className="text-2xl font-bold text-slate-900">Amélioration continue</h1>
          <p className="text-sm text-slate-500 mt-1">{acs.length} AC</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportPanel
            items={acs}
            columns={AC_EXPORT_COLUMNS}
            title="Amélioration continue — fiches"
            fileName="amelioration-continue"
            sheetName="AC"
            fetchAll={async () => {
              const all = await base44.entities.AmeliorationContinue.list("-created_date", 1000);
              return all.filter(ac =>
                mesProcessus.includes(ac.processusInitiateur) || ac.initiateurEmail === user.email
              );
            }}
          />
          {!isDirection && (
            <Link to="/CreateAC">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle AC
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {acs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-slate-400">Aucune AC trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold text-slate-700">N° AC</TableHead>
                  <TableHead className="font-semibold text-slate-700">Processus initiateur</TableHead>
                  <TableHead className="font-semibold text-slate-700">Source</TableHead>
                  <TableHead className="font-semibold text-slate-700">Statut</TableHead>
                  <TableHead className="font-semibold text-slate-700">Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acs.map((ac, i) => (
                  <TableRow key={ac.id} className={`${i % 2 === 1 ? "bg-slate-50/50" : ""} hover:bg-blue-50/50 transition-colors`}>
                    <TableCell className="font-medium text-slate-900">{ac.numero}</TableCell>
                    <TableCell className="text-slate-600">{ac.processusInitiateur}</TableCell>
                    <TableCell className="text-slate-600">{ac.source}</TableCell>
                    <TableCell><StatusBadge statut={ac.statut} type="ac" /></TableCell>
                    <TableCell className="text-slate-600">{ac.created_date ? format(new Date(ac.created_date), "dd/MM/yyyy") : "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {ac.statut === "Brouillon" && (isQHSE || user?.email === ac.initiateurEmail) ? (
                          <Link to={`/CreateAC?draftId=${ac.id}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                            Continuer
                          </Link>
                        ) : (
                          <Link to={`/ACDetail?id=${ac.id}`} className="text-blue-600 hover:text-blue-800">
                            <Eye className="w-4 h-4" />
                          </Link>
                        )}
                        {(isQHSE || (user?.email === ac.initiateurEmail && ["Brouillon", "À traiter"].includes(ac.statut))) && (
                          <button
                            onClick={() => setToDelete(ac)}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                            title="Supprimer cette AC"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <DeleteConfirmDialog
        open={!!toDelete}
        title="Supprimer l'AC ?"
        description={`L'AC "${toDelete?.numero}" sera définitivement supprimée. Cette action est irréversible.`}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        loading={deleting}
      />
    </div>
  );
}