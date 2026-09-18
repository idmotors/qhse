import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { ExternalLink } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const FILTRES = [
  { value: "all", label: "Tous" },
  { value: "en_cours", label: "Ouvertes & en cours" },
  { value: "cloturee", label: "Clôturées" },
  { value: "abandonnee", label: "Abandonnées" },
];

/**
 * Historique en lecture seule des fiches dont ce processus est responsable/pilote :
 * - NC : processusAssigné (ou processusConcerne en rétrocompatibilité) === nom du processus
 * - AC : au moins une action enfant (ActionAmelioration) dont responsable === nom du processus
 */
export default function ProcessusHistorique({ processus }) {
  const nom = processus.nom;
  const [filtre, setFiltre] = useState("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["processus-historique", nom],
    queryFn: async () => {
      const ncs = await base44.entities.NonConformite.list("-created_date", 500).catch(() => []);
      const actions = await base44.entities.ActionAmelioration.filter({ responsable: nom }).catch(() => []);
      const acIds = new Set(actions.map(a => a.acId).filter(Boolean));
      const acs = acIds.size > 0
        ? (await base44.entities.AmeliorationContinue.list("-created_date", 500).catch(() => []))
            .filter(ac => acIds.has(ac.id))
        : [];
      const toRow = (item, type) => {
        const cloturee = item.statut === "Clôturée";
        return {
          id: item.id,
          type,
          ref: item.numero || item.id,
          titre: type === "nc" ? (item.titre || "") : (item.constat || item.descriptionAmelioration || ""),
          statut: item.statut,
          date: cloturee && item.dateCloture ? item.dateCloture : item.updated_date,
          etat: cloturee ? "cloturee" : item.statut === "Abandonnée" ? "abandonnee" : "en_cours",
        };
      };
      return [
        ...ncs.filter(n => (n.processusAssigné || n.processusConcerne) === nom).map(n => toRow(n, "nc")),
        ...acs.map(ac => toRow(ac, "ac")),
      ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    },
  });

  const filtered = useMemo(
    () => (filtre === "all" ? rows : rows.filter(r => r.etat === filtre)),
    [rows, filtre]
  );

  return (
    <div className="space-y-3">
      {/* Filtre statut */}
      <div className="flex flex-wrap gap-1.5">
        {FILTRES.map(f => (
          <button
            key={f.value}
            onClick={() => setFiltre(f.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${filtre === f.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">
          {rows.length === 0 ? "Aucune NC ni AC pour ce processus." : "Aucune fiche pour ce filtre."}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-100 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/60">
                <TableHead className="text-xs">Réf</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Titre / Constat</TableHead>
                <TableHead className="text-xs">Statut</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={`${r.type}-${r.id}`} className="hover:bg-slate-50/60">
                  <TableCell className="text-xs font-medium text-slate-800 whitespace-nowrap">{r.ref}</TableCell>
                  <TableCell>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.type === "nc" ? "bg-orange-50 text-orange-700 border border-orange-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                      {r.type === "nc" ? "NC" : "AC"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 max-w-[280px]">
                    <span className="line-clamp-2">{r.titre || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge statut={r.statut} type={r.type} />
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                    {r.date ? format(new Date(r.date), "dd/MM/yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/${r.type === "nc" ? "NCDetail" : "ACDetail"}?id=${r.id}`}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Voir
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}