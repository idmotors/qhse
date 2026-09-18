import { startOfDay } from "date-fns";

/**
 * Une action AC est considérée comme "terminée" si son statut est "Réalisée"
 * ou si une date de réalisation effective est renseignée.
 */
export function isActionDoneAC(action) {
  return action.statut === "Réalisée" || !!action.dateRealisationEffective;
}

/**
 * Calcule si une action AC est "En retard" selon la règle stricte :
 * - "En retard" UNIQUEMENT si statut "En cours" ET dateFinPrevue < aujourd'hui (strictement)
 * - Jamais "En retard" si l'action est réalisée, en standby ou abandonnée
 */
export function isActionLateAC(action) {
  if (!action.dateFinPrevue) return false;
  if (isActionDoneAC(action)) return false;
  if (action.statut !== "En cours") return false;
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(action.dateFinPrevue));
  return due < today;
}

/**
 * Retourne le statut visuel d'une action AC (pour les badges et affichages).
 */
export function getActionDisplayStatusAC(action) {
  if (action.statut === "Réalisée" || action.dateRealisationEffective) return "Réalisée";
  if (isActionLateAC(action)) return "En retard";
  return action.statut;
}