import React from "react";
import { AlertCircle } from "lucide-react";

/**
 * Message de validation en rouge — affiché sous un champ obligatoire ou juste
 * au-dessus/à côté d'un bouton bloqué. À n'afficher qu'APRÈS une tentative de
 * validation (état "attempted" côté page, remis à false au changement d'étape) :
 * le message disparaît automatiquement dès que le champ/l'étape est renseigné(e).
 */
export default function FieldError({ show, message, className }) {
  if (!show || !message) return null;
  return (
    <p className={`text-xs text-red-600 flex items-start gap-1.5 mt-1 ${className || ""}`} role="alert">
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </p>
  );
}