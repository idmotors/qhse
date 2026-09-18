import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useMesProcessus } from "./useMesProcessus";

// Statuts nécessitant une action du pilote (avant le relais QHSE en vérification d'efficacité)
export const STATUTS_ACTION = ["Ouverte", "En investigation", "En cours de traitement", "En retard"];

/**
 * NC à traiter : NC où l'utilisateur fait partie des responsables du
 * processus assigné (responsablesProcessus) — SANS être pilote du processus
 * demandeur ni l'initiateur (exclusivité avec « Mes NC »).
 */
export function useNcATraiter(user, ready = true) {
  const { mesProcessus, isLoading: processusLoading } = useMesProcessus(user, ready);

  const { data: ncs = [], isLoading } = useQuery({
    queryKey: ["nc-a-traiter", user?.email, mesProcessus.join(",")],
    queryFn: async () => {
      const list = await base44.entities.NonConformite.list("-created_date", 200);
      return list.filter(n =>
        (n.responsablesProcessus || []).includes(user.email) &&
        n.initiateurEmail !== user.email &&
        !mesProcessus.includes(n.processusDemandeur)
      );
    },
    enabled: !!user?.email && ready,
    // Rafraîchissement périodique local (mise à jour de la pastille sidebar sans navigation)
    refetchInterval: 45_000,
  });
  const ncessitantAction = ncs.filter(n => STATUTS_ACTION.includes(n.statut));
  // Pastille type "non-lu" : ne compte que les NC pas encore consultées par le pilote.
  // Les listes (ncs, ncessitantAction) restent complètes pour les pages de travail.
  const nbATraiter = ncessitantAction.filter(n => !(n.vuParEmails || []).includes(user?.email)).length;
  return { ncs, ncessitantAction, nbATraiter, isLoading: processusLoading || isLoading };
}