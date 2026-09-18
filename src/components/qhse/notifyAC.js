import { base44 } from "@/api/base44Client";
import { getProcessusList, getResponsablesEmails, getHseEmails } from "@/components/qhse/processusUtils";
import { formatDateFr } from "@/components/qhse/dateFormat";

const APP_URL = "https://portal-qhse-idrental.base44.app";

const EVENT_TYPE = {
  new_ac: "Nouvelle AC",
  action_assigned: "Nouvelle AC",
  all_actions_done: "Clôture AC",
  action_standby: "Action AC",
  action_abandoned: "Action AC",
  action_late: "Retard AC",
  action_realized: "Action AC",
  action_sub_assigned: "Action AC",
  team_actions_done: "Action AC",
};

/**
 * Moteur de notifications dédié au module Amélioration Continue (AC).
 * `ac` minimal attendu : { id, numero, initiateurEmail? } — enrichi depuis la fiche si nécessaire.
 * `action` (pour action_assigned) : { description, responsable, dateFinPrevue? }.
 * Règles :
 *  a) new_ac          → équipe QHSE en supervision (3e personne), dédoublonnée des processus assignés
 *  a') action_assigned  → responsables du processus assigné à l'action
 *  b) all_actions_done → initiateur + équipe QHSE (clôture auto ou manuelle)
 *  c) action_standby   → initiateur + équipe QHSE (arbitrage manuel requis)
 *  c') action_abandoned → initiateur + équipe QHSE (abandon d'une action)
 *  d) action_late      → avec action : pilotes de l'action + membre assigné (relance manuelle QHSE), équipe QHSE en copie ; sans action : équipe QHSE seule
 */
export async function notifyAC({ ac, event, action, actions, label, auteur }) {
  if (!ac) return;
  const list = await getProcessusList();
  // Enrichissement au mieux avec la fiche AC complète (l'appelant peut transmettre un objet partiel)
  let full = ac;
  try {
    if (ac.id && (!ac.numero || !ac.initiateurEmail || !ac.constat)) {
      full = { ...ac, ...(await base44.entities.AmeliorationContinue.get(ac.id)) };
    }
  } catch (e) { /* fallback : on utilise les données transmises par l'appelant */ }
  const acLien = ac.id ? `${APP_URL}/ACDetail?id=${ac.id}` : "";
  const tronque = (s, n) => (s && s.length > n ? `${s.slice(0, n)}…` : s || "");
  const recipients = new Set();
  let titre = "";
  let message = "";
  let body = "";
  // Variantes par destinataire (ex: action_late → message de supervision distinct pour les QHSE non responsables)
  let variants = null;

  if (event === "new_ac") {
    // Supervision (3e personne) : l'équipe QHSE est informée de la déclaration d'une nouvelle fiche.
    // Dédoublonnage : un pilote QHSE qui est aussi responsable d'un processus assigné
    // ne reçoit que la notification « action_assigned » de son action.
    const assignes = full.responsablesProcessus || ac.responsablesProcessus || [];
    getHseEmails(list).filter(e => !assignes.includes(e)).forEach(e => recipients.add(e));
    titre = `Nouvelle fiche AC déclarée — processus ${full.processusInitiateur || ""} (${full.numero || ""})`.trim();
    message = `Une fiche d'amélioration continue a été déclarée par le processus ${full.processusInitiateur || "—"}. Vous recevez ce message à titre de supervision (équipe QHSE).`;
    body = `Bonjour,

Une nouvelle fiche d'amélioration continue a été déclarée. Vous recevez ce message à titre de supervision (équipe QHSE).

📌 Référence AC : ${full.numero || ""}
🏭 Processus initiateur : ${full.processusInitiateur || "—"}
🗂️ Source : ${full.source || "—"}
👤 Initiateur : ${full.initiateur || "—"}
📄 Constat : ${tronque(full.constat, 400) || "—"}
✏️ Amélioration souhaitée : ${tronque(full.descriptionAmelioration, 400) || "—"}
🛠️ Actions assignées : ${(full.responsablesProcessus || []).length > 0 ? "voir la fiche" : "aucune pour le moment"}

🔗 Accéder à l'AC : ${acLien}

Cordialement,
Le système QHSE`;
  } else if (event === "action_assigned") {
    // Groupe d'actions assignées au même processus (création d'une AC multi-actions :
    // une seule notification par processus) ou action unique (ajout ultérieur via ActionsListAC).
    const groupe = (actions && actions.length > 0) ? actions : (action ? [action] : null);
    if (!groupe) return;
    const proc = groupe[0].responsable || "";
    getResponsablesEmails(list, proc).forEach(e => recipients.add(e));
    const listLines = groupe.map(a => `- ${a.description || "(sans intitulé)"} — échéance : ${formatDateFr(a.dateFinPrevue)}`).join("\n");
    if (groupe.length > 1) {
      titre = `${groupe.length} nouvelles actions AC assignées à votre processus ${proc} (${full.numero || ""})`.trim();
      message = `${groupe.length} actions de l'AC ${full.numero || ""} ont été assignées au processus ${proc}.`;
    } else {
      titre = `Nouvelle action AC assignée à votre processus ${proc} (${full.numero || ""})`.trim();
      message = `L'action "${groupe[0].description}" de l'AC ${full.numero || ""} a été assignée au processus ${proc}.`;
    }
    body = `Bonjour,

${groupe.length > 1 ? `${groupe.length} actions d'amélioration continue ont été assignées à votre processus.` : "Une action d'amélioration continue a été assignée à votre processus."}

📌 Référence AC : ${full.numero || ""}
🏭 Processus assigné : ${proc}
📝 ${groupe.length > 1 ? "Actions à réaliser" : "Action à réaliser"} :
${listLines}
👤 Initiateur : ${full.initiateur || "—"}
📄 Constat : ${tronque(full.constat, 400) || "—"}

🔗 Accéder à l'AC : ${acLien}

Cordialement,
Le système QHSE`;
  } else if (event === "all_actions_done") {
    if (full.initiateurEmail) recipients.add(full.initiateurEmail);
    getHseEmails(list).forEach(e => recipients.add(e));
    titre = `AC ${full.numero || ""} clôturée${label ? " — " + label : ""}`.trim();
    message = `Toutes les actions de l'AC "${full.numero || ""}" sont réalisées. La fiche est clôturée.`;
    body = `Bonjour,

Toutes les actions d'amélioration continue d'une fiche AC sont réalisées. La fiche est clôturée.

📌 Référence AC : ${full.numero || ""}
📄 Constat : ${tronque(full.constat, 400) || "—"}
✏️ Amélioration mise en œuvre : ${tronque(full.descriptionAmelioration, 400) || "—"}
👤 Initiateur : ${full.initiateur || "—"}

🔗 Accéder à l'AC : ${acLien}

Cordialement,
Le système QHSE`;
  } else if (event === "action_standby") {
    if (full.initiateurEmail) recipients.add(full.initiateurEmail);
    getHseEmails(list).forEach(e => recipients.add(e));
    titre = `Action en standby — arbitrage requis sur ${full.numero || ""}`;
    message = `Une action de l'AC "${full.numero || ""}" est en standby. Un arbitrage manuel est requis pour décider du sort de la fiche.`;
    body = `Bonjour,

Une action d'amélioration continue est en standby. Un arbitrage manuel est requis : relancer le traitement, clôturer ou abandonner la fiche.

📌 Référence AC : ${full.numero || ""}
📄 Constat : ${tronque(full.constat, 400) || "—"}
👤 Initiateur : ${full.initiateur || "—"}
📊 Statut actuel : ${full.statut || "—"}

🔗 Accéder à l'AC : ${acLien}

Cordialement,
Le système QHSE`;
  } else if (event === "action_abandoned") {
    // Abandon d'UNE action individuelle : informe l'initiateur + l'équipe QHSE
    // (indépendant du sort de la fiche, tranché par checkAcClosure côté backend).
    if (!action) return;
    if (full.initiateurEmail) recipients.add(full.initiateurEmail);
    getHseEmails(list).forEach(e => recipients.add(e));
    titre = `Action abandonnée — AC ${full.numero || ""}`.trim();
    message = `L'action "${action.description || ""}" de l'AC ${full.numero || ""} (processus ${action.responsableNom || action.responsable || "—"}) a été marquée « Abandonnée ».`;
    body = `Bonjour,

Une action d'amélioration continue vient d'être marquée « Abandonnée ».

📌 Référence AC : ${full.numero || ""}
🛠️ Action abandonnée : ${action.description || ""}
🏭 Processus responsable : ${action.responsableNom || action.responsable || "—"}
📄 Constat : ${tronque(full.constat, 400) || "—"}
👤 Initiateur : ${full.initiateur || "—"}

🔗 Accéder à l'AC : ${acLien}

Cordialement,
Le système QHSE`;
  } else if (event === "action_realized") {
    // Réalisation d'UNE action individuelle : informe l'initiateur + l'équipe QHSE
    // (indépendant de la clôture globale de la fiche, notifiée séparément via all_actions_done).
    if (!action) return;
    if (full.initiateurEmail) recipients.add(full.initiateurEmail);
    getHseEmails(list).forEach(e => recipients.add(e));
    titre = `Action réalisée — AC ${full.numero || ""}`.trim();
    message = `L'action "${action.description || ""}" de l'AC ${full.numero || ""} a été marquée « Réalisée ».`;
    body = `Bonjour,

Une action d'amélioration continue vient d'être déclarée « Réalisée ». Vous pouvez suivre et, si nécessaire, vérifier la réalisation de cette action.

📌 Référence AC : ${full.numero || ""}
🛠️ Action réalisée : ${action.description || ""}
👤 Réalisée par : ${action.auteurNom || action.responsableNom || action.responsable || "—"}
📅 Date de réalisation : ${formatDateFr(action.dateRealisationEffective)}
💬 Commentaire de réalisation : ${tronque(action.commentaireRealisation, 400) || "—"}
📄 Constat initial : ${tronque(full.constat, 400) || "—"}
👤 Initiateur : ${full.initiateur || "—"}

🔗 Accéder à l'AC : ${acLien}

Cordialement,
Le système QHSE`;
  } else if (event === "action_late") {
    // Relance manuelle QHSE (bouton « Relancer ») : avertir les pilotes responsables de
    // l'action en retard (+ membre sous-assigné), l'équipe QHSE en copie supervision
    // (même logique que le scan quotidien scanActionsRetardAC).
    if (action) {
      const pilots = new Set((action.responsablesProcessus || []).filter(Boolean));
      if (action.assigneEmail) pilots.add(action.assigneEmail);
      const superviseurs = getHseEmails(list).filter(e => !pilots.has(e));
      pilots.forEach(e => recipients.add(e));
      superviseurs.forEach(e => recipients.add(e));
      const diffDays = action.dateFinPrevue ? Math.ceil((new Date(action.dateFinPrevue) - new Date()) / 86400000) : null;
      const echeanceTxt = diffDays === null ? "—" : diffDays <= 0 ? `Retard : ${Math.abs(diffDays)} jour(s)` : diffDays === 1 ? "Échéance : demain" : `Échéance dans ${diffDays} jour(s)`;
      titre = `Relance : action en retard — AC ${full.numero || ""}`.trim();
      message = `L'action "${action.description || ""}" de l'AC ${full.numero || ""} a dépassé son échéance (ou l'approche). Merci de la finaliser ou de mettre à jour son statut.`;
      body = `Bonjour,

Une action d'amélioration continue dont vous êtes responsable (pilote du processus ou membre assigné) a dépassé son échéance ou l'approche à moins de 3 jours.

📌 Référence AC : ${full.numero || ""}
📝 Action : ${action.description || "(sans intitulé)"}
🏭 Processus responsable : ${action.responsableNom || action.responsable || "—"}
📅 Date de fin prévue : ${formatDateFr(action.dateFinPrevue)}
⏱️ ${echeanceTxt}

Merci de la finaliser ou de mettre à jour son statut.

🔗 Accéder à l'AC : ${acLien}

Cordialement,
Le système QHSE`;
      if (superviseurs.length > 0) {
        variants = new Map(superviseurs.map(email => [email, {
          titre: `Relance envoyée — action en retard sur ${full.numero || ""}`.trim(),
          message: `Une relance a été envoyée aux responsables de l'action "${action.description || ""}" sur l'AC ${full.numero || ""} (copie supervision QHSE).`,
          body: `Bonjour,

Une relance manuelle a été envoyée aux responsables de l'action suivante. Vous recevez ce message à titre de supervision (équipe QHSE).

📌 Référence AC : ${full.numero || ""}
📝 Action : ${action.description || "(sans intitulé)"}
🏭 Processus responsable : ${action.responsableNom || action.responsable || "—"}
📅 Date de fin prévue : ${formatDateFr(action.dateFinPrevue)}
⏱️ ${echeanceTxt}

🔗 Accéder à l'AC : ${acLien}

Cordialement,
Le système QHSE`,
        }]));
      }
    } else {
      // Sans action précise (appel historique) : supervision QHSE uniquement
      getHseEmails(list).forEach(e => recipients.add(e));
      titre = `Actions AC en retard sur ${full.numero || ""}`;
      message = `Des actions de l'AC "${full.numero || ""}" ont dépassé leur échéance. Relance requise.`;
      body = `Bonjour,

Des actions d'amélioration continue ont dépassé leur échéance. Une relance est requise.

📌 Référence AC : ${full.numero || ""}
📄 Constat : ${tronque(full.constat, 400) || "—"}
👤 Initiateur : ${full.initiateur || "—"}
📊 Statut actuel : ${full.statut || "—"}

🔗 Accéder à l'AC : ${acLien}

Cordialement,
Le système QHSE`;
    }
  } else if (event === "action_sub_assigned") {
    // Sous-assignation d'une action AC à un membre : seule notification au membre assigné.
    // Auto-assignation (auteur = destinataire) : aucun message, ni in-app ni email, pour éviter le bruit.
    if (!action) return;
    const dest = action.assigneEmail;
    if (!dest || (auteur?.email && auteur.email === dest)) return;
    recipients.add(dest);
    titre = `Action AC assignée — ${full.numero || ""}`.trim();
    message = `L'action "${action.description || ""}" de l'AC ${full.numero || ""} vous a été assignée par ${auteur?.nom || "le pilote du processus"}.`;
    body = `Bonjour,

Une action d'amélioration continue vous a été assignée individuellement par ${auteur?.nom || "le pilote du processus"}.

📌 Référence AC : ${full.numero || ""}
📝 Action à réaliser : ${action.description || ""}
🏭 Processus responsable : ${action.responsableNom || action.responsable || "—"}
📅 Échéance : ${formatDateFr(action.dateFinPrevue)}
👤 Assignée par : ${auteur?.nom || "—"}

🔗 Accéder à l'AC : ${acLien}

Cordialement,
Le système QHSE`;
  } else if (event === "team_actions_done") {
    // Une action sous-assignée est réalisée : informe les pilotes du processus responsable,
    // à l'exclusion du membre assigné lui-même (dédoublonnage, indépendant de all_actions_done).
    if (!action) return;
    (action.responsablesProcessus || []).filter(e => e && e !== action.assigneEmail).forEach(e => recipients.add(e));
    titre = `Action sous-assignée réalisée — AC ${full.numero || ""}`.trim();
    message = `L'action "${action.description || ""}", assignée à ${action.assigneNom || action.assigneEmail || "—"}, a été réalisée par ${action.auteurNom || "le membre assigné"}.`;
    body = `Bonjour,

Une action d'amélioration continue individuellement assignée vient d'être réalisée.

📌 Référence AC : ${full.numero || ""}
🛠️ Action réalisée : ${action.description || ""}
👤 Réalisée par : ${action.auteurNom || "—"}
📅 Date de réalisation : ${formatDateFr(action.dateRealisationEffective)}

🔗 Accéder à l'AC : ${acLien}

Cordialement,
Le système QHSE`;
  } else {
    return;
  }

  const toList = [...recipients].filter(Boolean);
  if (toList.length === 0) {
    console.warn("[notifyAC] Aucun destinataire trouvé", { event, numero: full.numero });
    return;
  }

  const type = EVENT_TYPE[event];
  const payloadFor = (email) => variants?.get(email) || { titre, message, body };
  let notifOk = 0, notifErr = 0, mailOk = 0, mailErr = 0;
  await Promise.all(toList.map(email => {
    const p = payloadFor(email);
    return base44.entities.Notification.create({
      destinataire: email, type, titre: p.titre, message: p.message, lu: false, lienType: "ac", lienId: ac.id,
    }).then(() => { notifOk++; })
    .catch(e => { notifErr++; console.warn("[notifyAC] Notification.create failed", { email, err: String(e?.message || e) }); });
  }));
  await Promise.all(toList.map(email => {
    const p = payloadFor(email);
    return base44.functions.invoke("sendEmailBrevo", { to: email, subject: p.titre, body: p.body })
      .then(() => { mailOk++; })
      .catch(e => {
        mailErr++;
        // On ne masque jamais l'erreur (ex. domaine pas encore authentifié côté Brevo)
        const detail = e?.response?.data || String(e?.message || e);
        console.warn("[notifyAC] sendEmailBrevo failed", { email, err: detail });
      });
  }));
  console.info("[notifyAC] envoi terminé", { event, numero: full.numero, destinataires: toList, notifOk, notifErr, mailOk, mailErr });
}