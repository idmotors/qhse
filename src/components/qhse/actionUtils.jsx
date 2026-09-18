import { startOfDay } from "date-fns";

/**
 * Une action est considérée comme "terminée" si son statut est Terminé
 * (ou l'ancienne valeur Réalisée), ou si une date de réalisation effective est renseignée.
 */
export function isActionDone(action) {
  return action.statut === "Terminé" || action.statut === "Réalisée" || !!action.dateRealisationEffective;
}

/**
 * Calcule si une action est "En retard" selon la règle stricte :
 * - "En retard" UNIQUEMENT si dateFinPrevue < aujourd'hui (strictement, jour J exclu)
 * - Si l'action est terminée → jamais "En retard"
 */
export function isActionLate(action) {
  if (!action.dateFinPrevue) return false;
  if (isActionDone(action)) return false;
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(action.dateFinPrevue));
  return due < today;
}

/**
 * Retourne le statut visuel d'une action (pour les badges et affichages).
 * Prend en compte la règle "En retard" stricte et la rétrocompatibilité "Réalisée".
 */
export function getActionDisplayStatus(action) {
  if (action.statut === "Terminé" || action.statut === "Réalisée") return action.statut;
  if (action.dateRealisationEffective) return "Terminé";
  if (isActionLate(action)) return "En retard";
  return action.statut;
}