import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import FieldError from "@/components/qhse/FieldError";

/**
 * Boutons de navigation bas de page.
 * currentStep: index actuel (0-based)
 * totalSteps: nombre total d'étapes
 * showNext: afficher le bouton Suivant (QHSE ou responsable du processus)
 * canGoNext: les conditions de passage sont remplies
 * onPrev / onNext: callbacks
 * nextLabel: libellé du bouton suivant (optionnel)
 * blockedMessage: message rouge affiché après une tentative quand canGoNext est
 *   faux (blocage d'une étape entière) — il disparaît dès que l'étape est valide.
 */
export default function StepNavButtons({ currentStep, totalSteps, showNext, canGoNext, onPrev, onNext, nextLabel, blockedMessage }) {
  const [attempted, setAttempted] = useState(false);
  const isLastStep = currentStep === totalSteps - 1;
  const hasPrev = currentStep > 0;

  return (
    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
      <div>
        {hasPrev && (
          <Button variant="outline" onClick={() => { setAttempted(false); onPrev(); }} className="gap-2">
            <ChevronLeft className="w-4 h-4" /> Étape précédente
          </Button>
        )}
      </div>
      <div>
        {showNext && !isLastStep && (
          <div className="flex flex-col items-end">
            <Button
              onClick={() => {
                if (!canGoNext) { setAttempted(true); return; }
                setAttempted(false);
                onNext();
              }}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              {nextLabel || "Étape suivante"} <ChevronRight className="w-4 h-4" />
            </Button>
            <FieldError show={attempted && !canGoNext && !!blockedMessage} message={blockedMessage} />
          </div>
        )}
      </div>
    </div>
  );
}