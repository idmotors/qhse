// Format français JJ/MM/AAAA pour les dates affichées dans les messages
// (emails et notifications générés par les scans backend).
// Accepte "YYYY-MM-DD" ou une date ISO complète avec heure.
export function formatDateFr(value, fallback = "—") {
  if (!value) return fallback;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(value);
}