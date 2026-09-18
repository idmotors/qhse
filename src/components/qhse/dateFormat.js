import { format } from "date-fns";

/**
 * Format français JJ/MM/AAAA pour toute date affichée en texte
 * (notifications, récapitulatifs, emails, journal).
 */
const ZONED = /Z$|[+-]\d{2}:?\d{2}$/;

/**
 * Lit un horodatage tel que stocké par la plateforme : les valeurs avec
 * partie heure mais sans fuseau (ex. "2026-09-16T12:36:25") sont en réalité
 * en heure universelle — sans ce correctif, le navigateur les interprète
 * comme heure locale et affiche une heure décalée. Les dates simples (sans
 * "T", saisies via champ calendrier) et les valeurs déjà zonées restent
 * inchangées.
 */
export const parseStoredDate = (value) => {
  const s = value == null ? "" : String(value);
  if (s.includes("T") && !ZONED.test(s)) return new Date(`${s}Z`);
  return new Date(s);
};

export const formatDateFr = (value, fallback = "—") => {
  if (!value) return fallback;
  try {
    return format(parseStoredDate(value), "dd/MM/yyyy");
  } catch {
    return String(value);
  }
};