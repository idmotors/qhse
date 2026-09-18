import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useUserRole } from "@/components/qhse/useUserRole";
import NCTable from "@/components/qhse/NCTable";
import DeclareNCButton from "@/components/qhse/DeclareNCButton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { X, Filter } from "lucide-react";
import { SOURCES, DEPARTEMENTS } from "@/components/qhse/constants";
import ExportPanel from "@/components/qhse/export/ExportPanel";
import { NC_EXPORT_COLUMNS } from "@/components/qhse/export/exportColumns";

const STATUTS = ["Ouverte", "En investigation", "En cours de traitement", "En retard", "En vérification d'efficacité", "Clôturée"];
const CIRCUITS = ["Automatique", "Numérique", "Papier"];

export default function TraitementNC() {
  const { isQHSE, isDirection, loading } = useUserRole();
  const [filters, setFilters] = useState({
    statut: "", source: "", departement: "", circuit: "", dateFrom: "", dateTo: "",
  });

  const { data: ncs = [], isLoading } = useQuery({
    queryKey: ["traitement-ncs"],
    queryFn: () => base44.entities.NonConformite.list("-created_date", 500),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["all-users"],
    queryFn: () => base44.entities.User.list(),
  });

  const filteredNCs = useMemo(() => {
    return ncs.filter(nc => {
      if (filters.statut && nc.statut !== filters.statut) return false;
      if (filters.source && nc.source !== filters.source) return false;
      if (filters.departement && nc.departement !== filters.departement) return false;
      if (filters.circuit && nc.circuitCreation !== filters.circuit) return false;
      if (filters.dateFrom && nc.created_date && new Date(nc.created_date) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && nc.created_date && new Date(nc.created_date) > new Date(filters.dateTo)) return false;
      return true;
    });
  }, [ncs, filters]);

  const activeFilters = Object.entries(filters).filter(([_, v]) => v);

  const clearFilter = (key) => setFilters(prev => ({ ...prev, [key]: "" }));
  const clearAll = () => setFilters({ statut: "", source: "", departement: "", circuit: "", dateFrom: "", dateTo: "" });

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
          <h1 className="text-2xl font-bold text-slate-900">Traitement des NC</h1>
          <ExportPanel
            items={filteredNCs}
            columns={NC_EXPORT_COLUMNS}
            title="Traitement des NC"
            fileName="traitement-nc"
            sheetName="NC"
            fetchAll={() => base44.entities.NonConformite.list("-created_date", 1000)}
          />
        </div>
        <p className="text-sm text-slate-500 mt-1">{filteredNCs.length} NC trouvée{filteredNCs.length > 1 ? "s" : ""}</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Filtres</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
          <Select value={filters.departement} onValueChange={v => setFilters(p => ({ ...p, departement: v }))}>
            <SelectTrigger className="text-xs"><SelectValue placeholder="Département" /></SelectTrigger>
            <SelectContent>
              {DEPARTEMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.circuit} onValueChange={v => setFilters(p => ({ ...p, circuit: v }))}>
            <SelectTrigger className="text-xs"><SelectValue placeholder="Circuit" /></SelectTrigger>
            <SelectContent>
              {CIRCUITS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
        <NCTable ncs={filteredNCs} />
      </div>

      {/* Bouton flottant : déclarer une NC */}
      <DeclareNCButton />
    </div>
  );
}