import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Plus, Pencil, Check, X } from "lucide-react";
import { getProcessusList, invalidateProcessusCache } from "@/components/qhse/processusUtils";
import { logJournal } from "@/components/qhse/journalUtils";
import FieldError from "@/components/qhse/FieldError";
import ProcessusMembres from "./ProcessusMembres";
import ProcessusHistorique from "./ProcessusHistorique";

/**
 * Gestion des processus métier : création et édition (nom + description).
 * Accessible depuis les Paramètres (QHSE et Administrateur).
 */
export default function ProcessusManager({ user }) {
  const queryClient = useQueryClient();
  const [newNom, setNewNom] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editNom, setEditNom] = useState("");
  const [editDesc, setEditDesc] = useState("");
  // Onglet ouvert par fiche processus : "membres" (défaut) | "historique"
  const [tabs, setTabs] = useState({});
  const [addAttempted, setAddAttempted] = useState(false);
  const [editAttemptedId, setEditAttemptedId] = useState(null);

  const { data: processusList = [] } = useQuery({
    queryKey: ["processus-list"],
    queryFn: getProcessusList,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-list"],
    queryFn: () => base44.entities.User.list().catch(() => []),
  });

  const refresh = () => {
    invalidateProcessusCache();
    queryClient.invalidateQueries({ queryKey: ["processus-list"] });
  };

  const handleAdd = async () => {
    if (!newNom.trim()) { setAddAttempted(true); return; }
    setSaving(true);
    await base44.entities.Processus.create({
      nom: newNom.trim(),
      description: newDesc.trim(),
      responsableEmails: [],
      responsableIds: [],
      membresEmails: [],
      membresIds: [],
    });
    logJournal({ user, type: "Gestion processus", element: newNom.trim(), details: "Processus créé" });
    setNewNom("");
    setNewDesc("");
    setAddAttempted(false);
    refresh();
    setSaving(false);
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditNom(p.nom);
    setEditDesc(p.description || "");
    setEditAttemptedId(null);
  };

  const handleEdit = async (p) => {
    if (!editNom.trim()) { setEditAttemptedId(p.id); return; }
    await base44.entities.Processus.update(p.id, {
      nom: editNom.trim(),
      description: editDesc.trim(),
    });
    logJournal({ user, type: "Gestion processus", element: editNom.trim(), details: `Processus modifié (ancien nom : ${p.nom})` });
    setEditingId(null);
    setEditAttemptedId(null);
    refresh();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Gestion des processus ({processusList.length})
        </h2>
        <p className="text-xs text-slate-500 mt-1">Ajouter ou modifier les processus métier utilisés pour le routage des fiches.</p>
      </div>

      <div className="p-6 border-b border-slate-100 space-y-2">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            value={newNom}
            onChange={e => setNewNom(e.target.value)}
            placeholder="Nom du nouveau processus"
            className="flex-1"
          />
          <Input
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Description (optionnelle)"
            className="flex-1"
          />
          <Button onClick={handleAdd} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Ajouter
          </Button>
        </div>
        <FieldError show={addAttempted && !newNom.trim()} message="Veuillez saisir le nom du processus." />
      </div>

      <div className="divide-y divide-slate-100">
        {processusList.map(p => (
          <div key={p.id} className="p-4 space-y-3">
            <div className="flex items-center gap-3">
            {editingId === p.id ? (
              <>
                <Input value={editNom} onChange={e => setEditNom(e.target.value)} className="flex-1 h-8 text-sm" />
                <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} className="flex-1 h-8 text-sm" placeholder="Description" />
                <Button size="sm" onClick={() => handleEdit(p)} className="h-8 bg-green-600 hover:bg-green-700">
                  <Check className="w-4 h-4" /> Enregistrer
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-8">
                  <X className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{p.nom}</p>
                  {p.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{p.description}</p>}
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {(p.responsableEmails || []).length} pilote{(p.responsableEmails || []).length > 1 ? "s" : ""}
                </span>
                <Button size="sm" variant="outline" onClick={() => startEdit(p)} className="h-8">
                  <Pencil className="w-3.5 h-3.5" /> Modifier
                </Button>
              </>
            )}
            </div>
            {editingId === p.id && (
              <FieldError show={editAttemptedId === p.id && !editNom.trim()} message="Veuillez saisir le nom du processus." />
            )}
            {editingId !== p.id && (
              <div className="space-y-3">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setTabs(t => ({ ...t, [p.id]: "membres" }))}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${(tabs[p.id] || "membres") === "membres" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                  >
                    Membres de l'équipe
                  </button>
                  <button
                    onClick={() => setTabs(t => ({ ...t, [p.id]: "historique" }))}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${tabs[p.id] === "historique" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                  >
                    Historique
                  </button>
                </div>
                {(tabs[p.id] || "membres") === "membres" ? (
                  <ProcessusMembres processus={p} users={users} user={user} onChanged={refresh} />
                ) : (
                  <ProcessusHistorique processus={p} />
                )}
              </div>
            )}
          </div>
        ))}
        {processusList.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-400">Aucun processus défini</div>
        )}
      </div>
    </div>
  );
}