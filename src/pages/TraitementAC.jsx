import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useUserRole } from "@/components/qhse/useUserRole";
import StatusBadge from "@/components/qhse/StatusBadge";
import DeclareACButton from "@/components/qhse/DeclareACButton";
import { Link } from "react-router-dom";
import { Eye, X, Filter } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SOURCES, PROCESSUS } from "@/components/qhse/constants";
import ExportPanel from "@/components/qhse/export/ExportPanel";
import { AC_EXPORT_COLUMNS } from "@/components/qhse/export/exportColumns";

const STATUTS = ["Brouillon", "À traiter", "En cours", "Clôturée", "Abandonnée"];

/**
 * Traitement des AC (vue QHSE / Direction) : toutes les fiches d'amélioration
 * continue avec filtres persistants, sur le même modèle que Traitement des NC.
 */
export default function TraitementAC() {
  const { isQHSE, isDirection, loading } = useUserRole();
  const [filters, setFilters] = useState({
    statut: "", source: "", processus: "", dateFrom: "", dateTo: "",
  });

  const { data: acs = [], isLoading } = useQuery({
    queryKey: ["traitement-acs"],
    queryFn: () => base44.entities.AmeliorationContinue.list("-created_date", 500),
  });

  const filteredACs = useMemo(() => {
    return acs.filter(ac => {
      if (filters.statut && ac.statut !== filters.statut) return false;
      if (filters.source && ac.source !== filters.source) return false;
      if (filters.processus && ac.processusInitiateur !== filters.processus) return false;
      if (filters.dateFrom && ac.created_date && new Date(ac.created_date) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && ac.created_date && new Date(ac.created_date) > new Date(filters.dateTo)) return false;
      return true;
    });
  }, [acs, filters]);

  const activeFilters = Object.entries(filters).filter(([_, v]) => v);

  const clearFilter = (key) => setFilters(prev => ({ ...prev, [key]: "" }));
  const clearAll = () => setFilters({ statut: "", source: "", processus: "", dateFrom: "", dateTo: "" });

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isQHSE && !isDirection) {
    return <div className="text-center py-20 text-slate-500">Accès non autorisé</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Traitement des AC</h1>
          <ExportPanel
            items={filteredACs}
            columns={AC_EXPORT_COLUMNS}
            title="Traitement des AC"
            fileName="traitement-ac"
            sheetName="AC"
            fetchAll={() => base44.entities.AmeliorationContinue.list("-created_date", 1000)}
          />
        </div>
        <p className="text-sm text-slate-500 mt-1">{filteredACs.length} fiche{filteredACs.length > 1 ? "s" : ""} AC trouvée{filteredACs.length > 1 ? "s" : ""}</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Filtres</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Select value={filters.statut} onValueChange={v => setFilters(p => ({ ...p, statut: v }))}>
            <SelectTrigger className="text-xs"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              {STATUTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.source} onValueChange={v => setFilters(p => ({ ...p, source: v }))}>
            <SelectTrigger className="text-xs"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.processus} onValueChange={v => setFilters(p => ({ ...p, processus: v }))}>
            <SelectTrigger className="text-xs"><SelectValue placeholder="Processus initiateur" /></SelectTrigger>
            <SelectContent>
              {PROCESSUS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" placeholder="Date début" value={filters.dateFrom} onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))} className="text-xs" />
          <Input type="date" placeholder="Date fin" value={filters.dateTo} onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))} className="text-xs" />
        </div>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {activeFilters.map(([key, value]) => (
              <span key={key} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-1 rounded-full">
                {value}
                <button onClick={() => clearFilter(key)} className="hover:text-blue-900"><X className="w-3 h-3" /></button>
              </span>
            ))}
            <button onClick={clearAll} className="text-xs text-red-500 hover:underline">Réinitialiser</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {filteredACs.length === 0 ? (
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
                  <TableHead className="font-semibold text-slate-700">Initiateur</TableHead>
                  <TableHead className="font-semibold text-slate-700">Statut</TableHead>
                  <TableHead className="font-semibold text-slate-700">Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredACs.map((ac, i) => (
                  <TableRow key={ac.id} className={`${i % 2 === 1 ? "bg-slate-50/50" : ""} hover:bg-blue-50/50 transition-colors`}>
                    <TableCell className="font-medium text-slate-900">{ac.numero || "-"}</TableCell>
                    <TableCell className="text-slate-600">{ac.processusInitiateur || "-"}</TableCell>
                    <TableCell className="text-slate-600">{ac.source || "-"}</TableCell>
                    <TableCell className="text-slate-600">{ac.initiateur || "-"}</TableCell>
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

      {/* Bouton flottant : déclarer une AC */}
      <DeclareACButton />
    </div>
  );
}