import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, X } from "lucide-react";
import { logJournal } from "@/components/qhse/journalUtils";

/**
 * Gestion des membres d'équipe d'un processus (Paramètres → Gestion des processus).
 * Liste distincte des pilotes : membres sous-assignables aux actions NC et AC.
 * Journalise chaque ajout/retrait dans le journal d'activité.
 */
export default function ProcessusMembres({ processus, users = [], user, onChanged }) {
  const [saving, setSaving] = useState(false);
  const membres = processus.membresEmails || [];
  const ids = processus.membresIds || [];

  const nomOf = (email) => users.find(u => u.email === email)?.full_name || email;

  const save = async (emails, newIds, details) => {
    setSaving(true);
    try {
      await base44.entities.Processus.update(processus.id, { membresEmails: emails, membresIds: newIds });
      logJournal({ user, type: "Gestion processus", element: processus.nom, details });
    } finally {
      setSaving(false);
      onChanged();
    }
  };

  const handleAdd = (email) => {
    if (!email || membres.includes(email) || saving) return;
    const u = users.find(x => x.email === email);
    save([...membres, email], u?.id ? [...ids, u.id] : ids, `Membre ajouté : ${u?.full_name || email}`);
  };

  const handleRemove = (email) => {
    if (saving) return;
    const idx = membres.indexOf(email);
    const newIds = [...ids];
    if (idx >= 0 && ids[idx]) newIds.splice(idx, 1);
    save(membres.filter(e => e !== email), newIds, `Membre retiré : ${nomOf(email)}`);
  };

  const candidates = users.filter(u => u.email && !membres.includes(u.email));

  return (
    <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
      <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5" /> Membres de l'équipe ({membres.length}) — sous-assignables aux actions
      </p>

      {membres.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {membres.map(email => (
            <span key={email} className="inline-flex items-center gap-1 text-xs bg-white border border-slate-200 rounded-full pl-2 pr-1 py-0.5 text-slate-700">
              {nomOf(email)}
              <button
                type="button"
                onClick={() => handleRemove(email)}
                disabled={saving}
                className="text-slate-400 hover:text-red-500"
                title="Retirer ce membre"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mt-2">
        <Select value="" onValueChange={handleAdd} disabled={saving || candidates.length === 0}>
          <SelectTrigger className="h-7 w-[260px] text-xs">
            <SelectValue placeholder={candidates.length === 0 ? "Tous les membres sont déjà ajoutés" : "Ajouter un membre…"} />
          </SelectTrigger>
          <SelectContent>
            {candidates.map(u => (
              <SelectItem key={u.id} value={u.email}>{u.full_name || u.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}