import { useQuery } from "@tanstack/react-query";
import { getProcessusList } from "./processusUtils";

/**
 * Processus pilotés par l'utilisateur connecté — basé sur la liste des
 * pilotes/responsables (responsableEmails), PAS sur les membres d'équipe
 * (membresEmails, réservés au sous-assignement d'actions).
 * Réutilise le cache de processusUtils.
 */
export function useMesProcessus(user, ready = true) {
  const { data: mesProcessus = [], isLoading } = useQuery({
    queryKey: ["mes-processus-pilote", user?.email],
    queryFn: async () => {
      const list = await getProcessusList();
      return (list || [])
        .filter(p => (p.responsableEmails || []).includes(user.email))
        .map(p => p.nom);
    },
    enabled: !!user?.email && ready,
    staleTime: 60_000,
  });
  return { mesProcessus, isLoading };
}