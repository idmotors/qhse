import { base44 } from "@/api/base44Client";

export const JOURNAL_TYPES = [
  "Création NC",
  "Changement de statut",
  "Action corrective",
  "Vérification efficacité",
  "Clôture NC",
  "Suppression NC",
  "Invitation utilisateur",
  "Suppression utilisateur",
  "Modification droits",
  "Gestion processus",
  "Création AC",
  "Action AC",
  "Clôture AC",
];

/**
 * Enregistre une entrée dans le journal d'activité (best-effort, non bloquant).
 * @param {{ user?: object, type: string, element?: string, details?: string }} entry
 */
export function logJournal({ user, type, element, details }) {
  return base44.entities.JournalActivite.create({
    auteurEmail: user?.email || "",
    auteurNom: user?.full_name || user?.email || "—",
    type,
    element: element || "",
    details: details || "",
  }).catch(e => console.warn("[journalUtils] Échec d'écriture dans le journal d'activité", { type, element: element || "", details: details || "", err: String(e?.message || e) }));
}