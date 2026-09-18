import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { GitBranch } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "./useUserRole";
import { getProcessusList } from "./processusUtils";

/**
 * Bandeau de contexte permanent : affiche le(s) processus piloté(s) par l'utilisateur,
 * et sur la fiche NC, le processus auquel la NC est attribuée (distingué visuellement).
 */
export default function ProcessContextBar() {
  const location = useLocation();
  const { user, loading } = useUserRole();
  const [userProcesses, setUserProcesses] = useState(null); // null = en cours de chargement
  const [ncProcess, setNcProcess] = useState(null);
  const isNCPage = location.pathname.startsWith("/NCDetail");

  // Processus pilotés par l'utilisateur (rattachement par ID ou par email)
  useEffect(() => {
    if (!user) return;
    let alive = true;
    getProcessusList()
      .then((list) => {
        if (!alive) return;
        const mine = (list || [])
          .filter(
            (p) =>
              (p.responsableIds || []).includes(user.id) ||
              (p.responsableEmails || []).includes(user.email)
          )
          .map((p) => p.nom);
        setUserProcesses(mine);
      })
      .catch(() => {
        if (alive) setUserProcesses([]);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  // Sur la fiche NC : afficher en priorité le processus assigné de la NC
  useEffect(() => {
    if (!isNCPage) {
      setNcProcess(null);
      return;
    }
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      setNcProcess(null);
      return;
    }
    let alive = true;
    base44.entities.NonConformite.get(id)
      .then((nc) => {
        if (alive) setNcProcess(nc?.processusAssigné || nc?.processusConcerne || null);
      })
      .catch(() => {
        if (alive) setNcProcess(null);
      });
    return () => {
      alive = false;
    };
  }, [isNCPage, location.search]);

  if (loading || !user || !userProcesses) return null;
  if (userProcesses.length === 0 && !ncProcess) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-100 bg-white px-4 py-2.5 shadow-sm">
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 shrink-0">
        <GitBranch className="h-4 w-4 text-amber-500" />
        Processus
      </span>
      {ncProcess && (
        <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-800">
          NC attribuée au processus : {ncProcess}
        </span>
      )}
      {userProcesses.length > 0 && (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 shrink-0">Votre processus :</span>
          {userProcesses.map((nom) => (
            <span
              key={nom}
              className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800"
            >
              {nom}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}