import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollText, X, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { JOURNAL_TYPES } from "./journalUtils";
import { parseStoredDate } from "@/components/qhse/dateFormat";

const PAGE_SIZE = 15;

const TYPE_COLORS = {
  "Création NC": "bg-blue-100 text-blue-700",
  "Changement de statut": "bg-amber-100 text-amber-700",
  "Action corrective": "bg-violet-100 text-violet-700",
  "Vérification efficacité": "bg-cyan-100 text-cyan-700",
  "Clôture NC": "bg-green-100 text-green-700",
  "Suppression NC": "bg-red-100 text-red-700",
  "Invitation utilisateur": "bg-slate-100 text-slate-700",
  "Suppression utilisateur": "bg-red-100 text-red-700",
  "Modification droits": "bg-indigo-100 text-indigo-700",
  "Gestion processus": "bg-teal-100 text-teal-700",
};

export default function JournalActivite() {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["journal-activite"],
    queryFn: () => base44.entities.JournalActivite.list("-created_date", 500),
  });

  const [filterUser, setFilterUser] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [page, setPage] = useState(1);

  // Liste distincte des utilisateurs ayant agi
  const users = useMemo(() => {
    const map = new Map();
    entries.forEach(e => {
      const key = e.auteurEmail || e.auteurNom;
      if (key) map.set(key, e.auteurNom || e.auteurEmail);
    });
    return Array.from(map.entries()).map(([key, nom]) => ({ key, nom }));
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (filterUser !== "all" && (e.auteurEmail || e.auteurNom) !== filterUser) return false;
      if (filterType !== "all" && e.type !== filterType) return false;
      const day = e.created_date ? format(parseStoredDate(e.created_date), "yyyy-MM-dd") : "";
      if (filterFrom && day < filterFrom) return false;
      if (filterTo && day > filterTo) return false;
      return true;
    });
  }, [entries, filterUser, filterType, filterFrom, filterTo]);

  useEffect(() => { setPage(1); }, [filterUser, filterType, filterFrom, filterTo]);

  const hasFilters = filterUser !== "all" || filterType !== "all" || filterFrom || filterTo;
  const resetFilters = () => { setFilterUser("all"); setFilterType("all"); setFilterFrom(""); setFilterTo(""); };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <ScrollText className="w-4 h-4" /> Journal d'activité
        </h2>
        <p className="text-xs text-slate-500 mt-1">Historique en lecture seule des actions effectuées sur la plateforme.</p>
      </div>

      {/* Filtres */}
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-2">
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="h-8 w-48 text-xs"><SelectValue placeholder="Tous les utilisateurs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les utilisateurs</SelectItem>
            {users.map(u => <SelectItem key={u.key} value={u.key}>{u.nom}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 w-48 text-xs"><SelectValue placeholder="Tous les types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {JOURNAL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 whitespace-nowrap">Du</span>
          <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="h-8 text-xs w-36" />
          <span className="text-xs text-slate-500">au</span>
          <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="h-8 text-xs w-36" />
        </div>

        {hasFilters && (
          <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors">
            <X className="w-3.5 h-3.5" /> Réinitialiser
          </button>
        )}

        <span className="ml-auto text-xs text-slate-400 whitespace-nowrap">
          {filtered.length} entrée{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="p-6 text-center text-sm text-slate-400">Chargement…</div>
      ) : pageItems.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-400">
          {entries.length === 0 ? "Aucune activité enregistrée" : "Aucune entrée ne correspond aux filtres"}
          {hasFilters && <button onClick={resetFilters} className="mt-2 block mx-auto text-xs text-blue-600 hover:underline">Effacer les filtres</button>}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
          {pageItems.map(e => (
            <div key={e.id} className="p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[e.type] || "bg-slate-100 text-slate-700"}`}>{e.type}</span>
                  <span className="text-sm font-medium text-slate-800 truncate">{e.element || "—"}</span>
                </div>
                {e.details && <p className="text-xs text-slate-500 mt-1">{e.details}</p>}
                <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                  <span>{e.auteurNom || e.auteurEmail || "—"}</span>
                  <span>·</span>
                  <span>{e.created_date ? format(parseStoredDate(e.created_date), "dd/MM/yyyy HH:mm") : "—"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">Page {currentPage} / {totalPages}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="inline-flex items-center gap-1 text-xs text-slate-600 disabled:opacity-40 hover:text-slate-900">
              <ChevronLeft className="w-4 h-4" /> Précédent
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="inline-flex items-center gap-1 text-xs text-slate-600 disabled:opacity-40 hover:text-slate-900">
              Suivant <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}