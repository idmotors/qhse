import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

/**
 * Bouton flottant « Déclarer une NC » : icône compacte au repos,
 * s'étend au survol (ou au focus clavier) pour révéler le libellé.
 */
export default function DeclareNCButton() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/CreateNC")}
      aria-label="Déclarer une NC"
      className="group fixed bottom-6 right-6 z-50 flex h-12 items-center justify-center overflow-hidden rounded-full bg-amber-500 px-3.5 text-white shadow-lg transition-all duration-300 ease-out hover:bg-amber-600 hover:px-5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
    >
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <span className="ml-0 max-w-0 whitespace-nowrap text-sm font-semibold opacity-0 transition-all duration-300 ease-out group-hover:ml-2 group-hover:max-w-[160px] group-hover:opacity-100 group-focus-within:ml-2 group-focus-within:max-w-[160px] group-focus-within:opacity-100">
        Déclarer une NC
      </span>
    </button>
  );
}