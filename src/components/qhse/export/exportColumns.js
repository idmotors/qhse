import { format } from "date-fns";
import { parseStoredDate } from "@/components/qhse/dateFormat";

const d = (v) => (v ? format(parseStoredDate(v), "dd/MM/yyyy") : "");
const dt = (v) => (v ? format(parseStoredDate(v), "dd/MM/yyyy HH:mm") : "");
const s = (v) => (v == null ? "" : String(v));
const bool = (v) => (v == null ? "" : v ? "Oui" : "Non");

// Colonnes exportables par type de liste. `default: true` = cochée par défaut
// dans le panneau d'export (reprend les colonnes visibles du tableau).

export const NC_EXPORT_COLUMNS = [
  { key: "numero", label: "N° NC", get: (r) => s(r.numero), default: true },
  { key: "titre", label: "Titre", get: (r) => s(r.titre), default: false },
  { key: "statut", label: "Statut", get: (r) => s(r.statut), default: true },
  { key: "initiateur", label: "Initiateur", get: (r) => s(r.initiateur), default: true },
  { key: "source", label: "Source", get: (r) => s(r.source), default: true },
  { key: "departement", label: "Processus demandeur", get: (r) => s(r.departement), default: true },
  { key: "processusConcerne", label: "Processus assigné", get: (r) => s(r.processusConcerne), default: false },
  { key: "created_date", label: "Date de déclaration", get: (r) => d(r.created_date), default: true },
  { key: "dateConstatation", label: "Date de constatation", get: (r) => d(r.dateConstatation), default: false },
  { key: "circuitCreation", label: "Circuit de création", get: (r) => s(r.circuitCreation), default: true },
  { key: "ecartConstate", label: "Écart constaté", get: (r) => s(r.ecartConstate), default: false },
  { key: "causeRacine", label: "Cause racine", get: (r) => s(r.causeRacine), default: false },
  { key: "responsableSuivi", label: "Responsable de suivi", get: (r) => s(r.responsableSuivi), default: false },
  { key: "dateCloture", label: "Date de clôture", get: (r) => dt(r.dateCloture), default: false },
  { key: "actionEfficace", label: "Action efficace", get: (r) => bool(r.actionEfficace), default: false },
];

export const AC_EXPORT_COLUMNS = [
  { key: "numero", label: "N° AC", get: (r) => s(r.numero), default: true },
  { key: "processusInitiateur", label: "Processus initiateur", get: (r) => s(r.processusInitiateur), default: true },
  { key: "source", label: "Source", get: (r) => s(r.source), default: true },
  { key: "statut", label: "Statut", get: (r) => s(r.statut), default: true },
  { key: "created_date", label: "Date de création", get: (r) => d(r.created_date), default: true },
  { key: "initiateur", label: "Initiateur", get: (r) => s(r.initiateur), default: false },
  { key: "initiateurEmail", label: "Email initiateur", get: (r) => s(r.initiateurEmail), default: false },
  { key: "constat", label: "Constat / opportunité", get: (r) => s(r.constat), default: false },
  { key: "descriptionAmelioration", label: "Amélioration souhaitée", get: (r) => s(r.descriptionAmelioration), default: false },
  { key: "dateCloture", label: "Date de clôture", get: (r) => dt(r.dateCloture), default: false },
  { key: "motifCloture", label: "Motif de clôture", get: (r) => s(r.motifCloture), default: false },
];