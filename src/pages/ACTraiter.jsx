import React from "react";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/components/qhse/useUserRole";
import { useAcATraiter } from "@/components/qhse/useAcATraiter";
import { useMesProcessus } from "@/components/qhse/useMesProcessus";
import ExportPanel from "@/components/qhse/export/ExportPanel";
import { AC_EXPORT_COLUMNS } from "@/components/qhse/export/exportColumns";
import StatusBadge from "@/components/qhse/StatusBadge";
import { Link } from "react-router-dom";
import { Eye } from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ACTraiter() {
  const { user, loading } = useUserRole();
  const { acs, myActions, nbATraiter, isLoading } = useAcATraiter(user, !loading);
  const { mesProcessus } = useMesProcessus(user, !loading);

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  const countMyActions = (acId) => myActions.filter(a => a.acId === acId).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AC à traiter</h1>
          <p className="text-sm text-slate-500 mt-1">
            {nbATraiter} fiche{nbATraiter > 1 ? "s" : ""} AC avec des actions vous concernant
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Fiches d'amélioration continue contenant au moins une action assignée à un processus dont vous êtes pilote.
            Vous disposez des droits de traitement jusqu'à la réalisation de l'action ; la clôture finale de la fiche
            revient à l'initiateur ou à la QHSE.
          </p>
        </div>
        <ExportPanel
          items={acs}
          columns={AC_EXPORT_COLUMNS}
          title="AC à traiter"
          fileName="ac-a-traiter"
          sheetName="AC"
          // Export aligné sur la liste : actions en cours vous concernant,
          // hors fiches initiées par vos processus (exclusivité « Mes AC »)
          fetchAll={async () => {
            const actions = await base44.entities.ActionAmelioration.list("-created_date", 1000);
            const ids = [
              ...new Set(
                actions
                  .filter((a) => (a.responsablesProcessus || []).includes(user?.email) && a.statut === "En cours")
                  .map((a) => a.acId)
                  .filter(Boolean)
              ),
            ];
            const fiches = await Promise.all(
              ids.map((id) => base44.entities.AmeliorationContinue.get(id).catch(() => null))
            );
            return fiches.filter(Boolean).filter(
              (ac) => !mesProcessus.includes(ac.processusInitiateur) && ac.initiateurEmail !== user?.email
            );
          }}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {acs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-slate-400">Aucune AC à traiter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold text-slate-700">N° AC</TableHead>
                  <TableHead className="font-semibold text-slate-700">Processus initiateur</TableHead>
                  <TableHead className="font-semibold text-slate-700">Source</TableHead>
                  <TableHead className="font-semibold text-slate-700">Mes actions</TableHead>
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
                    <TableCell className="text-slate-600">{countMyActions(ac.id)}</TableCell>
                    <TableCell><StatusBadge statut={ac.statut} type="ac" /></TableCell>
                    <TableCell className="text-slate-600">{ac.created_date ? format(new Date(ac.created_date), "dd/MM/yyyy") : "-"}</TableCell>
                    <TableCell>
                      <Link to={`/ACDetail?id=${ac.id}`} className="text-blue-600 hover:text-blue-800">
                        <Eye className="w-4 h-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}