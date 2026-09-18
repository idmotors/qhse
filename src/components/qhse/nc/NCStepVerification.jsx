import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { isActionDone } from "@/components/qhse/actionUtils";
import { normalizePiece } from "@/components/qhse/fileUtils";
import FieldError from "@/components/qhse/FieldError";

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

export default function NCStepVerification({ nc, actions, isQHSE, saving, inefficaceActionIds, onFieldUpdate, onVerification }) {
  const activeActions = actions.filter(a => !inefficaceActionIds.includes(a.id));
  const allActionsRealized = activeActions.length > 0 && activeActions.every(a => isActionDone(a));
  const isEditable = nc.statut === "En vérification d'efficacité";
  const [uploadingPJ, setUploadingPJ] = useState(false);
  const [efficaciteAttempted, setEfficaciteAttempted] = useState(false);

  const handleUploadPJ = async (e) => {
    setUploadingPJ(true);
    const files = Array.from(e.target.files);
    const urls = [...(nc.piecesJointesVerification || [])];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push({ url: file_url, nom: file.name });
    }
    await onFieldUpdate("piecesJointesVerification", urls);
    setUploadingPJ(false);
  };

  const handleRemovePJ = async (index) => {
    const urls = (nc.piecesJointesVerification || []).filter((_, i) => i !== index);
    await onFieldUpdate("piecesJointesVerification", urls);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
      <h2 className="text-sm font-semibold text-slate-900">Vérification d'efficacité</h2>

      {/* Critères de vérification */}
      <div>
        <Label className="text-xs font-medium text-slate-700">Critères de vérification <span className="text-red-500">*</span></Label>
        {isQHSE && isEditable ? (
          <DebouncedTextarea
            value={nc.criteresVerification || ""}
            onSave={v => onFieldUpdate("criteresVerification", v)}
            placeholder="Décrire les éléments contrôlés..."
            rows={3}
            className="mt-1"
          />
        ) : (
          <p className="text-sm text-slate-700 mt-1 bg-slate-50 rounded-lg p-3">{nc.criteresVerification || "—"}</p>
        )}
      </div>

      {/* Efficacité Oui / Non */}
      {isQHSE && isEditable && nc.actionEfficace !== true && (
        <div>
          <Label className="text-xs font-medium text-slate-700">Efficacité validée ? <span className="text-red-500">*</span></Label>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => {
                if (!nc.criteresVerification) { setEfficaciteAttempted(true); return; }
                onVerification(true);
              }}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-green-300 text-green-700 bg-green-50 hover:bg-green-100 font-medium text-sm disabled:opacity-40 transition"
            >
              <span className="text-lg">✓</span> Oui
            </button>
            <button
              onClick={() => onVerification(false)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-red-300 text-red-700 bg-red-50 hover:bg-red-100 font-medium text-sm disabled:opacity-40 transition"
            >
              <XCircle className="w-4 h-4" /> Non
            </button>
          </div>
          <FieldError show={efficaciteAttempted && !nc.criteresVerification} message="Veuillez renseigner les critères de vérification avant de valider l'efficacité." />
        </div>
      )}

      {/* Badge résultat si déjà tranché */}
      {nc.actionEfficace !== undefined && nc.actionEfficace !== null && (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${nc.actionEfficace ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {nc.actionEfficace ? "✅ Efficacité validée — Oui" : "❌ Action jugée inefficace — Non"}
        </div>
      )}

      {/* Commentaire de vérification */}
      <div>
        <Label className="text-xs font-medium text-slate-700">Commentaire de vérification</Label>
        {isQHSE && isEditable ? (
          <DebouncedTextarea
            value={nc.resultatsVerification || ""}
            onSave={v => onFieldUpdate("resultatsVerification", v)}
            placeholder="Observations, remarques..."
            rows={3}
            className="mt-1"
          />
        ) : (
          <p className="text-sm text-slate-700 mt-1 bg-slate-50 rounded-lg p-3">{nc.resultatsVerification || "—"}</p>
        )}
      </div>

      {/* Pièce jointe */}
      <div>
        <Label className="text-xs font-medium text-slate-700">Pièce jointe de vérification (optionnelle)</Label>
        {isQHSE && isEditable && (
          <label className="mt-2 inline-flex items-center gap-2 text-sm text-blue-600 cursor-pointer hover:underline">
            <Upload className="w-4 h-4" />
            {uploadingPJ ? "Envoi en cours..." : "Ajouter un fichier (JPG, PNG, PDF)"}
            <input type="file" multiple accept=".jpg,.jpeg,.png,.pdf" onChange={handleUploadPJ} className="hidden" disabled={uploadingPJ} />
          </label>
        )}
        {(nc.piecesJointesVerification || []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {nc.piecesJointesVerification.map((item, i) => {
              const p = normalizePiece(item);
              return (
                <div key={i} className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1 text-xs">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" title={p.nom} className="text-blue-600 hover:underline truncate max-w-[220px]">{p.nom}</a>
                  {isQHSE && isEditable && (
                    <button onClick={() => handleRemovePJ(i)} className="text-red-400 hover:text-red-600 ml-1" title="Retirer cette pièce jointe">×</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {nc.verifiePar && (
        <p className="text-xs text-slate-500">
          Vérifié par : {nc.verifiePar} — {nc.dateVerification ? format(new Date(nc.dateVerification), "dd/MM/yyyy HH:mm") : ""}
        </p>
      )}

      {/* Résumé pour clôture */}
      {nc.actionEfficace === true && isEditable && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1">
          <h3 className="text-sm font-semibold text-green-800">✅ Action jugée efficace — passez à l'étape Clôture</h3>
          <p className="text-xs text-green-700">Le formulaire de clôture apparaît ci-dessous — complétez-le pour clôturer la NC.</p>
        </div>
      )}
    </div>
  );
}