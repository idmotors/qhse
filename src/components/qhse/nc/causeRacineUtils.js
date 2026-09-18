// Calcule la cause racine dérivée des conclusions des analyses 5 Pourquoi / 5M.
// Préserve les données legacy : si causeRacine est déjà renseignée, on l'utilise.
export function getCauseRacine(nc) {
  if (!nc) return "";
  if (nc.causeRacine) return nc.causeRacine;

  if (nc.methodeAnalyse === "5 Pourquoi") {
    const analyses = nc.fiveWhysAnalyses || [];
    return analyses.map(a => a.conclusion).filter(Boolean).join(" · ");
  }

  if (nc.methodeAnalyse === "5M") {
    const branches = nc.fishboneCauses || {};
    const conclusions = [];
    const causesTextes = [];
    Object.values(branches).forEach(causes => {
      (causes || []).forEach(c => {
        const conc = c?.fiveWhysConclusion;
        if (conc) conclusions.push(conc);
        if (c?.text) causesTextes.push(c.text);
      });
    });
    // Priorité aux conclusions des analyses 5 Pourquoi ; sinon, retombe sur les causes saisies dans le Fishbone
    return conclusions.length > 0 ? conclusions.join(" · ") : causesTextes.join(" · ");
  }

  return "";
}

// Indique si l'analyse des causes est suffisamment avancée pour passer au traitement.
// 5M : au moins 2 des 6 branches du Fishbone contiennent au moins une cause renseignée.
// 5 Pourquoi : une conclusion d'analyse est renseignée (cause racine dérivée non vide).
export function isAnalyseComplete(nc) {
  if (!nc) return false;
  if (nc.methodeAnalyse === "5M") {
    const branches = nc.fishboneCauses || {};
    const filledBranches = Object.values(branches).filter(arr => (arr || []).length > 0).length;
    return filledBranches >= 2;
  }
  return !!getCauseRacine(nc);
}