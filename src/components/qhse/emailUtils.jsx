import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const FROM_NAME = "QHSE - Système de gestion";
const APP_URL = "https://portal-qhse-idrental.base44.app";

/**
 * Envoie un e-mail d'assignation d'action corrective au responsable.
 */
export async function sendActionAssignedEmail({ action, ncNumero, ncTitre, responsableNom }) {
  if (!action.responsable) return;

  const echeance = action.dateFinPrevue
    ? format(new Date(action.dateFinPrevue), "dd MMMM yyyy", { locale: fr })
    : "Non définie";

  await base44.functions.invoke("sendEmailBrevo", {
    to: action.responsable,
    subject: `[QHSE] Nouvelle action corrective assignée — ${ncNumero}`,
    body: `Bonjour ${responsableNom || action.responsable},

Une nouvelle action corrective vous a été assignée dans le cadre de la non-conformité ${ncNumero}${ncTitre ? ` — ${ncTitre}` : ""}.

📋 Action : ${action.description} (Réf. : ${action.id})
📅 Échéance : ${echeance}

🔗 Accéder à la NC : ${action.ncId ? `${APP_URL}/NCDetail?id=${action.ncId}` : APP_URL}

Merci de prendre en charge cette action dans les meilleurs délais et de mettre à jour son statut dans l'application QHSE.

Cordialement,
L'équipe QHSE`,
  }).then(res => console.info("[emailUtils] sendEmailBrevo ok", { messageId: res?.data?.messageId }))
    .catch(e => console.warn("[emailUtils] sendEmailBrevo failed — assignation action", { to: action.responsable, nc: ncNumero, err: String(e?.message || e) }));
}

/**
 * Envoie un e-mail de rappel d'échéance approchante au responsable.
 * joursRestants : nombre de jours avant l'échéance
 */
export async function sendDeadlineReminderEmail({ action, ncNumero, ncTitre, joursRestants }) {
  if (!action.responsable) return;

  const echeance = action.dateFinPrevue
    ? format(new Date(action.dateFinPrevue), "dd MMMM yyyy", { locale: fr })
    : "";

  const urgenceLabel = joursRestants <= 0
    ? "⚠️ ÉCHÉANCE DÉPASSÉE"
    : joursRestants === 1
      ? "⚠️ Échéance demain"
      : `⏰ Échéance dans ${joursRestants} jour(s)`;

  await base44.functions.invoke("sendEmailBrevo", {
    to: action.responsable,
    subject: `[QHSE] ${urgenceLabel} — Action corrective ${ncNumero}`,
    body: `Bonjour ${action.responsableNom || action.responsable},

${urgenceLabel} pour l'action corrective qui vous a été assignée.

📋 NC : ${ncNumero}${ncTitre ? ` — ${ncTitre}` : ""}
📝 Action : ${action.description} (Réf. : ${action.id})
📅 Échéance : ${echeance}
📊 Statut actuel : ${action.statut}

🔗 Accéder à la NC : ${action.ncId ? `${APP_URL}/NCDetail?id=${action.ncId}` : APP_URL}

Merci de mettre à jour le statut de cette action dans l'application QHSE dès que possible.

Cordialement,
L'équipe QHSE`,
  }).then(res => console.info("[emailUtils] sendEmailBrevo ok", { messageId: res?.data?.messageId }))
    .catch(e => console.warn("[emailUtils] sendEmailBrevo failed — rappel échéance", { to: action.responsable, nc: ncNumero, err: String(e?.message || e) }));
}