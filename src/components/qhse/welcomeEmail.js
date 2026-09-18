import { base44 } from "@/api/base44Client";

const APP_URL = "https://portal-qhse-idrental.base44.app";
const SENDER_EMAIL = "systeme-notifications@idrental.mg";

const ROLE_LABELS = {
  collaborateur: "Collaborateur",
  admin_gestion: "Administrateur",
  qhse: "QHSE",
  direction: "Direction",
};

// Nom d'affichage dérivé de l'adresse email (ex. jean.dupont@… → Jean Dupont)
const deriveNom = (email) => {
  const local = String(email).split("@")[0] || "";
  const nom = local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
    .join(" ");
  return nom || email;
};

/**
 * Email de bienvenue personnalisé envoyé via Brevo juste après une invitation.
 * Ne remplace pas l'email d'activation officiel de la plateforme : il l'accompagne
 * pour le rendre reconnaissable et éviter qu'il ne finisse en spam.
 *
 * @param {{ to: string, role?: string, processus?: string[] }} params
 * @returns {Promise<{ success: boolean }>} résultat de sendEmailBrevo
 */
export async function sendWelcomeEmail({ to, role, processus = [] }) {
  const nom = deriveNom(to);
  const prenom = nom.split(" ")[0];
  const roleLabel = ROLE_LABELS[role] || "Collaborateur";
  const processusListe = processus.length
    ? processus.map((p) => `<li style="margin:2px 0;">${p}</li>`).join("")
    : "<li style='margin:2px 0;color:#64748b;'>Aucun processus rattaché</li>";

  const subject = `Bienvenue sur le Portail QHSE IDR, ${prenom}`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background-color:#f1f3f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f3f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <!-- Bandeau -->
          <tr>
            <td style="background-color:#363886;padding:22px 28px;">
              <p style="margin:0;color:#ffffff;font-size:16px;font-weight:bold;letter-spacing:0.5px;">PORTAIL QHSE &mdash; IDR</p>
              <p style="margin:4px 0 0;color:#c7c9e8;font-size:12px;">Gestion des non-conformit&eacute;s et am&eacute;liorations continues</p>
            </td>
          </tr>
          <!-- Corps -->
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 14px;font-size:16px;color:#0f172a;">Bonjour <strong>${nom}</strong>,</p>
              <p style="margin:0 0 14px;font-size:14px;line-height:22px;color:#334155;">
                Vous avez &eacute;t&eacute; invit&eacute;(e) sur le Portail QHSE d'IDRental, la plateforme interne de gestion
                des non-conformit&eacute;s et des am&eacute;liorations continues.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f8f9fd;border:1px solid #e2e8f0;border-radius:8px;margin:0 0 18px;">
                <tr>
                  <td style="padding:14px 16px;font-size:13px;color:#334155;">
                    <strong style="color:#363886;">Votre profil :</strong> ${roleLabel}
                    <br />
                    <strong style="color:#363886;">Processus rattach&eacute;(s) :</strong>
                    <ul style="margin:4px 0 0;padding-left:18px;">${processusListe}</ul>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 14px;font-size:14px;line-height:22px;color:#334155;">
                Vous n'avez pas encore de compte sur le portail : pour activer votre acc&egrave;s, suivez ces 3 &eacute;tapes &mdash;
              </p>
              <ol style="margin:0 0 18px;padding-left:20px;font-size:14px;line-height:24px;color:#334155;">
                <li>Cliquez sur le bouton <strong>&laquo; Cr&eacute;er mon acc&egrave;s &raquo;</strong> ci-dessous.</li>
                <li>Sur la page qui s'ouvre, cliquez sur <strong>&laquo; Sign up &raquo;</strong> (ou &laquo; Cr&eacute;er un compte &raquo;) &mdash; pas sur &laquo; Se connecter &raquo;, puisque vous n'avez pas encore de mot de passe.</li>
                <li>Renseignez votre email professionnel et choisissez un mot de passe.</li>
              </ol>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
                <tr>
                  <td style="background-color:#363886;border-radius:8px;">
                    <a href="${APP_URL}" style="display:inline-block;padding:12px 26px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">Cr&eacute;er mon acc&egrave;s</a>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#fef7e6;border:1px solid #f5e2b8;border-radius:8px;margin:0 0 6px;">
                <tr>
                  <td style="padding:14px 16px;font-size:13px;line-height:20px;color:#7a5b12;">
                    <strong>&#9888; Au total, vous allez recevoir trois emails</strong><br />
                    Les deux suivants sont en anglais et envoy&eacute;s par le m&ecirc;me exp&eacute;diteur technique,
                    <strong>no-reply@base44-apps.com</strong> (la plateforme qui h&eacute;berge le portail). C'est normal, aucune inqui&eacute;tude &agrave; avoir :
                    <ul style="margin:8px 0 8px;padding-left:18px;">
                      <li style="margin:2px 0;">
                        <strong>&laquo; You're invited to join PORTAL-QHSE_IDR &raquo;</strong> (avant ou apr&egrave;s cet email) :
                        <strong>aucune action requise</strong>, il vous suffit de suivre les 3 &eacute;tapes ci-dessus
                        (bouton &laquo; Cr&eacute;er mon acc&egrave;s &raquo; puis &laquo; Sign up &raquo;).
                      </li>
                      <li style="margin:2px 0;">
                        <strong>&laquo; Verify your email for PORTAL-QHSE_IDR &raquo;</strong> : re&ccedil;u juste apr&egrave;s avoir choisi votre mot de passe
                        via &laquo; Sign up &raquo;. Il contient un <strong>code &agrave; 6 chiffres</strong> &agrave; recopier sur la page d'inscription
                        pour terminer la cr&eacute;ation de votre compte &mdash; <strong>sans cette &eacute;tape, votre inscription ne sera pas compl&egrave;te</strong>.
                      </li>
                    </ul>
                    Pensez &agrave; v&eacute;rifier votre dossier &laquo; Courriers ind&eacute;sirables &raquo; et &agrave; ajouter
                    <strong style="color:#363886;">${SENDER_EMAIL}</strong> &agrave; vos contacts afin de recevoir toutes les notifications du portail.
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 0;font-size:13px;line-height:20px;color:#334155;">
                &Agrave; tr&egrave;s bient&ocirc;t sur le portail,<br />
                <strong>L'&eacute;quipe QHSE &mdash; IDRental</strong>
              </p>
            </td>
          </tr>
          <!-- Pied de page -->
          <tr>
            <td style="padding:16px 28px;background-color:#f8f9fd;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">
                Cet email vous a &eacute;t&eacute; envoy&eacute; car vous avez &eacute;t&eacute; invit&eacute;(e) sur le Portail QHSE d'IDRental.
                Si vous ne connaissez pas l'auteur de cette invitation, vous pouvez ignorer ce message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return base44.functions.invoke("sendEmailBrevo", { to, subject, html });
}