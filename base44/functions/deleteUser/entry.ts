import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Fonction backend : suppression définitive d'un compte utilisateur.
// - Réservée aux rôles applicatifs QHSE / Administrateur (admin_gestion) et au Propriétaire.
// - Interdit la suppression de son propre compte et du compte Propriétaire (role 'admin').
// - Nettoie d'abord les rattachements Processus (pilotes + membres d'équipe) pour éviter
//   les références mortes, puis supprime l'enregistrement User — ce qui révoque
//   définitivement l'accès à l'application (documentation Base44 : suppression du compte).
// - Ne touche PAS aux Action / ActionAmelioration / NC / AC : données d'audit conservées.
//
// Appel depuis le frontend :
//   base44.functions.invoke("deleteUser", { userId })

const ALLOWED_ROLES = ["admin", "qhse", "admin_gestion"];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) {
      return Response.json({ error: "Non authentifié." }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(caller.role)) {
      return Response.json({ error: "Accès refusé : réservé à la QHSE et aux administrateurs." }, { status: 403 });
    }

    const { userId } = await req.json();
    if (!userId) {
      return Response.json({ error: "Paramètre manquant : 'userId' est requis." }, { status: 400 });
    }
    if (userId === caller.id) {
      return Response.json({ error: "Impossible de supprimer votre propre compte." }, { status: 403 });
    }

    // Cible en rôle de service (le User n'est pas filtré par RLS pour un admin de gestion)
    const svc = base44.asServiceRole;
    let target;
    try {
      target = await svc.entities.User.get(userId);
    } catch (e) {
      return Response.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }
    if (target.role === "admin") {
      return Response.json({ error: "Impossible de supprimer le compte Propriétaire." }, { status: 403 });
    }

    // 1. Nettoyage des rattachements processus (pilotes + membres d'équipe)
    const processusList = await svc.entities.Processus.list();
    const email = target.email;
    const updates = [];
    for (const p of processusList || []) {
      const respEmails = (p.responsableEmails || []).filter(e => e !== email);
      const respIds = (p.responsableIds || []).filter(i => i !== userId);
      const membEmails = (p.membresEmails || []).filter(e => e !== email);
      const membIds = (p.membresIds || []).filter(i => i !== userId);
      const changed =
        respEmails.length !== (p.responsableEmails || []).length ||
        respIds.length !== (p.responsableIds || []).length ||
        membEmails.length !== (p.membresEmails || []).length ||
        membIds.length !== (p.membresIds || []).length;
      if (changed) {
        updates.push({
          id: p.id,
          responsableEmails: respEmails,
          responsableIds: respIds,
          membresEmails: membEmails,
          membresIds: membIds,
        });
      }
    }
    if (updates.length > 0) {
      await svc.entities.Processus.bulkUpdate(updates);
    }

    // 2. Suppression du compte (révoque définitivement l'accès à l'application)
    await svc.entities.User.delete(userId);

    return Response.json({
      success: true,
      email: email || "",
      processusNettoyes: updates.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}