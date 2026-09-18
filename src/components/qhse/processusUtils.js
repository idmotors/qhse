import { base44 } from "@/api/base44Client";
import { formatDateFr } from "@/components/qhse/dateFormat";

const FROM_NAME = "QHSE - Système de gestion";
// L'équipe QHSE regroupe les pilotes des processus "HSE" ET "SMQ / Amélioration continue"
const QHSE_PROCESSUS = ["HSE", "SMQ / Amélioration continue"];
const APP_URL = "https://portal-qhse-idrental.base44.app";

// Cache très court (10 s) : évite les requêtes en rafale dans une même vue,
// tout en garantissant que toute mise à jour des responsables (Paramètres)
// s'applique immédiatement aux notifications déclenchées par les autres utilisateurs.
const CACHE_TTL_MS = 10_000;
let _cache = null; // { list, expiresAt }
let _cachePromise = null;

export async function getProcessusList() {
  if (_cache && _cache.expiresAt > Date.now()) return _cache.list;
  if (_cachePromise) return _cachePromise;
  _cachePromise = base44.entities.Processus.list()
    .then(list => {
      _cache = { list: list || [], expiresAt: Date.now() + CACHE_TTL_MS };
      _cachePromise = null;
      return _cache.list;
    })
    .catch(() => { _cachePromise = null; return []; });
  return _cachePromise;
}

export function invalidateProcessusCache() { _cache = null; }

export function getResponsablesEmails(processusList, processName) {
  if (!processName) return [];
  const p = (processusList || []).find(x => x.nom === processName);
  return (p?.responsableEmails || []).filter(Boolean);
}

export function getMembresEmails(processusList, processName) {
  if (!processName) return [];
  const p = (processusList || []).find(x => x.nom === processName);
  return (p?.membresEmails || []).filter(Boolean);
}

export function getHseEmails(processusList) {
  return [...new Set(QHSE_PROCESSUS.flatMap(nom => getResponsablesEmails(processusList, nom)))];
}

const EVENT_TYPE = {
  new_nc: "Nouvelle NC",
  status_change: "Changement statut",
  action_late: "Retard",
  all_actions_done: "Efficacité",
  verification_required: "Efficacité",
  action_inefficace: "Efficacité",
  action_sub_assigned: "Assignation",
  team_actions_done: "Changement statut",
  action_immediate_assigned: "Assignation",
  action_immediate_done: "Action immédiate réalisée",
};

/**
 * Moteur de notifications basé sur les Processus.
 * Règles :
 *  a) new_nc        → responsables du Processus assigné (« votre processus ») + équipe QHSE en supervision (formulation 3e personne, sauf si QHSE est le processus assigné)
 *  b) status_change → responsables du Processus demandeur + responsables du processus HSE + initiateur de la NC (à la clôture : + responsables du processus assigné) — source UNIQUE de notification pour cet événement
 *  c) action_late   → avec action : pilotes de l'action + membre assigné (relance manuelle QHSE), équipe QHSE en copie supervision ; sans action : équipe QHSE seule
 *  d) all_actions_done → responsables du processus DEMANDEUR (QHSE reçoit séparément l'alerte actionnable de l'étape Vérification)
 *  e) verification_required → responsables du processus HSE uniquement (alerte actionnable distincte à l'arrivée en étape Vérification)
 * Dédoublonnage : un destinataire présent dans plusieurs règles ne reçoit qu'une seule notif (Set d'emails).
 * `nc` minimal attendu : { id, numero, titre, processusDemandeur?, processusAssigné? }
 */
export async function notifyProcessus({ nc, event, label, action, auteur }) {
  if (!nc) return;
  const list = await getProcessusList();
  // Enrichissement au mieux avec la fiche NC complète (l'appelant peut transmettre un objet partiel)
  let full = nc;
  try {
    if (nc.id && (!nc.processusAssigné || !nc.statut || !nc.ecartConstate)) {
      full = { ...nc, ...(await base44.entities.NonConformite.get(nc.id)) };
    }
  } catch (e) { /* fallback : on utilise les données transmises par l'appelant */ }
  const ncLien = nc.id ? `${APP_URL}/NCDetail?id=${nc.id}` : "";
  const tronque = (s, n) => (s && s.length > n ? `${s.slice(0, n)}…` : s || "");
  const emailBody = { new_nc: "", status_change: "", action_late: "", all_actions_done: "", verification_required: "", action_inefficace: "", action_sub_assigned: "", team_actions_done: "", action_immediate_assigned: "", action_immediate_done: "" };
  const recipients = new Set();
  let titre = "";
  let message = "";
  // Variantes par destinataire (ex: new_nc → message de supervision distinct pour les QHSE non-assignés)
  let variants = null;

  if (event === "new_nc") {
    const assigne = nc.processusAssigné || nc.processusConcerne || nc.departement;
    const assigneEmails = getResponsablesEmails(list, assigne);
    assigneEmails.forEach(e => recipients.add(e));
    // L'équipe QHSE (HSE + SMQ/Amélioration continue) reçoit une notification de supervision,
    // SAUF si elle est le processus assigné (auquel cas le message « votre processus » suffit)
    const superviseurs = getHseEmails(list).filter(e => !assigneEmails.includes(e));
    superviseurs.forEach(e => recipients.add(e));
    titre = `Nouvelle NC ${nc.numero || ""} assignée à votre processus ${assigne || ""}`.trim();
    message = `La NC "${nc.titre || nc.numero || ""}" a été déclarée et assignée au processus ${assigne || ""}.`;
    emailBody.new_nc = `Bonjour,

Une nouvelle non-conformité a été déclarée et assignée à votre processus.

📌 Référence : ${full.numero || nc.numero || ""}
📝 Intitulé : ${nc.titre || full.titre || ""}
🏭 Processus concerné : ${assigne || ""}
👤 Initiateur : ${full.initiateur || "—"}
📄 Écart constaté : ${tronque(full.ecartConstate, 400) || "—"}
📅 Date limite de traitement : ${formatDateFr(full.echeanceFixeeQHSE, "Non fixée")}
📊 Statut actuel : ${full.statut || "Ouverte"}

🔗 Accéder à la NC : ${ncLien}

Cordialement,
Le système QHSE`;
    // Message de supervision (3e personne) pour les QHSE qui ne sont pas le processus assigné
    if (superviseurs.length > 0) {
      variants = new Map(superviseurs.map(email => [email, {
        titre: `Nouvelle NC ${nc.numero || ""} — processus ${assigne || ""}`.trim(),
        message: `Une NC a été assignée au processus ${assigne || ""}.`,
        emailBody: `Bonjour,

Une nouvelle non-conformité a été déclarée et assignée au processus ${assigne || ""}. Vous recevez ce message à titre de supervision (équipe QHSE).

📌 Référence : ${full.numero || nc.numero || ""}
📝 Intitulé : ${nc.titre || full.titre || ""}
🏭 Processus concerné : ${assigne || ""}
👤 Initiateur : ${full.initiateur || "—"}
📄 Écart constaté : ${tronque(full.ecartConstate, 400) || "—"}
📊 Statut actuel : ${full.statut || "Ouverte"}

🔗 Accéder à la NC : ${ncLien}

Cordialement,
Le système QHSE`,
      }]));
    }
  } else if (event === "status_change") {
    const demandeur = nc.processusDemandeur || nc.departement;
    getResponsablesEmails(list, demandeur).forEach(e => recipients.add(e));
    getHseEmails(list).forEach(e => recipients.add(e));
    // L'initiateur de la NC est toujours destinataire d'un changement de statut
    // (une seule notification, dédoublonnée via le Set s'il est aussi responsable du processus demandeur)
    const initiateur = nc.initiateurEmail || full.initiateurEmail;
    if (initiateur) recipients.add(initiateur);
    const statut = label || nc.statut || "";
    // À la clôture : notifier aussi les responsables du processus ASSIGNÉ (dédoublonnés via le Set si demandeur = assigné)
    if (statut === "Clôturée") {
      const assigne = nc.processusAssigné || nc.processusConcerne || nc.departement;
      getResponsablesEmails(list, assigne).forEach(e => recipients.add(e));
    }
    titre = `Changement de statut — NC ${nc.numero || ""} (${statut})`;
    message = `La NC "${nc.titre || nc.numero || ""}" est passée au statut « ${statut} ».`;
    emailBody.status_change = `Bonjour,

Le statut d'une non-conformité a été mis à jour.

📌 Référence : ${full.numero || nc.numero || ""}
📝 Intitulé : ${nc.titre || full.titre || ""}
🔄 Nouveau statut : ${statut}
🏭 Processus demandeur : ${demandeur || "—"}
🏭 Processus concerné : ${full.processusAssigné || full.processusConcerne || "—"}
📅 Date limite de traitement : ${formatDateFr(full.echeanceFixeeQHSE, "Non fixée")}

🔗 Accéder à la NC : ${ncLien}

Cordialement,
Le système QHSE`;
  } else if (event === "action_late") {
    // Relance manuelle QHSE (bouton « Relancer ») : avertir les pilotes responsables de
    // l'action en retard (+ membre sous-assigné), l'équipe QHSE en copie supervision
    // (même logique que le scan quotidien scanActionsRetard).
    if (action) {
      const pilots = new Set((action.responsablesProcessus || []).filter(Boolean));
      if (action.assigneEmail) pilots.add(action.assigneEmail);
      const superviseurs = getHseEmails(list).filter(e => !pilots.has(e));
      pilots.forEach(e => recipients.add(e));
      superviseurs.forEach(e => recipients.add(e));
      const diffDays = action.dateFinPrevue ? Math.ceil((new Date(action.dateFinPrevue) - new Date()) / 86400000) : null;
      const echeanceTxt = diffDays === null ? "—" : diffDays <= 0 ? `Retard : ${Math.abs(diffDays)} jour(s)` : diffDays === 1 ? "Échéance : demain" : `Échéance dans ${diffDays} jour(s)`;
      titre = `Relance : action corrective en retard — NC ${full.numero || nc.numero || ""}`.trim();
      message = `L'action corrective "${action.description || ""}" de la NC "${nc.titre || full.titre || nc.numero || ""}" a dépassé son échéance (ou l'approche). Merci de la finaliser ou de mettre à jour son statut.`;
      emailBody.action_late = `Bonjour,

Une action corrective dont vous êtes responsable (pilote du processus ou membre assigné) a dépassé son échéance ou l'approche à moins de 3 jours.

📌 Référence NC : ${full.numero || nc.numero || ""}
📝 Action : ${action.description || ""}
🏭 Processus responsable : ${action.responsableNom || action.responsable || "—"}
📅 Date de fin prévue : ${formatDateFr(action.dateFinPrevue)}
⏱️ ${echeanceTxt}

Merci de la finaliser ou de mettre à jour son statut.

🔗 Accéder à la NC : ${ncLien}

Cordialement,
Le système QHSE`;
      if (superviseurs.length > 0) {
        variants = new Map(superviseurs.map(email => [email, {
          titre: `Relance envoyée — action en retard sur ${full.numero || nc.numero || ""}`.trim(),
          message: `Une relance a été envoyée aux responsables de l'action "${action.description || ""}" sur la NC "${nc.titre || full.titre || nc.numero || ""}" (copie supervision QHSE).`,
          emailBody: `Bonjour,

Une relance manuelle a été envoyée aux responsables de l'action corrective suivante. Vous recevez ce message à titre de supervision (équipe QHSE).

📌 Référence NC : ${full.numero || nc.numero || ""}
📝 Action : ${action.description || ""}
🏭 Processus responsable : ${action.responsableNom || action.responsable || "—"}
📅 Date de fin prévue : ${formatDateFr(action.dateFinPrevue)}
⏱️ ${echeanceTxt}

🔗 Accéder à la NC : ${ncLien}

Cordialement,
Le système QHSE`,
        }]));
      }
    } else {
      // Sans action précise (appel historique) : supervision QHSE uniquement
      getHseEmails(list).forEach(e => recipients.add(e));
      titre = `Actions correctives en retard sur ${nc.numero || ""}`;
      message = `Des actions correctives sur la NC "${nc.titre || nc.numero || ""}" ont dépassé leur échéance. Relance requise.`;
      emailBody.action_late = `Bonjour,

Des actions correctives liées à une non-conformité ont dépassé leur échéance. Une relance est requise.

📌 Référence : ${full.numero || nc.numero || ""}
📝 Intitulé : ${nc.titre || full.titre || ""}
🏭 Processus concerné : ${full.processusAssigné || full.processusConcerne || full.departement || "—"}
📊 Statut actuel de la NC : ${full.statut || "—"}

🔗 Accéder à la NC : ${ncLien}

Cordialement,
Le système QHSE`;
    }
  } else if (event === "all_actions_done") {
    // Notifie le processus DEMANDEUR (QHSE reçoit séparément l'alerte actionnable de l'étape Vérification)
    const demandeur = full.processusDemandeur || nc.processusDemandeur || full.departement || nc.departement;
    getResponsablesEmails(list, demandeur).forEach(e => recipients.add(e));
    let nbActions = null, derniereDate = "";
    try {
      const acts = await base44.entities.Action.filter({ ncId: nc.id });
      nbActions = acts.length;
      derniereDate = acts.map(a => a.dateRealisationEffective).filter(Boolean).sort().pop() || "";
    } catch (e) { /* best effort */ }
    titre = `${nc.numero || ""} prête pour vérification d'efficacité`;
    message = `Toutes les actions correctives de la NC "${nc.titre || nc.numero || ""}" sont terminées. La NC est prête pour vérification d'efficacité.`;
    emailBody.all_actions_done = `Bonjour,

Toutes les actions correctives d'une non-conformité sont terminées. Le dossier est prêt pour la vérification d'efficacité.

📌 Référence : ${full.numero || nc.numero || ""}
📝 Intitulé : ${nc.titre || full.titre || ""}
🏭 Processus concerné : ${full.processusAssigné || full.processusConcerne || full.departement || "—"}
✅ Actions correctives : ${nbActions !== null ? `${nbActions} action(s) associée(s) — toutes terminées` : "toutes les actions requises sont terminées"}
📅 Finalisation de la dernière action : ${derniereDate || "—"}
📊 Statut actuel : ${full.statut || "En cours de traitement"}

🔗 Accéder au dossier : ${ncLien}

Cordialement,
Le système QHSE`;
  } else if (event === "action_inefficace") {
    // L'action corrective réalisée par le processus assigné a été jugée inefficace par la QHSE :
    // le processus concerné est alerté que sa NC est de retour en traitement.
    const assigne = nc.processusAssigné || nc.processusConcerne || nc.departement;
    getResponsablesEmails(list, assigne).forEach(e => recipients.add(e));
    titre = `Action jugée inefficace — NC ${nc.numero || ""} de retour en traitement`;
    message = `L'action corrective de la NC "${nc.titre || nc.numero || ""}" a été jugée non efficace par la QHSE. La NC est de retour en traitement : une nouvelle action corrective est requise.`;
    emailBody.action_inefficace = `Bonjour,

L'efficacité de l'action corrective mise en œuvre sur votre non-conformité a été vérifiée par la QHSE et jugée INSUFFISANTE. La NC est donc de retour en traitement : une nouvelle action corrective est requise de votre part.

📌 Référence : ${full.numero || nc.numero || ""}
📝 Intitulé : ${nc.titre || full.titre || ""}
🏭 Processus concerné : ${assigne || ""}
👤 Initiateur : ${full.initiateur || "—"}
📊 Statut actuel : En cours de traitement

🔗 Accéder à la NC pour définir une nouvelle action : ${ncLien}

Cordialement,
Le système QHSE`;
  } else if (event === "verification_required") {
    // Destinataires identiques à status_change (dédoublonnés via le Set) : QHSE + processus demandeur + initiateur
    getHseEmails(list).forEach(e => recipients.add(e));
    getResponsablesEmails(list, nc.processusDemandeur || nc.departement).forEach(e => recipients.add(e));
    const initiateurVerif = nc.initiateurEmail || full.initiateurEmail;
    if (initiateurVerif) recipients.add(initiateurVerif);
    titre = `Une NC est prête pour votre vérification — action requise (${nc.numero || ""})`.trim();
    message = `La NC "${nc.titre || nc.numero || ""}" vient d'atteindre l'étape « En vérification d'efficacité ». Votre vérification est requise.`;
    emailBody.verification_required = `Bonjour,

Une non-conformité vient d'atteindre l'étape « En vérification d'efficacité ». Votre intervention est requise : vérifiez l'efficacité des actions correctives mises en œuvre, puis clôturez la NC ou remettez-la en traitement.

📌 Référence : ${full.numero || nc.numero || ""}
📝 Intitulé : ${nc.titre || full.titre || ""}
🏭 Processus concerné : ${full.processusAssigné || full.processusConcerne || full.departement || "—"}
👤 Initiateur : ${full.initiateur || "—"}
📊 Statut : En vérification d'efficacité

🔗 Accéder au dossier : ${ncLien}

Cordialement,
Le système QHSE`;
  } else if (event === "action_sub_assigned") {
    // Sous-assignation d'une action corrective à un membre : seule notification au membre assigné.
    // Auto-assignation (auteur = destinataire) : aucun message, ni in-app ni email, pour éviter le bruit.
    if (!action) return;
    const dest = action.assigneEmail;
    if (!dest || (auteur?.email && auteur.email === dest)) return;
    recipients.add(dest);
    titre = `Action corrective assignée — NC ${full.numero || nc.numero || ""}`.trim();
    message = `L'action "${action.description || ""}" de la NC "${nc.titre || full.titre || nc.numero || ""}" vous a été assignée par ${auteur?.nom || "le pilote du processus"}.`;
    emailBody.action_sub_assigned = `Bonjour,

Une action corrective vous a été assignée individuellement par ${auteur?.nom || "le pilote du processus"}.

📌 Référence NC : ${full.numero || nc.numero || ""}
📝 Action à réaliser : ${action.description || ""}
🏭 Processus responsable : ${action.responsableNom || action.responsable || "—"}
📅 Échéance : ${formatDateFr(action.dateFinPrevue)}
👤 Assignée par : ${auteur?.nom || "—"}

🔗 Accéder à la NC : ${ncLien}

Cordialement,
Le système QHSE`;
  } else if (event === "team_actions_done") {
    // Une action sous-assignée est terminée : informe les pilotes du processus responsable,
    // à l'exclusion du membre assigné lui-même (dédoublonnage, indépendant de all_actions_done).
    if (!action) return;
    (action.responsablesProcessus || []).filter(e => e && e !== action.assigneEmail).forEach(e => recipients.add(e));
    titre = `Action sous-assignée terminée — NC ${full.numero || nc.numero || ""}`.trim();
    message = `L'action "${action.description || ""}", assignée à ${action.assigneNom || action.assigneEmail || "—"}, a été terminée par ${action.auteurNom || "le membre assigné"}.`;
    emailBody.team_actions_done = `Bonjour,

Une action corrective individuellement assignée vient d'être terminée.

📌 Référence NC : ${full.numero || nc.numero || ""}
📝 Action réalisée : ${action.description || ""}
👤 Réalisée par : ${action.auteurNom || "—"}
📅 Date de réalisation : ${formatDateFr(action.dateRealisationEffective)}

🔗 Accéder à la NC : ${ncLien}

Cordialement,
Le système QHSE`;
  } else if (event === "action_immediate_assigned") {
    // Assignation d'une action immédiate : notification (in-app + email) aux pilotes du
    // processus désigné responsable. Auto-assignation : le déclarant ne se notifie pas
    // lui-même (ses co-pilotes restent notifiés, dédoublonnés via le Set).
    if (!action) return;
    getResponsablesEmails(list, action.responsable).forEach(e => recipients.add(e));
    if (auteur?.email) recipients.delete(auteur.email);
    if (recipients.size === 0) return;
    titre = `Action immédiate assignée — NC ${full.numero || nc.numero || ""}`.trim();
    message = `L'action immédiate "${action.description || ""}" de la NC "${nc.titre || full.titre || nc.numero || ""}" a été assignée au processus ${action.responsable || ""} par ${auteur?.nom || "—"}.`;
    emailBody.action_immediate_assigned = `Bonjour,

Une action immédiate vous a été assignée par ${auteur?.nom || "—"} dans le cadre d'une non-conformité.

📌 Référence NC : ${full.numero || nc.numero || ""}
📝 Action immédiate : ${action.description || ""}
🏭 Processus responsable : ${action.responsableNom || action.responsable || "—"}
📅 Échéance (48h max) : ${formatDateFr(action.dateFinPrevue)}
👤 Déclarée par : ${auteur?.nom || "—"}

🔗 Accéder à la NC : ${ncLien}

Cordialement,
Le système QHSE`;
  } else if (event === "action_immediate_done") {
    // Action immédiate marquée « Réalisée » : alerte l'équipe QHSE (HSE + SMQ / Amélioration continue)
    getHseEmails(list).forEach(e => recipients.add(e));
    titre = `Action immédiate réalisée — NC ${full.numero || nc.numero || ""}`.trim();
    message = `L'action immédiate "${action.description || ""}" de la NC "${nc.titre || full.titre || nc.numero || ""}" a été marquée comme réalisée par ${auteur?.nom || "—"}${action.dateRealisationEffective ? ` le ${formatDateFr(action.dateRealisationEffective)}` : ""}.`;
    emailBody.action_immediate_done = `Bonjour,

Une action immédiate a été marquée comme réalisée sur une non-conformité.

📌 Référence NC : ${full.numero || nc.numero || ""}
📝 Action immédiate : ${action.description || ""}
🏭 Processus responsable : ${action.responsableNom || action.responsable || "—"}
👤 Réalisée par : ${auteur?.nom || "—"}
📅 Date de réalisation : ${formatDateFr(action.dateRealisationEffective)}

🔗 Accéder à la NC : ${ncLien}

Cordialement,
Le système QHSE`;
  } else {
    return;
  }

  const toList = [...recipients].filter(Boolean);
  if (toList.length === 0) {
    const cherche = nc.processusAssigné || nc.processusConcerne || nc.departement || nc.processusDemandeur;
    console.warn("[notifyProcessus] Aucun destinataire trouvé", { event, numero: nc.numero, processusCherché: cherche });
    return;
  }

  const type = EVENT_TYPE[event];
  const payloadFor = (email) => variants?.get(email) || { titre, message, emailBody: emailBody[event] || message };
  let notifOk = 0, notifErr = 0, mailOk = 0, mailErr = 0;
  await Promise.all(toList.map(email => {
    const p = payloadFor(email);
    return base44.entities.Notification.create({
      destinataire: email, type, titre: p.titre, message: p.message, lu: false, lienType: "nc", lienId: nc.id,
    }).then(() => { notifOk++; })
    .catch(e => { notifErr++; console.warn("[notifyProcessus] Notification.create failed", { email, err: String(e?.message || e) }); });
  }));
  const mailMessageIds = [];
  const mailErrors = [];
  await Promise.all(toList.map(email => {
    const p = payloadFor(email);
    // --- Ancien mécanisme natif Base44 (conservé pour rollback rapide) ---
    // base44.integrations.Core.SendEmail({ to: email, from_name: FROM_NAME, subject: titre, body: message })
    // --- Nouveau mécanisme : envoi via Brevo (fonction backend, clé API en secret) ---
    return base44.functions.invoke("sendEmailBrevo", { to: email, subject: p.titre, body: p.emailBody })
      .then(res => {
        mailOk++;
        const messageId = res?.data?.messageId;
        if (messageId) mailMessageIds.push({ email, messageId });
      })
      .catch(e => {
        mailErr++;
        // On ne masque jamais l'erreur (ex. domaine pas encore authentifié côté Brevo) :
        // on remonte le détail exact renvoyé par la fonction backend.
        const detail = e?.response?.data || String(e?.message || e);
        mailErrors.push({ email, detail });
        console.warn("[notifyProcessus] sendEmailBrevo failed", { email, err: detail });
      });
  }));
  console.info("[notifyProcessus] envoi terminé", { event, numero: nc.numero, destinataires: toList, notifOk, notifErr, mailOk, mailErr, mailMessageIds, mailErrors });
}