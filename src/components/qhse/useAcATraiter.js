import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useMesProcessus } from "./useMesProcessus";

/**
 * AC à traiter : fiches AC contenant au moins une ActionAmelioration dont
 * l'utilisateur fait partie des responsables du processus assigné et dont
 * le statut est "En cours" — SANS être pilote du processus initiateur ni
 * l'auteur de la fiche (exclusivité avec « Mes AC » : l'auto-assignation
 * reste visible uniquement dans « Mes AC »).
 * Regroupé par fiche AC parente pour l'affichage.
 */
export function useAcATraiter(user, ready = true) {
  const { mesProcessus, isLoading: processusLoading } = useMesProcessus(user, ready);

  const { data: actions = [], isLoading: actionsLoading } = useQuery({
    queryKey: ["ac-actions-a-traiter", user?.email],
    queryFn: () => base44.entities.ActionAmelioration.list("-created_date", 500),
    enabled: !!user?.email && ready,
    // Rafraîchissement périodique local (mise à jour de la pastille sidebar sans navigation)
    refetchInterval: 45_000,
  });

  const myActions = (actions || []).filter(a =>
    (a.responsablesProcessus || []).includes(user?.email) &&
    a.statut === "En cours"
  );
  const candidateAcIds = [...new Set(myActions.map(a => a.acId).filter(Boolean))];

  const { data: acs = [], isLoading: fichesLoading } = useQuery({
    queryKey: ["ac-fiches-a-traiter", candidateAcIds.slice().sort().join(","), mesProcessus.join(","), user?.email],
    queryFn: async () => {
      const res = await Promise.all(candidateAcIds.map(id =>
        base44.entities.AmeliorationContinue.get(id).catch(() => null)
      ));
      // Exclusivité « Mes AC » : on retire les fiches initiées par un processus
      // piloté par l'utilisateur ou soumises par lui (cas d'auto-assignation inclus).
      return res.filter(Boolean).filter(ac =>
        !mesProcessus.includes(ac.processusInitiateur) && ac.initiateurEmail !== user?.email
      );
    },
    enabled: candidateAcIds.length > 0,
  });

  // On ne garde que les actions des fiches réellement « à traiter » pour l'utilisateur
  const acIdsTraiter = new Set(acs.map(a => a.id));
  const actionsATraiter = myActions.filter(a => acIdsTraiter.has(a.acId));

  // Pastille type "non-lu" : fiches AC ayant au moins une action pas encore
  // consultée par le pilote. Les listes restent complètes pour les pages de travail.
  const unseenAcIds = [...new Set(
    actionsATraiter
      .filter(a => !(a.vuParEmails || []).includes(user?.email))
      .map(a => a.acId)
      .filter(Boolean)
  )];

  return {
    acs,
    myActions: actionsATraiter,
    nbATraiter: unseenAcIds.length,
    isLoading: processusLoading || actionsLoading || fichesLoading,
  };
}