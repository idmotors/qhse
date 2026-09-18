import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle2, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { normalizePiece } from "@/components/qhse/fileUtils";
import FieldError from "@/components/qhse/FieldError";

export default function NCStepCloture({ nc, isQHSE, saving, onFieldUpdate, onCloture }) {
  const [uploadingPJ, setUploadingPJ] = useState(false);
  const [clotureAttempted, setClotureAttempted] = useState(false);
  const [commentaire, setCommentaire] = useState(nc.commentaireCloture || "");
  const [clotureValidee, setClotureValidee] = useState(
    nc.clotureValidee === true ? true : nc.clotureValidee === false ? false : null
  );

  const isEditable = ["En vérification d'efficacité", "En cours de traitement"].includes(nc.statut) && nc.actionEfficace === true;

  const handleUploadPJ = async (e) => {
    setUploadingPJ(true);
    const files = Array.from(e.target.files);
    const urls = [...(nc.piecesJointesCloture || [])];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push({ url: file_url, nom: file.name });
    }
    await onFieldUpdate("piecesJointesCloture", urls);
    setUploadingPJ(false);
  };

  const handleRemovePJ = async (index) => {
    const urls = (nc.piecesJointesCloture || []).filter((_, i) => i !== index);
    await onFieldUpdate("piecesJointesCloture", urls);
  };

  const handleSaveAndCloture = async () => {
    // Sauvegarder les deux champs en séquence avant de clôturer
    await onFieldUpdate("clotureValidee", true);
    if (commentaire !== (nc.commentaireCloture || "")) {
      await onFieldUpdate("commentaireCloture", commentaire);
    }
    await onCloture();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
      <h2 className="text-sm font-semibold text-slate-900">Validation de clôture</h2>

      {/* Clôture validée Oui/Non */}
      {isQHSE && isEditable && (
        <div>
          <Label className="text-xs font-medium text-slate-700">Clôture validée ? <span className="text-red-500">*</span></Label>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => setClotureValidee(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-medium text-sm transition ${
                clotureValidee === true
                  ? "border-green-500 bg-green-100 text-green-800"
                  : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" /> Oui
            </button>
            <button
              onClick={() => setClotureValidee(false)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-medium text-sm transition ${
                clotureValidee === false
                  ? "border-red-500 bg-red-100 text-red-800"
                  : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
              }`}
            >
              <XCircle className="w-4 h-4" /> Non
            </button>
          </div>
        </div>
      )}

      {/* Commentaire de clôture */}
      <div>
        <Label className="text-xs font-medium text-slate-700">Commentaire de clôture</Label>
        {isQHSE && isEditable ? (
          <Textarea
            value={commentaire}
            onChange={e => setCommentaire(e.target.value)}
            placeholder="Observations, bilan final..."
            rows={3}
            className="mt-1"
          />
        ) : (
          <p className="text-sm text-slate-700 mt-1 bg-slate-50 rounded-lg p-3">{nc.commentaireCloture || "—"}</p>
        )}
      </div>

      {/* Pièce jointe de clôture */}
      <div>
        <Label className="text-xs font-medium text-slate-700">Pièce jointe de clôture (optionnelle)</Label>
        {isQHSE && isEditable && (
          <label className="mt-2 inline-flex items-center gap-2 text-sm text-blue-600 cursor-pointer hover:underline">
            <Upload className="w-4 h-4" />
            {uploadingPJ ? "Envoi en cours..." : "Ajouter un fichier (JPG, PNG, PDF)"}
            <input type="file" multiple accept=".jpg,.jpeg,.png,.pdf" onChange={handleUploadPJ} className="hidden" disabled={uploadingPJ} />
          </label>
        )}
        {(nc.piecesJointesCloture || []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {nc.piecesJointesCloture.map((item, i) => {
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

      {/* Badge résultat si clôture validée */}
      {clotureValidee === true && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
          ✅ Clôture validée — Oui
        </div>
      )}
      {clotureValidee === false && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-red-100 text-red-800">
          ❌ Clôture non validée — Non
        </div>
      )}

      {isQHSE && isEditable && (
        <>
          <Button
            onClick={() => {
              if (clotureValidee !== true) { setClotureAttempted(true); return; }
              handleSaveAndCloture();
            }}
            disabled={saving}
            className="bg-blue-700 hover:bg-blue-800 w-full"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" /> Valider et clôturer la NC
          </Button>
          <FieldError show={clotureAttempted && clotureValidee !== true} message="Veuillez valider la clôture (Oui) avant de continuer." />
        </>
      )}

      {!isEditable && nc.statut === "Clôturée" && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
          <p className="text-sm font-medium text-slate-700">Clôture : {nc.clotureValidee ? "✅ Validée" : "❌ Non validée"}</p>
          {nc.commentaireCloture && <p className="text-sm text-slate-600">"{nc.commentaireCloture}"</p>}
        </div>
      )}
    </div>
  );
}