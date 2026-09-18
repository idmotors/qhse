import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Check, AlertCircle, ArrowDown, ChevronRight, Lightbulb } from "lucide-react";

export default function FiveWhysModal({ causeText, initialWhys, initialConclusion, onSave, onClose }) {
  const maxWhys = 5;
  const initCount = Math.max(1, (initialWhys || []).filter(w => w.trim()).length + (initialWhys?.some(w => w.trim()) ? 1 : 0), 1);
  const [visibleCount, setVisibleCount] = useState(Math.min(initCount, maxWhys));
  const [whys, setWhys] = useState(() => {
    const arr = initialWhys?.length === 5 ? [...initialWhys] : ["", "", "", "", ""];
    return arr;
  });
  const [conclusion, setConclusion] = useState(initialConclusion || "");
  const [dirty, setDirty] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const textareaRefs = useRef([]);

  const filledCount = whys.slice(0, visibleCount).filter(w => w.trim()).length;
  const allFilled = filledCount === visibleCount;

  // Auto-reveal next why when current is filled
  useEffect(() => {
    const lastFilled = whys.slice(0, maxWhys).reduce((last, w, i) => w.trim() ? i : last, -1);
    if (lastFilled >= 0 && lastFilled + 1 < maxWhys && lastFilled + 1 >= visibleCount) {
      // don't auto-reveal, user clicks the button
    }
  }, [whys, visibleCount]);

  const handleWhyChange = (i, val) => {
    const updated = [...whys];
    updated[i] = val;
    setWhys(updated);
    setDirty(true);
    onSave({ whys: updated, conclusion });
  };

  const handleConclusionChange = (val) => {
    setConclusion(val);
    setDirty(true);
    onSave({ whys, conclusion: val });
  };

  const handleAddNext = () => {
    if (visibleCount < maxWhys) {
      setVisibleCount(v => v + 1);
      setTimeout(() => textareaRefs.current[visibleCount]?.focus(), 80);
    }
  };

  const handleClose = () => {
    if (dirty) setShowConfirm(true);
    else onClose();
  };

  const handleSaveAndClose = () => {
    onSave({ whys, conclusion });
    setDirty(false);
    onClose();
  };

  const progressPct = (filledCount / maxWhys) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900 text-lg leading-tight">Analyse 5 Pourquoi</h2>
              <p className="text-xs text-slate-500 mt-0.5">Remontez à la cause racine en posant la question "Pourquoi ?" à chaque étape</p>
            </div>
            <button onClick={handleClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 transition-colors flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, backgroundColor: progressPct === 100 ? "#16a34a" : "#363886" }}
              />
            </div>
            <span className="text-xs font-medium text-slate-500 flex-shrink-0">{filledCount}/{maxWhys}</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

          {/* Cause source */}
          {causeText && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertCircle className="w-3.5 h-3.5 text-slate-600" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Cause analysée</p>
                <p className="text-sm font-medium text-slate-800">{causeText}</p>
              </div>
            </div>
          )}

          {/* Chain of whys */}
          {Array.from({ length: visibleCount }).map((_, i) => {
            const prevAnswer = i > 0 ? whys[i - 1] : null;
            const isFilled = !!whys[i].trim();
            return (
              <div key={i} className="relative">
                {/* Connector line */}
                {i > 0 && (
                  <div className="flex justify-center -mb-1 -mt-1">
                    <ArrowDown className="w-4 h-4 text-slate-300" />
                  </div>
                )}
                <div className={`rounded-xl border-2 transition-all duration-200 ${
                  isFilled
                    ? "border-[#363886]/30 bg-[#363886]/[0.03]"
                    : "border-slate-200 bg-white"
                }`}>
                  {/* Context from previous answer */}
                  {prevAnswer && (
                    <div className="px-4 pt-3 pb-1">
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <ChevronRight className="w-3 h-3" />
                        <span className="italic truncate">{prevAnswer}</span>
                      </p>
                    </div>
                  )}
                  <div className="px-4 pt-3 pb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors flex-shrink-0 ${
                        isFilled ? "bg-[#363886] text-white" : "bg-slate-100 text-slate-500"
                      }`}>{i + 1}</span>
                      <label className="text-xs font-semibold text-slate-600">
                        Pourquoi {i + 1}
                        {i === 0 && <span className="text-red-400 ml-1">*</span>}
                        {i === maxWhys - 1 && <span className="text-xs font-normal text-slate-400 ml-2">— cause racine</span>}
                      </label>
                    </div>
                    <Textarea
                      ref={el => textareaRefs.current[i] = el}
                      value={whys[i]}
                      onChange={e => handleWhyChange(i, e.target.value)}
                      placeholder={i === 0 ? "Parce que… (décrivez la cause directe)" : "Parce que…"}
                      rows={2}
                      className="text-sm resize-none"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add next why button */}
          {visibleCount < maxWhys && whys[visibleCount - 1]?.trim() && (
            <button
              onClick={handleAddNext}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-[#363886]/30 text-[#363886] text-sm font-medium hover:bg-[#363886]/5 transition-colors"
            >
              <ArrowDown className="w-4 h-4" />
              Creuser plus loin — Pourquoi {visibleCount + 1}
            </button>
          )}

          {/* Conclusion */}
          <div className={`rounded-xl border-2 transition-all duration-300 ${
            conclusion ? "border-green-300 bg-green-50/40" : "border-slate-200"
          }`}>
            <div className="px-4 pt-3 pb-1 flex items-center gap-2">
              <Lightbulb className={`w-4 h-4 flex-shrink-0 ${conclusion ? "text-green-600" : "text-slate-400"}`} />
              <label className="text-xs font-semibold text-slate-700">Cause profonde identifiée</label>
              <span className="text-[10px] text-slate-400 ml-auto">Conclusion de l'analyse</span>
            </div>
            <div className="px-4 pb-4">
              <Textarea
                value={conclusion}
                onChange={e => handleConclusionChange(e.target.value)}
                placeholder="Résumez la cause racine identifiée à l'issue de cette analyse…"
                rows={3}
                className="text-sm resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <p className="text-xs text-green-600 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            Sauvegarde automatique active
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleClose}>Fermer</Button>
            <Button size="sm" onClick={handleSaveAndClose} className="bg-[#363886] hover:bg-[#2d2f6e] text-white">
              <Check className="w-3.5 h-3.5 mr-1" />
              Enregistrer et fermer
            </Button>
          </div>
        </div>
      </div>

      {/* Confirm unsaved */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <h3 className="font-semibold text-slate-900">Modifications non sauvegardées</h3>
            </div>
            <p className="text-sm text-slate-600">Des modifications n'ont pas encore été sauvegardées. Que souhaitez-vous faire ?</p>
            <div className="flex gap-2 justify-end flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)}>Annuler</Button>
              <Button size="sm" variant="destructive" onClick={onClose}>Fermer sans sauvegarder</Button>
              <Button size="sm" onClick={handleSaveAndClose} className="bg-[#363886] hover:bg-[#2d2f6e]">Sauvegarder et fermer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}