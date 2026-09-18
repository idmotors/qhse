import React, { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import ActionsList from "@/components/qhse/ActionsList";
import FishboneDiagram from "@/components/qhse/nc/FishboneDiagram";
import FiveWhysModal from "@/components/qhse/nc/FiveWhysModal";
import { base44 } from "@/api/base44Client";
function DebouncedTextarea({ value: externalValue, onSave, ...props }) {
  const [value, setValue] = useState(externalValue || "");
  useEffect(() => { setValue(externalValue || ""); }, [externalValue]);
  useEffect(() => {
    if (value === (externalValue || "")) return;
    const timer = setTimeout(() => onSave(value), 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <Textarea {...props} value={value} onChange={e => setValue(e.target.value)} />;
}

export default function NCStepInvestigation({ nc, actions, ncId, isQHSE, isResponsableProcessus, isEditable, user, inefficaceActionIds, onFieldUpdate, onRefreshActions }) {
  const hasActions = actions.filter(a => !inefficaceActionIds.includes(a.id)).length > 0;
  const hasResponsible = actions.filter(a => !inefficaceActionIds.includes(a.id)).some(a => a.responsable);
  const [saveStatus, setSaveStatus] = useState(null);

  // Local mirror of fiveWhysAnalyses for immediate display after save
  const [localFiveWhys, setLocalFiveWhys] = useState(nc.fiveWhysAnalyses || []);
  useEffect(() => { setLocalFiveWhys(nc.fiveWhysAnalyses || []); }, [nc.fiveWhysAnalyses]);

  const handleDiagramSave = useCallback(async (field, value) => {
    if (field === "_retry") return;
    setSaveStatus("saving");
    try {
      await onFieldUpdate(field, value);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (_) {
      setSaveStatus("error");
    }
  }, [onFieldUpdate]);

  const methode = nc.methodeAnalyse || null;
  const totalFishboneCauses = Object.values(nc.fishboneCauses || {}).flat().length;
  const [fiveWhysModal, setFiveWhysModal] = useState(null); // {causeText, branchId, causeId} or {direct:true}

  const handleFiveWhysSave = useCallback((data) => {
    if (fiveWhysModal?.direct) {
      const existing = localFiveWhys;
      const updated = existing.find(a => a.id === "direct")
        ? existing.map(a => a.id === "direct" ? { ...a, ...data } : a)
        : [...existing, { id: "direct", causeText: "", ...data }];
      setLocalFiveWhys(updated);
      onFieldUpdate("fiveWhysAnalyses", updated);
    } else if (fiveWhysModal?.branchId && fiveWhysModal?.causeId) {
      const causes = nc.fishboneCauses || {};
      const branch = (causes[fiveWhysModal.branchId] || []).map(c =>
        c.id === fiveWhysModal.causeId ? { ...c, fiveWhys: data.whys, fiveWhysConclusion: data.conclusion } : c
      );
      onFieldUpdate("fishboneCauses", { ...causes, [fiveWhysModal.branchId]: branch });
    }
  }, [fiveWhysModal, localFiveWhys, nc, onFieldUpdate]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">

      {/* ─── Méthode d'analyse ─── */}
      <div>
        <Label className="text-xs font-semibold">Méthode d'analyse des causes <span className="text-red-500">*</span></Label>
        <div className="flex gap-3 mt-2">
          {["5 Pourquoi", "5M"].map(m => (
            <button
              key={m}
              type="button"
              disabled={!isEditable}
              onClick={() => isEditable && onFieldUpdate("methodeAnalyse", m)}
              className={`px-5 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                methode === m
                  ? "bg-[#363886] border-[#363886] text-white"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:border-[#363886]"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >{m === "5M" ? "5M (Fishbone / Ishikawa)" : "5 Pourquoi"}</button>
          ))}
        </div>
      </div>

      {/* ─── Fishbone si 5M ─── */}
      {methode === "5M" && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Diagramme Fishbone / Ishikawa</Label>
          {totalFishboneCauses === 0 && !isEditable && (
            <p className="text-sm text-slate-400 italic">Aucune cause renseignée.</p>
          )}
          <FishboneDiagram nc={nc} onSave={handleDiagramSave} saveStatus={saveStatus} onOpenFiveWhys={isEditable ? setFiveWhysModal : null} />
        </div>
      )}

      {/* 5 Pourquoi direct */}
      {methode === "5 Pourquoi" && (() => {
        const direct = localFiveWhys.find(a => a.id === "direct");
        const completed = (direct?.whys || []).filter(w => w?.trim()).length;
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-amber-900">Analyse 5 Pourquoi</p>
              {direct && (
                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  ✓ Analyse réalisée
                </span>
              )}
            </div>

            {direct ? (
              <div className="space-y-3">
                <p className="text-xs text-amber-700">
                  {completed} / 5 pourquoi complétés{direct.conclusion ? " · Conclusion renseignée" : ""}
                </p>
                {/* Affichage lecture seule */}
                <div className="space-y-2">
                  {(direct.whys || []).filter(w => w?.trim()).map((w, i) => (
                    <div key={i} className="bg-white border border-amber-100 rounded-lg px-3 py-2">
                      <span className="text-xs font-semibold text-amber-800">Pourquoi {i + 1} : </span>
                      <span className="text-sm text-slate-700">{w}</span>
                    </div>
                  ))}
                  {direct.conclusion && (
                    <div className="bg-amber-100 rounded-lg px-3 py-2">
                      <span className="text-xs font-semibold text-amber-800">Conclusion : </span>
                      <span className="text-sm text-slate-700">{direct.conclusion}</span>
                    </div>
                  )}
                </div>
                {isEditable && (
                  <button
                    onClick={() => setFiveWhysModal({ direct: true, causeText: "", initialWhys: direct.whys, initialConclusion: direct.conclusion })}
                    className="text-xs font-medium text-[#363886] underline hover:no-underline"
                  >
                    ✏️ Modifier l'analyse
                  </button>
                )}
              </div>
            ) : isEditable ? (
              <button
                onClick={() => setFiveWhysModal({ direct: true, causeText: "", initialWhys: [], initialConclusion: "" })}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-amber-300 text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors"
              >
                + Lancer l'analyse 5 Pourquoi
              </button>
            ) : (
              <p className="text-sm text-slate-400 italic">Aucune analyse réalisée.</p>
            )}
          </div>
        );
      })()}

      {/* Actions correctives */}
      <ActionsList
        ncId={ncId}
        ncNumero={nc.numero}
        ncTitre={nc.titre}
        ncInitiateurEmail={nc.initiateurEmail}
        actions={actions}
        onRefresh={onRefreshActions}
        isQHSE={isQHSE}
        isResponsableProcessus={isResponsableProcessus}
        ncResponsablesProcessus={nc.responsablesProcessus || []}
        isEditable={isEditable}
        userEmail={user?.email}
        user={user}
        ncStatut={nc.statut}
        mode="investigation"
        inefficaceActionIds={inefficaceActionIds}
      />

      {/* Critères d'efficacité */}
      {(hasResponsible || nc.criteresEfficacite) && (
        <div>
          <Label className="text-xs">
            Critères de vérification d'efficacité {isQHSE && isEditable && <span className="text-red-500">*</span>}
          </Label>
          {isQHSE && isEditable ? (
            <DebouncedTextarea
              value={nc.criteresEfficacite || ""}
              onSave={v => onFieldUpdate("criteresEfficacite", v)}
              placeholder="Définir les critères..."
              rows={2}
              className="mt-1"
            />
          ) : (
            <p className="text-sm text-slate-700 mt-1 bg-slate-50 rounded-lg p-3">{nc.criteresEfficacite || "—"}</p>
          )}
        </div>
      )}

      {/* Docs qualité */}
      <div>
        <Label className="text-xs font-semibold">Une mise à jour documentaire est-elle nécessaire ?</Label>
        <div className="flex gap-3 mt-2">
          {[true, false].map(val => (
            <button key={String(val)} type="button" disabled={!isEditable}
              onClick={() => {
                if (!isEditable) return;
                onFieldUpdate("miseAJourDocumentsQualite", val);
                if (val) {
                  base44.entities.Notification.create({
                    destinataire: "qhse-broadcast",
                    type: "Changement statut",
                    titre: `Mise à jour documentaire requise — ${nc.numero || ""}`,
                    message: `La NC "${nc.titre || nc.numero}" nécessite une mise à jour des documents qualité.`,
                    lu: false, lienType: "nc", lienId: nc.id,
                  }).catch(e => console.warn("[NCStepInvestigation] Échec de la notification in-app (mise à jour documentaire)", { nc: nc.numero, err: String(e?.message || e) }));
                }
              }}
              className={`px-5 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                nc.miseAJourDocumentsQualite === val
                  ? val ? "bg-green-50 border-green-500 text-green-700" : "bg-red-50 border-red-400 text-red-700"
                  : "bg-slate-50 border-slate-200 text-slate-600"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >{val ? "Oui" : "Non"}</button>
          ))}
        </div>
        {nc.miseAJourDocumentsQualite && (
          <div className="mt-3">
            <Label className="text-xs">Documents qualité concernés</Label>
            {isEditable ? (
              <DebouncedTextarea
                value={nc.documentsQualiteConcernes || ""}
                onSave={v => onFieldUpdate("documentsQualiteConcernes", v)}
                placeholder="Ex: PQ-012, PR-034..."
                rows={2}
                className="mt-1"
              />
            ) : (
              <p className="text-sm text-slate-700 mt-1 bg-slate-50 rounded-lg p-3">{nc.documentsQualiteConcernes || "—"}</p>
            )}
          </div>
        )}
      </div>

      {/* 5 Whys Modal */}
      {fiveWhysModal && (
        <FiveWhysModal
          causeText={fiveWhysModal.causeText}
          initialWhys={fiveWhysModal.initialWhys}
          onSave={handleFiveWhysSave}
          onClose={() => setFiveWhysModal(null)}
        />
      )}
    </div>
  );
}