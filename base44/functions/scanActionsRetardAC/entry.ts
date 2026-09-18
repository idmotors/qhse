import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { SCAN_CRON_SECRET } from "../../shared/scanSecret.ts";
import { formatDateFr } from "../../shared/dateFormat.ts";

const APP_URL = "https://portal-qhse-idrental.base44.app";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    // Sécurité — ce scan privilégié (service role, contournement de la RLS)
    // ne peut être déclenché que par le planificateur interne (workflows),
    // qui présente le secret partagé à chaque appel.
    const { secret } = await req.json().catch(() => ({}));
    if (secret !== SCAN_CRON_SECRET) {
      return Response.json(
        { error: "Forbidden : ce scan est réservé au planificateur interne." },
        { status: 403 }
      );
    }
    const svc = base44.asServiceRole;
    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Résoudre l'équipe QHSE : pilotes des processus "HSE" ET "SMQ / Amélioration continue" (dédoublonnés)
    const processus = await svc.entities.Processus.list();
    const procEmails = {};
    for (const p of processus) {
      procEmails[p.nom] = (p.responsableEmails || []).filter(Boolean);
    }
    const hseEmails = [...new Set([...(procEmails["HSE"] || []), ...(procEmails["SMQ / Amélioration continue"] || [])])];

    // 2. Actions AC en retard non encore notifiées
    //    Règle stricte : statut "En cours" ET date de fin prévue dépassée (jamais "en retard" si réalisée/standby/abandonnée)
    //    Garde anti-doublon : retardNotifie (une notif par action)
    const actions = await svc.entities.ActionAmelioration.list();
    const overdue = actions.filter(a => {
      if (!a || a.retardNotifie) return false;
      if (a.statut !== "En cours") return false;
      if (!a.dateFinPrevue) return false;
      return a.dateFinPrevue < todayStr;
    });

    // (sans équipe QHSE configurée et des actions en retard : comportement d'origine préservé ;
    //  sinon on continue vers le rappel préventif plus bas)
    if (hseEmails.length === 0 && overdue.length > 0) {
      return Response.json({ status: "ok", notified: 0, warning: "Aucun email QHSE configuré" });
    }

    // 3. Regrouper par fiche AC et récupérer les fiches
    const acIds = [...new Set(overdue.map(a => a.acId).filter(Boolean))];
    const acMap = {};
    for (const id of acIds) {
      try { acMap[id] = await svc.entities.AmeliorationContinue.get(id); }
      catch (e) { console.warn("[scanActionsRetardAC] AmeliorationContinue.get failed", { id, err: String(e?.message || e) }); }
    }

    // 4. Notifier l'équipe QHSE pour chaque fiche concernée
    //    Une fiche clôturée ou abandonnée n'est plus concernée → ignorée.
    const joursRetard = (d) => Math.max(1, Math.round((Date.parse(todayStr) - Date.parse(d)) / 86400000));
    let notifCount = 0;
    const notifiedActionIds = [];
    for (const id of acIds) {
      const ac = acMap[id];
      if (!ac || ac.statut === "Clôturée" || ac.statut === "Abandonnée") continue;
      const acActions = overdue.filter(a => a.acId === id);
      const acLien = `${APP_URL}/ACDetail?id=${id}`;
      const titre = `Actions AC en retard sur ${ac.numero || ""}`.trim();
      const listLines = acActions.map(a => {
        return `- ${a.description || "(sans intitulé)"}
  • Processus concerné : ${a.responsable || "non assigné"}
  • Date de fin prévue : ${formatDateFr(a.dateFinPrevue)}
  • Retard : ${joursRetard(a.dateFinPrevue)} jour(s)`;
      }).join("\n");
      const message = `Des actions de la fiche d'amélioration continue "${ac.numero || ""}" ont dépassé leur échéance :

${listLines}

🔗 Accéder à l'AC : ${acLien}

Cordialement,
Le système QHSE`;

      acActions.forEach(a => notifiedActionIds.push(a.id));

      for (const email of hseEmails) {
        notifCount++;
        await svc.entities.Notification.create({
          destinataire: email, type: "Retard AC", titre, message, lu: false, lienType: "ac", lienId: id,
        }).catch(e => console.warn("[scanActionsRetardAC] Notification.create failed", { email, err: String(e?.message || e) }));
        // Envoi email via Brevo (même fonction backend que notifyAC côté client)
        await svc.functions.invoke("sendEmailBrevo", { to: email, subject: titre, body: message, secret: SCAN_CRON_SECRET })
          .then(res => console.info("[scanActionsRetardAC] sendEmailBrevo ok", { email, messageId: res?.data?.messageId }))
          .catch(e => {
            // Ne pas masquer l'erreur (ex. domaine pas encore authentifié côté Brevo)
            const detail = e?.response?.data || String(e?.message || e);
            console.warn("[scanActionsRetardAC] sendEmailBrevo failed", { email, err: detail });
          });
      }

      // 5. Relances directes aux pilotes du processus responsable de chaque action en retard
      //    (emails figés dans responsablesProcessus de l'action, dédoublonnés avec l'équipe QHSE déjà notifiée)
      for (const a of acActions) {
        const pilots = [...new Set((a.responsablesProcessus || []).filter(Boolean))].filter(e => !hseEmails.includes(e) && e !== a.assigneEmail);
        if (pilots.length === 0) continue;
        const titrePilote = `Action en retard — ${ac.numero || ""}`.trim();
        const messagePilote = `Bonjour,

Une action d'amélioration continue dont votre processus est responsable a dépassé son échéance :

📌 Fiche AC : ${ac.numero || ""}
📝 Action : ${a.description || "(sans intitulé)"}
🏭 Processus responsable : ${a.responsableNom || a.responsable || "—"}
📅 Date de fin prévue : ${formatDateFr(a.dateFinPrevue)}
⏱️ Retard : ${joursRetard(a.dateFinPrevue)} jour(s)

Merci de la finaliser ou de mettre à jour son statut.

🔗 Accéder à l'AC : ${acLien}

Cordialement,
Le système QHSE`;
        for (const email of pilots) {
          notifCount++;
          await svc.entities.Notification.create({
            destinataire: email, type: "Retard AC", titre: titrePilote, message: messagePilote, lu: false, lienType: "ac", lienId: id,
          }).catch(e => console.warn("[scanActionsRetardAC] Notification.create (pilote) failed", { email, err: String(e?.message || e) }));
          await svc.functions.invoke("sendEmailBrevo", { to: email, subject: titrePilote, body: messagePilote, secret: SCAN_CRON_SECRET })
            .then(res => console.info("[scanActionsRetardAC] sendEmailBrevo (pilote) ok", { email, messageId: res?.data?.messageId }))
            .catch(e => {
              const detail = e?.response?.data || String(e?.message || e);
              console.warn("[scanActionsRetardAC] sendEmailBrevo (pilote) failed", { email, err: detail });
            });
        }
      }
    }

    // 5. Marquer uniquement les actions réellement notifiées (garde anti-spam)
    if (notifiedActionIds.length > 0) {
      const toMark = notifiedActionIds.map(aid => ({ id: aid, retardNotifie: true }));
      await svc.entities.ActionAmelioration.bulkUpdate(toMark).catch(e => console.warn("[scanActionsRetardAC] bulkUpdate failed", { err: String(e?.message || e) }));
    }

    // 6. Relances individuelles aux membres sous-assignés (garde distincte : retardAssigneNotifie)
    const overdueAssigne = actions.filter(a =>
      a && a.assigneEmail && !a.retardAssigneNotifie &&
      a.statut === "En cours" && a.dateFinPrevue && a.dateFinPrevue < todayStr
    );
    const assigneMarked = [];
    for (const a of overdueAssigne) {
      let ac = acMap[a.acId];
      if (!ac) {
        try { ac = acMap[a.acId] = await svc.entities.AmeliorationContinue.get(a.acId); }
        catch (e) { console.warn("[scanActionsRetardAC] AmeliorationContinue.get (relance assigné) failed", { id: a.acId, err: String(e?.message || e) }); }
      }
      if (!ac || ac.statut === "Clôturée" || ac.statut === "Abandonnée") continue;
      const acLien = `${APP_URL}/ACDetail?id=${a.acId}`;
      const titre = `Action assignée en retard — AC ${ac.numero || ""}`.trim();
      const message = `Bonjour,

Une action d'amélioration continue qui vous a été assignée individuellement a dépassé son échéance.

📌 Référence AC : ${ac.numero || ""}
📝 Action : ${a.description || "(sans intitulé)"}
🏭 Processus responsable : ${a.responsableNom || a.responsable || "—"}
📅 Date de fin prévue : ${formatDateFr(a.dateFinPrevue)}
⏱️ Retard : ${joursRetard(a.dateFinPrevue)} jour(s)

Merci de la finaliser ou de mettre à jour son statut.

🔗 Accéder à l'AC : ${acLien}

Cordialement,
Le système QHSE`;
      notifCount++;
      await svc.entities.Notification.create({
        destinataire: a.assigneEmail, type: "Retard AC", titre, message, lu: false, lienType: "ac", lienId: a.acId,
      }).catch(e => console.warn("[scanActionsRetardAC] Notification.create (relance assigné) failed", { email: a.assigneEmail, err: String(e?.message || e) }));
      await svc.functions.invoke("sendEmailBrevo", { to: a.assigneEmail, subject: titre, body: message, secret: SCAN_CRON_SECRET })
        .then(res => console.info("[scanActionsRetardAC] sendEmailBrevo (relance assigné) ok", { email: a.assigneEmail, messageId: res?.data?.messageId }))
        .catch(e => {
          const detail = e?.response?.data || String(e?.message || e);
          console.warn("[scanActionsRetardAC] sendEmailBrevo (relance assigné) failed", { email: a.assigneEmail, err: detail });
        });
      assigneMarked.push({ id: a.id, retardAssigneNotifie: true });
    }
    if (assigneMarked.length > 0) {
      await svc.entities.ActionAmelioration.bulkUpdate(assigneMarked).catch(e => console.warn("[scanActionsRetardAC] bulkUpdate (relance assigné) failed", { err: String(e?.message || e) }));
    }

    // 7. Rappels préventifs — échéance dans les 3 prochains jours, une seule fois par action
    //    (garde anti-doublon : rappelPreventifNotifie, remise à false si l'échéance est modifiée)
    const limiteStr = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const preventif = actions.filter(a => {
      if (!a || a.rappelPreventifNotifie) return false;
      if (a.statut !== "En cours") return false;
      if (!a.dateFinPrevue) return false;
      return a.dateFinPrevue >= todayStr && a.dateFinPrevue <= limiteStr;
    });
    const preventifMarked = [];
    for (const a of preventif) {
      let ac = acMap[a.acId];
      if (!ac) {
        try { ac = acMap[a.acId] = await svc.entities.AmeliorationContinue.get(a.acId); }
        catch (e) { console.warn("[scanActionsRetardAC] AmeliorationContinue.get (rappel préventif) failed", { id: a.acId, err: String(e?.message || e) }); }
      }
      if (!ac || ac.statut === "Clôturée" || ac.statut === "Abandonnée") continue;
      const joursRestants = Math.max(0, Math.round((Date.parse(a.dateFinPrevue) - Date.parse(todayStr)) / 86400000));
      const acLien = `${APP_URL}/ACDetail?id=${a.acId}`;
      const titre = `Échéance proche — action d'amélioration sur ${ac.numero || ""}`.trim();
      const message = `Bonjour,

Une action d'amélioration continue arrive à échéance d'ici ${joursRestants} jour(s) — merci de la finaliser à temps pour éviter un retard :

📌 Fiche AC : ${ac.numero || ""}
📝 Action : ${a.description || "(sans intitulé)"}
🏭 Processus responsable : ${a.responsableNom || a.responsable || "—"}
📅 Date de fin prévue : ${formatDateFr(a.dateFinPrevue)}
⏰ Échéance dans ${joursRestants} jour(s)

🔗 Accéder à l'AC : ${acLien}

Cordialement,
Le système QHSE`;
      // Destinataires : pilotes du processus responsable + membre sous-assigné (dédoublonnés)
      const dests = [...new Set([
        ...((a.responsablesProcessus || []).filter(Boolean)),
        ...(a.assigneEmail ? [a.assigneEmail] : []),
      ])];
      if (dests.length === 0) continue; // aucun destinataire → le scan réessaiera demain
      for (const email of dests) {
        notifCount++;
        await svc.entities.Notification.create({
          destinataire: email, type: "Relance", titre, message, lu: false, lienType: "ac", lienId: a.acId,
        }).catch(e => console.warn("[scanActionsRetardAC] Notification.create (rappel préventif) failed", { email, err: String(e?.message || e) }));
        await svc.functions.invoke("sendEmailBrevo", { to: email, subject: titre, body: message, secret: SCAN_CRON_SECRET })
          .then(res => console.info("[scanActionsRetardAC] sendEmailBrevo (rappel préventif) ok", { email, messageId: res?.data?.messageId }))
          .catch(e => {
            const detail = e?.response?.data || String(e?.message || e);
            console.warn("[scanActionsRetardAC] sendEmailBrevo (rappel préventif) failed", { email, err: detail });
          });
      }
      preventifMarked.push({ id: a.id, rappelPreventifNotifie: true });
    }
    if (preventifMarked.length > 0) {
      await svc.entities.ActionAmelioration.bulkUpdate(preventifMarked).catch(e => console.warn("[scanActionsRetardAC] bulkUpdate (rappel préventif) failed", { err: String(e?.message || e) }));
    }

    return Response.json({ status: "ok", notified: notifCount, overdueActions: overdue.length, acs: acIds.length, relancesAssignes: assigneMarked.length, rappelsPreventifs: preventifMarked.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}