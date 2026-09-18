import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initials = (label) =>
  (label || "?").trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();

/**
 * Sous-assignation d'une action à un membre de l'équipe du processus responsable.
 * - canEdit (pilote du processus ou QHSE) : sélecteur "Assigner à un membre" + option
 *   "Me l'assigner à moi-même" + option de retrait ("Non assignée").
 * - Lecture seule : simple affichage de l'assigné (initiales + nom).
 * membres : [{ email, nom }] issus de membresEmails du processus responsable.
 */
export default function AssigneMemberSelect({ action, membres = [], canEdit, userEmail, userName, onAssign }) {
  const currentEmail = action.assigneEmail || "";
  const currentNom = action.assigneNom || currentEmail;

  if (!canEdit) {
    if (!currentEmail) return null;
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
          {initials(currentNom)}
        </span>
        Assignée à {currentNom}
      </span>
    );
  }

  const selectValue = !currentEmail ? "none" : (currentEmail === userEmail ? "__me__" : currentEmail);

  return (
    <span className="inline-flex items-center gap-1.5">
      {currentEmail && (
        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold flex items-center justify-center flex-shrink-0" title={`Assignée à ${currentNom}`}>
          {initials(currentNom)}
        </span>
      )}
      <Select
        value={selectValue}
        onValueChange={v => {
          if (v === "none") { onAssign(action, null); return; }
          if (v === "__me__") { onAssign(action, { email: userEmail, nom: userName || userEmail }); return; }
          const m = membres.find(x => x.email === v);
          onAssign(action, m || { email: v, nom: v });
        }}
      >
        <SelectTrigger className="h-7 w-[200px] text-xs">
          <SelectValue placeholder="Assigner à un membre" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— Non assignée —</SelectItem>
          <SelectItem value="__me__">Me l'assigner à moi-même</SelectItem>
          {membres.filter(m => m.email && m.email !== userEmail).map(m => (
            <SelectItem key={m.email} value={m.email}>{m.nom || m.email}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </span>
  );
}