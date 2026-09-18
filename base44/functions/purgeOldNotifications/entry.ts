import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { SCAN_CRON_SECRET } from "../../shared/scanSecret.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    // Sécurité — cette maintenance privilégiée (service role, contournement de la RLS)
    // ne peut être déclenchée que par le planificateur interne (workflows),
    // qui présente le secret partagé à chaque appel.
    const { secret } = await req.json().catch(() => ({}));
    if (secret !== SCAN_CRON_SECRET) {
      return Response.json(
        { error: "Forbidden : cette purge est réservée au planificateur interne." },
        { status: 403 }
      );
    }
    const svc = base44.asServiceRole;

    // Purge : notifications LUES créées il y a plus de 3 mois.
    // Les notifications non lues (lu === false) ne sont JAMAIS supprimées, quel que soit leur âge.
    // Seule l'entité Notification est concernée — aucune autre entité n'est touchée.
    const cutoff = new Date(Date.now() - 90 * 86400000);
    const all = await svc.entities.Notification.list();
    const toPurge = all.filter(n => n && n.lu === true && n.created_date && new Date(n.created_date) < cutoff);

    if (toPurge.length === 0) {
      console.info("[purgeOldNotifications] Aucune notification lue de plus de 3 mois à purger");
      return Response.json({ status: "ok", purged: 0 });
    }

    const ids = toPurge.map(n => n.id);
    await svc.entities.Notification.deleteMany({ id: { $in: ids }, lu: true });

    // Log de maintenance uniquement — aucune notification n'est générée pour cette opération.
    console.info(`[purgeOldNotifications] ${ids.length} notification(s) lue(s) de plus de 3 mois supprimée(s) (créées avant le ${cutoff.toISOString()})`);
    return Response.json({ status: "ok", purged: ids.length, olderThan: cutoff.toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}