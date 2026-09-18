import React from "react";
import { Check } from "lucide-react";

const STEPS = [
  { key: "Ouverte", label: "Ouverte", num: 1 },
  { key: "En investigation", label: "Investigation", num: 2 },
  { key: "En cours de traitement", label: "Traitement", num: 3 },
  { key: "En vérification d'efficacité", label: "Vérification", num: 4 },
  { key: "Clôturée", label: "Clôturée", num: 5 },
];

function getStepIndex(statut) {
  if (statut === "En retard") return 2; // Same as En cours de traitement
  const idx = STEPS.findIndex(s => s.key === statut);
  return idx >= 0 ? idx : 0;
}

export default function NCProgressBar({ statut }) {
  const currentIdx = getStepIndex(statut);

  return (
    <div className="flex items-center w-full">
      {STEPS.map((step, i) => (
        <React.Fragment key={step.key}>
          <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              i < currentIdx ? "bg-blue-600 text-white" :
              i === currentIdx ? "bg-blue-100 text-blue-700 ring-2 ring-blue-600" :
              "bg-slate-100 text-slate-400"
            }`}>
              {i < currentIdx ? <Check className="w-4 h-4" /> : step.num}
            </div>
            <span className={`text-xs mt-1.5 font-medium ${i <= currentIdx ? "text-blue-700" : "text-slate-400"}`}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 ${i < currentIdx ? "bg-blue-600" : "bg-slate-200"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}