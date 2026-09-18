import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const APP_URL = "https://portal-qhse-idrental.base44.app";

// Vérification et transition d'une fiche AC côté serveur (lecture privilégiée service
// role, non soumise aux restrictions de lecture de l'appelant) : la fiche est clôturée
// quand toutes ses actions sont en état final avec au moins une « Réalisée » ; si toutes
// sont « Abandonnée », elle passe au statut « Abandonnée ». La transition
// (statut, historique, recalcul responsablesProcessus) et la notification
// (in-app + email) sont atomiques côté backend.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { acId } = await req.json().catch(() => ({}));
    if (!acId) {
      return Response.json({ error: "Paramètre manquant : 'acId' est requis." }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const [fiche, actions] = await Promise.all([
      svc.entities.AmeliorationContinue.get(acId).catch(() => null),
      svc.entities.ActionAmelioration.filter({ acId }),
    ]);
    if (!fiche) {
      return Response.json({ error: "Fiche AC introuvable." }, { status: 404 });
    }

    const total = (actions || []).length;
    const realized = (actions || []).filter(a => a && a.statut === "Réalisée").length;
    const abandoned = (actions || []).filter(a => a && a.statut === "Abandonnée").length;
    const pending = total - realized - abandoned; // encore "En cours" ou "En standby"
    const allResolved = total > 0 && pending === 0;

    // Garde : ne déclenche que si la fiche est encore "À traiter" ou "En cours"
    // (jamais deux déclenchements, ni écrasement d'un arbitrage manuel déjà en cours).
    if (!allResolved || !["À traiter", "En cours"].includes(fiche.statut)) {
      return Response.json({ status: "ok", closed: false, abandoned: false, numero: fiche.numero || null, totalActions: total, realizedActions: realized, abandonedActions: abandoned });
    }

    // Transition atomique : toutes les actions sont en état final.
    // - au moins une « Réalisée » → clôture normale (« Clôturée »)
    // - aucune réalisée (toutes abandonnées) → la fiche passe à « Abandonnée »
    // + recalcul de l'union des responsables des actions liées (même logique que l'ancien checkAutoClosure côté client).
    const allAbandoned = realized === 0;
    const union = [...new Set((actions || []).flatMap(a => a.responsablesProcessus || []))];
    await svc.entities.AmeliorationContinue.update(acId, {
      statut: allAbandoned ? "Abandonnée" : "Clôturée",
      ...(allAbandoned ? {} : { dateCloture: new Date().toISOString() }),
      ...(union.length > 0 ? { responsablesProcessus: union } : {}),
      historique: [
        ...(fiche.historique || []),
        allAbandoned
          ? { date: new Date().toISOString(), type: "Changement de statut", auteur: "Système", detail: "Toutes les actions ont été abandonnées" }
          : { date: new Date().toISOString(), type: "Clôture auto", auteur: "Système", detail: abandoned > 0 ? "Toutes les actions réalisées ou abandonnées" : "Toutes les actions réalisées" },
      ],
    });

    // Notification « all_actions_done » : initiateur + équipe QHSE (in-app + email).
    // Les emails sont envoyés avec la session de l'appelant (sendEmailBrevo authentifié).
    const processus = await svc.entities.Processus.list().catch(() => []);
    const procEmails = {};
    for (const p of processus || []) {
      procEmails[p.nom] = (p.responsableEmails || []).filter(Boolean);
    }
    const hseEmails = [...new Set([...(procEmails["HSE"] || []), ...(procEmails["SMQ / Amélioration continue"] || [])])];
    const recipients = [...new Set([...(fiche.initiateurEmail ? [fiche.initiateurEmail] : []), ...hseEmails])].filter(Boolean);

    if (recipients.length > 0) {
      const acLien = `${APP_URL}/ACDetail?id=${acId}`;
      const tronque = (s, n) => (s && s.length > n ? `${s.slice(0, n)}…` : s || "");
      let titre, message, body;
      if (allAbandoned) {
        titre = `AC ${fiche.numero || ""} abandonnée — toutes les actions ont été abandonnées`.trim();
        message = `Toutes les actions de l'AC "${fiche.numero || ""}" ont été abandonnées. La fiche est passée au statut « Abandonnée ».`;
        body = `Bonjour,

Toutes les actions d'amélioration continue d'une fiche AC ont été abandonnées. La fiche est passée au statut « Abandonnée ».

📌 Référence AC : ${fiche.numero || ""}
📄 Constat : ${tronque(fiche.constat, 400) || "—"}
✏️ Amélioration souhaitée : ${tronque(fiche.descriptionAmelioration, 400) || "—"}
👤 Initiateur : ${fiche.initiateur || "—"}

🔗 Accéder à l'AC : ${acLien}

Cordialement,
Le système QHSE`;
      } else {
        titre = `AC ${fiche.numero || ""} clôturée`.trim();
        message = `Toutes les actions de l'AC "${fiche.numero || ""}" sont réalisées${abandoned > 0 ? " ou abandonnées" : ""}. La fiche est clôturée.`;
        body = `Bonjour,

Toutes les actions d'amélioration continue d'une fiche AC sont réalisées${abandoned > 0 ? " ou abandonnées" : ""}. La fiche est clôturée.

📌 Référence AC : ${fiche.numero || ""}
📄 Constat : ${tronque(fiche.constat, 400) || "—"}
✏️ Amélioration mise en œuvre : ${tronque(fiche.descriptionAmelioration, 400) || "—"}
👤 Initiateur : ${fiche.initiateur || "—"}

🔗 Accéder à l'AC : ${acLien}

Cordialement,
Le système QHSE`;
      }

      for (const email of recipients) {
        await svc.entities.Notification.create({
          destinataire: email, type: allAbandoned ? "Changement statut" : "Clôture AC", titre, message, lu: false, lienType: "ac", lienId: acId,
        }).catch(e => console.warn("[checkAcClosure] Notification.create failed", { email, err: String(e?.message || e) }));
        await base44.functions.invoke("sendEmailBrevo", { to: email, subject: titre, body })
          .then(res => console.info("[checkAcClosure] sendEmailBrevo ok", { email, messageId: res?.data?.messageId }))
          .catch(e => {
            // Ne pas masquer l'erreur (ex. domaine pas encore authentifié côté Brevo)
            const detail = e?.response?.data || String(e?.message || e);
            console.warn("[checkAcClosure] sendEmailBrevo failed", { email, err: detail });
          });
      }
    }

    return Response.json({ status: "ok", closed: !allAbandoned, abandoned: allAbandoned, numero: fiche.numero || null, totalActions: total, realizedActions: realized, abandonedActions: abandoned, notified: recipients.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}