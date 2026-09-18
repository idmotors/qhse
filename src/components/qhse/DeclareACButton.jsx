import React from "react";
import { useNavigate } from "react-router-dom";
import { Lightbulb } from "lucide-react";

/**
 * Bouton flottant « Déclarer une AC » : icône compacte au repos,
 * s'étend au survol (ou au focus clavier) pour révéler le libellé.
 * Placé au-dessus du bouton « Déclarer une NC ».
 */
export default function DeclareACButton() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/CreateAC")}
      aria-label="Déclarer une AC"
      className="group fixed bottom-24 right-6 z-50 flex h-12 items-center justify-center overflow-hidden rounded-full bg-emerald-500 px-3.5 text-white shadow-lg transition-all duration-300 ease-out hover:bg-emerald-600 hover:px-5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
    >
      <Lightbulb className="h-5 w-5 shrink-0" />
      <span className="ml-0 max-w-0 whitespace-nowrap text-sm font-semibold opacity-0 transition-all duration-300 ease-out group-hover:ml-2 group-hover:max-w-[160px] group-hover:opacity-100 group-focus-within:ml-2 group-focus-within:max-w-[160px] group-focus-within:opacity-100">
        Déclarer une AC
      </span>
    </button>
  );
}