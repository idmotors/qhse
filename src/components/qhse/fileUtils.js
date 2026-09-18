// Normalise un élément de pièce jointe, qu'il soit à l'ancien format (string = url)
// ou au nouveau format ({ url, nom }), pour un affichage et une suppression uniformes.
export function normalizePiece(item) {
  if (typeof item === "string") {
    let nom = "Pièce jointe";
    try {
      nom = decodeURIComponent(item.split("/").pop()) || "Pièce jointe";
    } catch (_) { /* URL malformée : repli sur libellé générique */ }
    return { url: item, nom };
  }
  return { url: item?.url || "", nom: item?.nom || "Pièce jointe" };
}