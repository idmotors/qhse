import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from "base44:runtime";
import { SCAN_CRON_SECRET } from "../../shared/scanSecret.ts";

// Fonction backend : envoi d'email transactionnel via l'API Brevo.
// La clé API Brevo est lue depuis les secrets de la plateforme —
// elle ne transite jamais côté navigateur.
//
// Appel depuis le frontend :
//   base44.functions.invoke("sendEmailBrevo", { to, subject, body })
// Appel depuis une autre fonction backend (ex. scanActionsRetard) :
//   svc.functions.invoke("sendEmailBrevo", { to, subject, body })

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const SENDER_EMAIL = "systeme-notifications@idrental.mg";
const SENDER_NAME = "QHSE - Système de gestion";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const { to, subject, body, html, secret } = await req.json();

    // Sécurité — l'appelant doit être soit un utilisateur connecté de l'app,
    // soit le planificateur interne (workflows / fonctions backend) qui
    // présente le secret partagé. Tout appel non authentifié est refusé.
    const user = await base44.auth.me().catch(() => null);
    const trustedInternal = secret === SCAN_CRON_SECRET;
    if (!user && !trustedInternal) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!to || !subject || (!body && !html)) {
      return Response.json(
        {
          success: false,
          error:
            "Paramètres manquants : 'to', 'subject' et 'body' (ou 'html') sont requis.",
        },
        { status: 400 }
      );
    }

    // Sécurité — anti-relais, réservé au planificateur interne (appels sans
    // utilisateur connecté, ex. scans de retard) : le destinataire doit être
    // un utilisateur déjà enregistré du portail. Pour un appel effectué par un
    // utilisateur authentifié (ex. e-mail de bienvenue juste après une
    // invitation), on ne l'exige pas : le destinataire vient d'être invité
    // et n'est pas encore dans User — l'authentification de l'appelant suffit.
    if (!user) {
      const users = await base44.asServiceRole.entities.User.list().catch(() => []);
      const destinataireConnu = (users || []).some(
        (u) => String(u.email || "").toLowerCase() === String(to).toLowerCase()
      );
      if (!destinataireConnu) {
      return Response.json(
        {
          success: false,
          error:
            "Destinataire non autorisé : seuls les utilisateurs enregistrés du portail peuvent recevoir un e-mail.",
        },
        { status: 403 }
      );
      }
    }

    const apiKey = secrets.get("BREVO_API_KEY");
    if (!apiKey) {
      return Response.json(
        {
          success: false,
          error:
            "BREVO_API_KEY n'est pas configurée dans les secrets de ce projet Base44.",
        },
        { status: 500 }
      );
    }

    const htmlContent = html || `<p>${String(body).replace(/\n/g, "<br>")}</p>`;

    const brevoRes = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent,
      }),
    });

    const data = await brevoRes.json().catch(() => ({}));

    if (!brevoRes.ok) {
      // Ne jamais masquer l'erreur, notamment pendant la période de
      // propagation DNS DKIM/DMARC : on remonte le détail exact renvoyé
      // par Brevo (code + message) plutôt que de l'avaler silencieusement.
      return Response.json(
        {
          success: false,
          status: brevoRes.status,
          error:
            data?.message ||
            data?.code ||
            "Erreur inconnue renvoyée par l'API Brevo.",
          brevoResponse: data,
        },
        { status: brevoRes.status }
      );
    }

    return Response.json({ success: true, messageId: data.messageId });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}