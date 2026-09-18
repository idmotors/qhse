// Statut colors for NC
export const STATUT_CONFIG = {
  "Ouverte": { color: "bg-blue-100 text-blue-800 border-blue-200", dot: "bg-blue-500" },
  "En investigation": { color: "bg-violet-100 text-violet-800 border-violet-200", dot: "bg-violet-500" },
  "En cours de traitement": { color: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-500" },
  "En retard": { color: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-500" },
  "En vérification d'efficacité": { color: "bg-yellow-100 text-yellow-800 border-yellow-200", dot: "bg-yellow-500" },
  "Clôturée": { color: "bg-green-100 text-green-800 border-green-200", dot: "bg-green-500" },
};

export const ACTION_STATUT_CONFIG = {
  "À faire": { color: "bg-slate-100 text-slate-700 border-slate-200" },
  "En cours": { color: "bg-blue-100 text-blue-800 border-blue-200" },
  "En vérification": { color: "bg-violet-100 text-violet-800 border-violet-200" },
  "Terminé": { color: "bg-green-100 text-green-800 border-green-200" },
  "Réalisée": { color: "bg-green-100 text-green-800 border-green-200" },
  "En retard": { color: "bg-red-100 text-red-800 border-red-200" },
};

export const SOURCES = [
  "Audit interne", "Audit externe", "Revue KPI", "Revue processus",
  "Revue risques & opportunités", "Accident/Incident", "Satisfaction client",
  "Veille réglementaire", "Autre"
];

export const DEPARTEMENTS = [
  "SMQ / Amélioration continue", "HSE", "Management", "Commerciale",
  "RH", "Facturation", "Service rapide", "Achat",
  "Système d'information", "Opération"
];

export const PROCESSUS = [
  "SMQ / Amélioration continue", "HSE", "Management", "Commerciale",
  "RH", "Facturation", "Service rapide", "Achat",
  "Système d'information", "Opération"
];

export const PRIORITES = ["Faible", "Moyen", "Élevé"];

// Statuts des fiches Amélioration Continue (AC)
export const AC_STATUT_CONFIG = {
  "Brouillon": { color: "bg-slate-100 text-slate-700 border-slate-200" },
  "À traiter": { color: "bg-blue-100 text-blue-800 border-blue-200" },
  "En cours": { color: "bg-orange-100 text-orange-800 border-orange-200" },
  "Clôturée": { color: "bg-green-100 text-green-800 border-green-200" },
  "Abandonnée": { color: "bg-slate-200 text-slate-500 border-slate-300" },
};

// Statuts des actions d'amélioration (ActionAmelioration)
export const ACTION_AC_STATUT_CONFIG = {
  "En cours": { color: "bg-blue-100 text-blue-800 border-blue-200" },
  "Réalisée": { color: "bg-green-100 text-green-800 border-green-200" },
  "En standby": { color: "bg-amber-100 text-amber-800 border-amber-200" },
  "Abandonnée": { color: "bg-slate-200 text-slate-500 border-slate-300" },
};