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

    // 1. Résoudre les responsables par processus (dont l'équipe HSE)
    const processus = await svc.entities.Processus.list();
    const procEmails = {};
    for (const p of processus) {
      procEmails[p.nom] = (p.responsableEmails || []).filter(Boolean);
    }
    // L'équipe QHSE regroupe les processus "HSE" ET "SMQ / Amélioration continue" (dédoublonnés)
    const hseEmails = [...new Set([...(procEmails["HSE"] || []), ...(procEmails["SMQ / Amélioration continue"] || [])])];

    // 2. Actions en retard non encore notifiées
    //    Règle : date actuelle > date de fin prévue ET statut ≠ "Terminée"
    //    Garde anti-doublon : retardNotifie (une notif par action)
    const actions = await svc.entities.Action.list();
    const doneStatuts = ["Terminé", "Réalisée"];
    const overdue = actions.filter(a => {
      if (!a || a.retardNotifie) return false;
      if (doneStatuts.includes(a.statut)) return false;
      if (a.dateRealisationEffective) return false;
      if (!a.dateFinPrevue) return false;
      return a.dateFinPrevue < todayStr;
    });

    // (aucune action en retard → les boucles ci-dessous ne font rien ;
    //  on continue vers le rappel préventif plus bas)

    // 3. Regrouper par NC et récupérer les fiches NC
    const ncIds = [...new Set(overdue.map(a => a.ncId).filter(Boolean))];
    const ncMap = {};
    for (const id of ncIds) {
      try { ncMap[id] = await svc.entities.NonConformite.get(id); }
      catch (e) { console.warn("[scanActionsRetard] NonConformite.get failed", { id, err: String(e?.message || e) }); }
    }

    // 4. Notifier, pour chaque NC concernée : l'équipe HSE + les responsables
    //    des processus portant les actions en retard (dédoublonnés).
    //    Une NC clôturée n'est plus concernée → ignorée.
    const joursRetard = (d) => Math.max(1, Math.round((Date.parse(todayStr) - Date.parse(d)) / 86400000));
    let notifCount = 0;
    const notifiedActionIds = [];
    for (const id of ncIds) {
      const nc = ncMap[id];
      if (!nc || nc.statut === "Clôturée") continue;
      const ncActions = overdue.filter(a => a.ncId === id);
      const ncLien = `${APP_URL}/NCDetail?id=${id}`;
      const titre = `Actions correctives en retard sur ${nc.numero || ""}`.trim();
      const listLines = ncActions.map(a => {
        return `- ${a.description || "(sans intitulé)"}
  • Réf. action : ${a.id}
  • Processus concerné : ${a.responsable || "non assigné"}
  • Responsable : ${a.responsableNom || a.responsable || "non assigné"}
  • Date de fin prévue : ${formatDateFr(a.dateFinPrevue)}
  • Retard : ${joursRetard(a.dateFinPrevue)} jour(s)`;
      }).join("\n");
      const message = `Des actions correctives sur la NC "${nc.titre || nc.numero || ""}" ont dépassé leur échéance :

${listLines}

🔗 Accéder à la NC : ${ncLien}

Cordialement,
Le système QHSE`;

      // Destinataires : équipe HSE + responsables des processus concernés (dédoublonnés, e-mails valides)
      const dests = [...new Set([
        ...hseEmails,
        ...ncActions.flatMap(a => procEmails[a.responsable] || []),
      ])].filter(Boolean);
      // Aucun destinataire valide → on ne marque pas l'action : le scan réessaiera demain
      if (dests.length === 0) continue;
      ncActions.forEach(a => notifiedActionIds.push(a.id));

      for (const email of dests) {
        notifCount++;
        await svc.entities.Notification.create({
          destinataire: email, type: "Retard", titre, message, lu: false, lienType: "nc", lienId: id,
        }).catch(e => console.warn("[scanActionsRetard] Notification.create failed", { email, err: String(e?.message || e) }));
        // --- Ancien mécanisme natif Base44 (conservé pour rollback rapide) ---
        // await svc.integrations.Core.SendEmail({
        //   to: email, from_name: "QHSE - Système de gestion", subject: titre, body: message,
        // }).catch(() => {});
        // --- Nouveau mécanisme : envoi via Brevo (même fonction backend que notifyProcessus) ---
        await svc.functions.invoke("sendEmailBrevo", { to: email, subject: titre, body: message, secret: SCAN_CRON_SECRET })
          .then(res => console.info("[scanActionsRetard] sendEmailBrevo ok", { email, messageId: res?.data?.messageId }))
          .catch(e => {
            // Ne pas masquer l'erreur (ex. domaine idrental.mg pas encore authentifié côté Brevo)
            const detail = e?.response?.data || String(e?.message || e);
            console.warn("[scanActionsRetard] sendEmailBrevo failed", { email, err: detail });
          });
      }
    }

    // 5. Marquer uniquement les actions réellement notifiées (garde anti-spam)
    if (notifiedActionIds.length > 0) {
      const toMark = notifiedActionIds.map(aid => ({ id: aid, retardNotifie: true }));
      await svc.entities.Action.bulkUpdate(toMark).catch(e => console.warn("[scanActionsRetard] bulkUpdate failed", { err: String(e?.message || e) }));
    }

    // 6. Relances individuelles aux membres sous-assignés (garde distincte : retardAssigneNotifie)
    const overdueAssigne = actions.filter(a =>
      a && a.assigneEmail && !a.retardAssigneNotifie &&
      !doneStatuts.includes(a.statut) && !a.dateRealisationEffective &&
      a.dateFinPrevue && a.dateFinPrevue < todayStr
    );
    const assigneMarked = [];
    for (const a of overdueAssigne) {
      let nc = ncMap[a.ncId];
      if (!nc) {
        try { nc = ncMap[a.ncId] = await svc.entities.NonConformite.get(a.ncId); }
        catch (e) { console.warn("[scanActionsRetard] NonConformite.get (relance assigné) failed", { id: a.ncId, err: String(e?.message || e) }); }
      }
      if (!nc || nc.statut === "Clôturée") continue;
      const ncLien = `${APP_URL}/NCDetail?id=${a.ncId}`;
      const titre = `Action assignée en retard — NC ${nc.numero || ""}`.trim();
      const message = `Bonjour,

Une action corrective qui vous a été assignée individuellement a dépassé son échéance.

📌 Référence NC : ${nc.numero || ""}
📝 Action : ${a.description || "(sans intitulé)"}
🏭 Processus responsable : ${a.responsableNom || a.responsable || "—"}
📅 Date de fin prévue : ${formatDateFr(a.dateFinPrevue)}
⏱️ Retard : ${joursRetard(a.dateFinPrevue)} jour(s)

Merci de la finaliser ou de mettre à jour son statut.

🔗 Accéder à la NC : ${ncLien}

Cordialement,
Le système QHSE`;
      notifCount++;
      await svc.entities.Notification.create({
        destinataire: a.assigneEmail, type: "Retard", titre, message, lu: false, lienType: "nc", lienId: a.ncId,
      }).catch(e => console.warn("[scanActionsRetard] Notification.create (relance assigné) failed", { email: a.assigneEmail, err: String(e?.message || e) }));
      await svc.functions.invoke("sendEmailBrevo", { to: a.assigneEmail, subject: titre, body: message, secret: SCAN_CRON_SECRET })
        .then(res => console.info("[scanActionsRetard] sendEmailBrevo (relance assigné) ok", { email: a.assigneEmail, messageId: res?.data?.messageId }))
        .catch(e => {
          const detail = e?.response?.data || String(e?.message || e);
          console.warn("[scanActionsRetard] sendEmailBrevo (relance assigné) failed", { email: a.assigneEmail, err: detail });
        });
      assigneMarked.push({ id: a.id, retardAssigneNotifie: true });
    }
    if (assigneMarked.length > 0) {
      await svc.entities.Action.bulkUpdate(assigneMarked).catch(e => console.warn("[scanActionsRetard] bulkUpdate (relance assigné) failed", { err: String(e?.message || e) }));
    }

    // 7. Rappels préventifs — échéance dans les 3 prochains jours, une seule fois par action
    //    (garde anti-doublon : rappelPreventifNotifie, remise à false si l'échéance est modifiée)
    const limiteStr = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const preventif = actions.filter(a => {
      if (!a || a.rappelPreventifNotifie) return false;
      if (doneStatuts.includes(a.statut) || a.dateRealisationEffective) return false;
      if (!a.dateFinPrevue) return false;
      return a.dateFinPrevue >= todayStr && a.dateFinPrevue <= limiteStr;
    });
    const preventifMarked = [];
    for (const a of preventif) {
      let nc = ncMap[a.ncId];
      if (!nc) {
        try { nc = ncMap[a.ncId] = await svc.entities.NonConformite.get(a.ncId); }
        catch (e) { console.warn("[scanActionsRetard] NonConformite.get (rappel préventif) failed", { id: a.ncId, err: String(e?.message || e) }); }
      }
      if (!nc || nc.statut === "Clôturée") continue;
      const joursRestants = Math.max(0, Math.round((Date.parse(a.dateFinPrevue) - Date.parse(todayStr)) / 86400000));
      const ncLien = `${APP_URL}/NCDetail?id=${a.ncId}`;
      const titre = `Échéance proche — action corrective sur ${nc.numero || ""}`.trim();
      const message = `Bonjour,

Une action corrective arrive à échéance d'ici ${joursRestants} jour(s) — merci de la finaliser à temps pour éviter un retard :

📌 Référence NC : ${nc.numero || ""}
📝 Action : ${a.description || "(sans intitulé)"}
🏭 Processus responsable : ${a.responsableNom || a.responsable || "—"}
📅 Date de fin prévue : ${formatDateFr(a.dateFinPrevue)}
⏰ Échéance dans ${joursRestants} jour(s)

🔗 Accéder à la NC : ${ncLien}

Cordialement,
Le système QHSE`;
      // Destinataires : responsables du processus + membre sous-assigné (dédoublonnés)
      const dests = [...new Set([
        ...(procEmails[a.responsable] || []),
        ...(a.assigneEmail ? [a.assigneEmail] : []),
      ])].filter(Boolean);
      if (dests.length === 0) continue; // aucun destinataire → le scan réessaiera demain
      for (const email of dests) {
        notifCount++;
        await svc.entities.Notification.create({
          destinataire: email, type: "Relance", titre, message, lu: false, lienType: "nc", lienId: a.ncId,
        }).catch(e => console.warn("[scanActionsRetard] Notification.create (rappel préventif) failed", { email, err: String(e?.message || e) }));
        await svc.functions.invoke("sendEmailBrevo", { to: email, subject: titre, body: message, secret: SCAN_CRON_SECRET })
          .then(res => console.info("[scanActionsRetard] sendEmailBrevo (rappel préventif) ok", { email, messageId: res?.data?.messageId }))
          .catch(e => {
            const detail = e?.response?.data || String(e?.message || e);
            console.warn("[scanActionsRetard] sendEmailBrevo (rappel préventif) failed", { email, err: detail });
          });
      }
      preventifMarked.push({ id: a.id, rappelPreventifNotifie: true });
    }
    if (preventifMarked.length > 0) {
      await svc.entities.Action.bulkUpdate(preventifMarked).catch(e => console.warn("[scanActionsRetard] bulkUpdate (rappel préventif) failed", { err: String(e?.message || e) }));
    }

    // 8. Actions immédiates en retard — même scan quotidien, garde anti-doublon
    //    distincte (retardNotifie sur ActionImmediate), PAS de rappel préventif
    //    (échéance courte de 48h : seul le retard une fois dépassé est notifié).
    //    Destinataires : pilotes du processus responsable de l'action + équipe QHSE en copie.
    const imm = await svc.entities.ActionImmediate.list();
    const immOverdue = imm.filter(a => {
      if (!a || a.retardNotifie) return false;
      if (a.statut === "Réalisée" || a.dateRealisationEffective) return false;
      if (!a.dateFinPrevue) return false;
      return a.dateFinPrevue < todayStr;
    });
    const immNcIds = [...new Set(immOverdue.map(a => a.ncId).filter(Boolean))];
    const immMarked = [];
    for (const id of immNcIds) {
      let nc = ncMap[id];
      if (!nc) {
        try { nc = ncMap[id] = await svc.entities.NonConformite.get(id); }
        catch (e) { console.warn("[scanActionsRetard] NonConformite.get (actions immédiates) failed", { id, err: String(e?.message || e) }); }
      }
      if (!nc || nc.statut === "Clôturée") continue;
      const ncActions = immOverdue.filter(a => a.ncId === id);
      const ncLien = `${APP_URL}/NCDetail?id=${id}`;
      const titre = `Actions immédiates en retard sur ${nc.numero || ""}`.trim();
      const listLines = ncActions.map(a => {
        return `- ${a.description || "(sans intitulé)"}
  • Processus responsable : ${a.responsableNom || a.responsable || "non assigné"}
  • Date de fin prévue : ${formatDateFr(a.dateFinPrevue)}
  • Retard : ${joursRetard(a.dateFinPrevue)} jour(s)`;
      }).join("\n");
      const message = `Bonjour,

Des actions immédiates (48h) de la NC "${nc.titre || nc.numero || ""}" ont dépassé leur échéance :

${listLines}

🔗 Accéder à la NC : ${ncLien}

Cordialement,
Le système QHSE`;
      const dests = [...new Set([
        ...hseEmails,
        ...ncActions.flatMap(a => procEmails[a.responsable] || []),
      ])].filter(Boolean);
      if (dests.length === 0) continue; // aucun destinataire → le scan réessaiera demain
      ncActions.forEach(a => immMarked.push(a.id));
      for (const email of dests) {
        notifCount++;
        await svc.entities.Notification.create({
          destinataire: email, type: "Retard", titre, message, lu: false, lienType: "nc", lienId: id,
        }).catch(e => console.warn("[scanActionsRetard] Notification.create (action immédiate) failed", { email, err: String(e?.message || e) }));
        await svc.functions.invoke("sendEmailBrevo", { to: email, subject: titre, body: message, secret: SCAN_CRON_SECRET })
          .then(res => console.info("[scanActionsRetard] sendEmailBrevo (action immédiate) ok", { email, messageId: res?.data?.messageId }))
          .catch(e => {
            const detail = e?.response?.data || String(e?.message || e);
            console.warn("[scanActionsRetard] sendEmailBrevo (action immédiate) failed", { email, err: detail });
          });
      }
    }
    if (immMarked.length > 0) {
      await svc.entities.ActionImmediate.bulkUpdate(immMarked.map(aid => ({ id: aid, retardNotifie: true })))
        .catch(e => console.warn("[scanActionsRetard] bulkUpdate (actions immédiates) failed", { err: String(e?.message || e) }));
    }

    return Response.json({ status: "ok", notified: notifCount, overdueActions: overdue.length, ncs: ncIds.length, relancesAssignes: assigneMarked.length, rappelsPreventifs: preventifMarked.length, actionsImmediatesRetard: immMarked.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}