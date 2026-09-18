import React from "react";
import { format } from "date-fns";
import { parseStoredDate } from "@/components/qhse/dateFormat";

export default function CommentaireList({ commentaires, loading }) {
  if (loading) {
    return <p className="text-sm text-slate-400 mt-4">Chargement des commentaires…</p>;
  }
  if (!commentaires.length) {
    return <p className="text-sm text-slate-400 italic mt-4">Aucun commentaire pour le moment</p>;
  }
  return (
    <div className="mt-4 space-y-3">
      {commentaires.map(c => (
        <div key={c.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-semibold text-slate-700">{c.auteurNom || c.auteurEmail || "—"}</span>
            <span className="text-xs text-slate-400">{c.created_date ? format(parseStoredDate(c.created_date), "dd/MM/yyyy HH:mm") : ""}</span>
          </div>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{c.texte}</p>
        </div>
      ))}
    </div>
  );
}