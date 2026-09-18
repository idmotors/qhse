import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import { format } from "date-fns";
import { Eye, Trash2, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const NC_STATUTS = ["Ouverte", "En investigation", "En cours de traitement", "En retard", "En vérification d'efficacité", "Clôturée"];
const DEPARTEMENTS = ["Management", "SMQ", "Commercial", "Transport de marchandises", "Location", "Ressources humaines", "Facturation et recouvrement", "Amélioration continue", "Service Rapide", "Achats", "Système d'information", "Maintenance"];

export default function NCTable({ ncs, showInitiateur = true, isQHSE = false, canDelete = true, readOnlyWhen }) {
  const queryClient = useQueryClient();
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [filterStatut, setFilterStatut] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const filteredNcs = useMemo(() => {
    return ncs.filter(nc => {
      if (filterStatut !== "all" && nc.statut !== filterStatut) return false;
      if (filterDept !== "all" && nc.departement !== filterDept) return false;
      if (filterDateFrom && nc.dateConstatation && nc.dateConstatation < filterDateFrom) return false;
      if (filterDateTo && nc.dateConstatation && nc.dateConstatation > filterDateTo) return false;
      return true;
    });
  }, [ncs, filterStatut, filterDept, filterDateFrom, filterDateTo]);

  const hasFilters = filterStatut !== "all" || filterDept !== "all" || filterDateFrom || filterDateTo;

  const resetFilters = () => {
    setFilterStatut("all");
    setFilterDept("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.NonConformite.delete(toDelete.id);
    // Supprimer les actions liées
    const linkedActions = await base44.entities.Action.filter({ ncId: toDelete.id });
    await Promise.all(linkedActions.map(a => base44.entities.Action.delete(a.id)));
    queryClient.invalidateQueries({ queryKey: ["mes-ncs"] });
    queryClient.invalidateQueries({ queryKey: ["ncs-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["traitement-ncs"] });
    setDeleting(false);
    setToDelete(null);
  };

  return (
    <>
      {/* Barre de filtres */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {NC_STATUTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue placeholder="Tous les départements" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les processus</SelectItem>
              {DEPARTEMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 whitespace-nowrap">Du</span>
            <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="h-8 text-xs w-36" />
            <span className="text-xs text-slate-500">au</span>
            <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="h-8 text-xs w-36" />
          </div>

          {hasFilters && (
            <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors">
              <X className="w-3.5 h-3.5" /> Réinitialiser
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-400 whitespace-nowrap">
              {filteredNcs.length} / {ncs.length} NC{ncs.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {filteredNcs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-slate-400">{ncs.length === 0 ? "Aucune NC trouvée" : "Aucune NC ne correspond aux filtres"}</p>
          {hasFilters && <button onClick={resetFilters} className="mt-2 text-xs text-blue-600 hover:underline">Effacer les filtres</button>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold text-slate-700">N° NC</TableHead>
                <TableHead className="font-semibold text-slate-700">Statut</TableHead>
                {showInitiateur && <TableHead className="font-semibold text-slate-700">Initiateur</TableHead>}
                <TableHead className="font-semibold text-slate-700">Source</TableHead>
                <TableHead className="font-semibold text-slate-700">Département</TableHead>
                <TableHead className="font-semibold text-slate-700">Date</TableHead>
                <TableHead className="font-semibold text-slate-700">Circuit</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNcs.map((nc, i) => {
                const isLate = nc.statut === "En retard";
                return (
                  <TableRow key={nc.id} className={`${isLate ? "bg-red-50" : i % 2 === 1 ? "bg-slate-50/50" : ""} hover:bg-blue-50/50 transition-colors`}>
                    <TableCell className="font-medium text-slate-900">{nc.numero}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusBadge statut={nc.statut} />
                        {readOnlyWhen && readOnlyWhen(nc) && (
                          <span
                            className="text-[10px] uppercase tracking-wide text-slate-400 border border-slate-200 rounded-full px-1.5 py-0.5 whitespace-nowrap"
                            title="Lecture seule à partir de l'étape Vérification (relais QHSE)"
                          >
                            Lecture seule
                          </span>
                        )}
                      </div>
                    </TableCell>
                    {showInitiateur && <TableCell className="text-slate-600">{nc.initiateur}</TableCell>}
                    <TableCell className="text-slate-600">{nc.source}</TableCell>
                    <TableCell className="text-slate-600">{nc.departement}</TableCell>
                    <TableCell className="text-slate-600">{nc.created_date ? format(new Date(nc.created_date), "dd/MM/yyyy") : "-"}</TableCell>
                    <TableCell className="text-slate-600">{nc.circuitCreation}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link to={`/NCDetail?id=${nc.id}`} className="text-blue-600 hover:text-blue-800">
                          <Eye className="w-4 h-4" />
                        </Link>
                        {canDelete && (isQHSE || nc.statut === "Ouverte") && (
                          <button
                            onClick={() => setToDelete(nc)}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                            title="Supprimer cette NC"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <DeleteConfirmDialog
        open={!!toDelete}
        title="Supprimer la NC ?"
        description={`La NC "${toDelete?.numero}" sera définitivement supprimée. Cette action est irréversible.`}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        loading={deleting}
      />
    </>
  );
}