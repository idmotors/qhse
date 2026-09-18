import React from "react";
import JournalActivite from "@/components/qhse/JournalActivite";

export default function Journal() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Journal d'activité</h1>
        <p className="text-sm text-slate-500 mt-1">Historique en lecture seule des actions effectuées sur la plateforme</p>
      </div>
      <JournalActivite />
    </div>
  );
}