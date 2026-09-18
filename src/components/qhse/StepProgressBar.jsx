import React from "react";
import { Check } from "lucide-react";

/**
 * Barre de progression par étapes.
 * steps: [{ label, index }]
 * currentStep: index de l'étape active (0-based)
 * completedUpTo: index maximum d'étape complétée
 * onStepClick: (index) => void — appelé seulement si cliquable
 */
export default function StepProgressBar({ steps, currentStep, completedUpTo, onStepClick }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-center justify-between">
        {steps.map((step, i) => {
          const isCompleted = i < completedUpTo;
          const isActive = i === currentStep;
          const isClickable = isCompleted || isActive;

          return (
            <React.Fragment key={i}>
              {/* Step circle + label */}
              <div
                className={`flex flex-col items-center gap-1.5 ${isClickable ? "cursor-pointer group" : "cursor-default opacity-50"}`}
                onClick={() => isClickable && onStepClick(i)}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                    ${isCompleted
                      ? "bg-green-500 text-white group-hover:bg-green-600"
                      : isActive
                        ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                        : "bg-slate-200 text-slate-400"
                    }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span
                  className={`text-xs font-medium text-center max-w-[80px] leading-tight
                    ${isActive ? "text-indigo-700" : isCompleted ? "text-green-700" : "text-slate-400"}`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 rounded-full transition-colors
                    ${i < completedUpTo ? "bg-green-400" : "bg-slate-200"}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}