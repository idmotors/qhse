import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/components/qhse/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Upload, FileText } from "lucide-react";
import { SOURCES, PROCESSUS } from "@/components/qhse/constants";
import { formatDateFr } from "@/components/qhse/dateFormat";
import { logJournal } from "@/components/qhse/journalUtils";
import { notifyProcessus, getProcessusList, getResponsablesEmails } from "@/components/qhse/processusUtils";
import { normalizePiece } from "@/components/qhse/fileUtils";
import FieldError from "@/components/qhse/FieldError";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function CreateNC() {
  const { user, isQHSE } = useUserRole();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["all-users"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: processusList = [] } = useQuery({
    queryKey: ["processus-list"],
    queryFn: getProcessusList,
  });

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdNC, setCreatedNC] = useState(null);
  const [isPapier, setIsPapier] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const [form, setForm] = useState({
    titre: "",
    dateConstatation: "",
    processusDemandeur: "",
    processusAssigné: "",
    processusConcerne: "",
    source: "",
    ecartConstate: "",
    piecesJointes: [],
    derogationRequise: false,
    derogationDateDebut: "",
    derogationDateEcheance: "",
    initiateurNom: "",
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // Validation par étape
  const step1Valid = form.titre && form.dateConstatation && form.processusDemandeur && form.processusAssigné && form.ecartConstate;
  const step2Valid = !form.derogationRequise || (form.derogationDateDebut && form.derogationDateEcheance);
  // Erreurs rouges : visibles uniquement après une tentative de passage/soumission
  const [attempted, setAttempted] = useState(false);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    setUploadingFiles(true);
    const urls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push({ url: file_url, nom: file.name });
    }
    update("piecesJointes", [...form.piecesJointes, ...urls]);
    setUploadingFiles(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const datePart = `${year}-${month}${day}`;

    // Récupérer toutes les NC pour générer un numéro séquentiel unique du jour
    const allNCs = await base44.entities.NonConformite.list("-created_date", 500);
    const todayNCs = allNCs.filter(nc => nc.numero && nc.numero.startsWith(`NC-${datePart}`));
    const seq = String(todayNCs.length + 1).padStart(3, "0");
    const numero = `NC-${datePart}-${seq}`;

    const data = {
      numero,
      statut: "Ouverte",
      titre: form.titre,
      dateConstatation: form.dateConstatation,
      processusDemandeur: form.processusDemandeur,
      processusAssigné: form.processusAssigné,
      processusConcerne: form.processusAssigné, // backward compat
      departement: form.processusDemandeur, // backward compat filtres
      source: form.source || "Autre",
      ecartConstate: form.ecartConstate,
      piecesJointes: form.piecesJointes,
      derogationRequise: form.derogationRequise,
      derogationDateDebut: form.derogationDateDebut || undefined,
      derogationDateEcheance: form.derogationDateEcheance || undefined,
      // Emails des responsables du processus assigné, figés à la création :
      // base de l'accès (lecture + démarrage de l'investigation) pour le responsable du processus, quel que soit son profil.
      responsablesProcessus: getResponsablesEmails(processusList, form.processusAssigné),
      // Pilotes du processus demandeur, figés à la création :
      // accès lecture « Mes NC » pour tous les pilotes du processus demandeur, même si un collègue a déclaré la NC.
      pilotesProcessusDemandeur: getResponsablesEmails(processusList, form.processusDemandeur),
      circuitCreation: isPapier ? "Papier" : "Numérique",
      initiateur: isPapier ? form.initiateurNom : user?.full_name,
      initiateurEmail: isPapier ? "" : user?.email,
      historique: [{
        date: new Date().toISOString(),
        type: "NC ouverte",
        auteur: user?.full_name,
        detail: `NC ${numero} créée — Demandeur : ${form.processusDemandeur} | Assigné : ${form.processusAssigné}`
      }]
    };

    const created = await base44.entities.NonConformite.create(data);

    logJournal({ user, type: "Création NC", element: numero, details: `${form.titre} — ${form.processusAssigné}` });

    queryClient.invalidateQueries({ queryKey: ["mes-ncs"] });
    queryClient.invalidateQueries({ queryKey: ["ncs-dashboard"] });
    setCreatedNC(created);
    setSubmitted(true);
    setSubmitting(false);

    // Règle a : notification (in-app + email) à TOUS les responsables du Processus assigné
    // On passe la NC complète (processusConcerne/departement inclus) pour que le fallback
    // fonctionne même si processusAssigné est absent (NC historiques ou circuit Papier).
    notifyProcessus({
      nc: { ...created, numero, titre: form.titre },
      event: "new_nc",
    }).catch(e => console.warn("[notifyProcessus] new_nc failed", e));
  };

  if (submitted && createdNC) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">NC créée avec succès</h2>
        <p className="text-slate-500 mb-6">Votre Non-Conformité <strong>{createdNC.numero}</strong> a été enregistrée.</p>
        <div className="flex gap-3 justify-center">
          <Link to={`/NCDetail?id=${createdNC.id}`}>
            <Button className="bg-blue-600 hover:bg-blue-700">Voir ma NC</Button>
          </Link>
          <Link to="/MesNC">
            <Button variant="outline">Retour à la liste</Button>
          </Link>
        </div>
      </div>
    );
  }

  const steps = [
    { num: 1, label: "Ouverture" },
    { num: 2, label: "Récapitulatif" },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/MesNC" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 mb-6">
        <ArrowLeft className="w-4 h-4" /> Retour
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-2">Déclarer une Non-Conformité</h1>

      {/* Circuit Papier */}
      <div className="flex items-center gap-3 mb-4">
        <Switch checked={isPapier} onCheckedChange={setIsPapier} />
        <span className="text-sm text-slate-600">Saisie au nom d'un collaborateur (circuit Papier)</span>
      </div>
      {isPapier && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <FileText className="w-5 h-5 text-amber-600" />
          <span className="text-sm text-amber-800 font-medium">📋 Saisie QHSE — au nom de : {form.initiateurNom || "[Nom collaborateur]"}</span>
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <React.Fragment key={s.num}>
            <div className={`flex items-center gap-2 ${step >= s.num ? "text-blue-600" : "text-slate-400"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step > s.num ? "bg-blue-600 text-white" : step === s.num ? "bg-blue-100 text-blue-700 ring-2 ring-blue-600" : "bg-slate-100"}`}>
                {step > s.num ? <Check className="w-4 h-4" /> : s.num}
              </div>
              <span className="text-xs font-medium hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className={`flex-1 h-0.5 ${step > s.num ? "bg-blue-600" : "bg-slate-200"}`} />}
          </React.Fragment>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">

        {/* ─── STEP 1 : Ouverture ─── */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-slate-900">Ouverture de la NC</h2>

            {isPapier && (
              <div>
                <Label>Nom de l'initiateur <span className="text-red-500">*</span></Label>
                <Input value={form.initiateurNom} onChange={e => update("initiateurNom", e.target.value)} placeholder="Nom du collaborateur" className="mt-1" />
                <FieldError show={attempted && !form.initiateurNom} message="Veuillez saisir le nom de l'initiateur." />
              </div>
            )}

            <div>
              <Label>Titre de la NC <span className="text-red-500">*</span></Label>
              <Input value={form.titre} onChange={e => update("titre", e.target.value)} placeholder="Ex : Non-conformité fournisseur lot XX..." className="mt-1" />
              <FieldError show={attempted && !form.titre} message="Veuillez saisir le titre de la NC." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date de constatation <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.dateConstatation} onChange={e => update("dateConstatation", e.target.value)} max={format(new Date(), "yyyy-MM-dd")} className="mt-1" />
                <FieldError show={attempted && !form.dateConstatation} message="Veuillez renseigner la date de constatation." />
              </div>
              <div>
                <Label>Source</Label>
                <Select value={form.source} onValueChange={v => update("source", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Processus demandeur <span className="text-red-500">*</span></Label>
                <p className="text-xs text-slate-400 mt-0.5 mb-1">Processus qui déclare la NC.</p>
                <Select value={form.processusDemandeur} onValueChange={v => update("processusDemandeur", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {(processusList.length ? processusList.map(p => p.nom) : PROCESSUS).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError show={attempted && !form.processusDemandeur} message="Veuillez sélectionner le processus demandeur." />
              </div>
              <div>
                <Label>Processus assigné <span className="text-red-500">*</span></Label>
                <p className="text-xs text-slate-400 mt-0.5 mb-1">Tous les responsables de ce processus seront notifiés.</p>
                <Select value={form.processusAssigné} onValueChange={v => update("processusAssigné", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {(processusList.length ? processusList.map(p => p.nom) : PROCESSUS).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError show={attempted && !form.processusAssigné} message="Veuillez sélectionner le processus assigné." />
              </div>
            </div>

            <div>
              <Label>Description de l'écart / constatation <span className="text-red-500">*</span></Label>
              <Textarea value={form.ecartConstate} onChange={e => update("ecartConstate", e.target.value)} placeholder="Décrivez précisément l'écart constaté..." rows={4} className="mt-1" />
              <FieldError show={attempted && !form.ecartConstate} message="Veuillez décrire l'écart constaté." />
            </div>

            <div>
              <Label>Pièces jointes (photos, documents — JPG, PNG, PDF, max 10 Mo)</Label>
              <label className={`flex items-center gap-2 px-4 py-3 mt-1 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploadingFiles ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-400"}`}>
                <Upload className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-500">{uploadingFiles ? "Téléchargement en cours..." : "Ajouter des fichiers"}</span>
                <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} className="hidden" disabled={uploadingFiles} />
              </label>
              {form.piecesJointes.length > 0 && (
                <div className="mt-2 space-y-1">
                  {form.piecesJointes.map((item, i) => {
                    const p = normalizePiece(item);
                    return (
                      <div key={i} className="flex items-center gap-1">
                        <a href={p.url} target="_blank" rel="noopener noreferrer" title={p.nom}
                          className="text-xs text-blue-600 hover:underline truncate max-w-[220px]">{p.nom}</a>
                        <button type="button" onClick={() => update("piecesJointes", form.piecesJointes.filter((_, idx) => idx !== i))}
                          className="text-red-400 hover:text-red-600 flex-shrink-0" title="Retirer cette pièce jointe">×</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── STEP 2 : Dérogation & Récapitulatif ─── */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-slate-900">Récapitulatif & Soumission</h2>

            <div className="flex items-center gap-3">
              <Switch checked={form.derogationRequise} onCheckedChange={v => update("derogationRequise", v)} />
              <Label>Dérogation requise</Label>
            </div>
            {form.derogationRequise && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date de début <span className="text-red-500">*</span></Label>
                  <Input type="date" value={form.derogationDateDebut} onChange={e => update("derogationDateDebut", e.target.value)} className="mt-1" />
                  <FieldError show={attempted && !form.derogationDateDebut} message="Veuillez renseigner la date de début de la dérogation." />
                </div>
                <div>
                  <Label>Date d'échéance <span className="text-red-500">*</span></Label>
                  <Input type="date" value={form.derogationDateEcheance} onChange={e => update("derogationDateEcheance", e.target.value)} className="mt-1" />
                  <FieldError show={attempted && !form.derogationDateEcheance} message="Veuillez renseigner la date d'échéance de la dérogation." />
                </div>
              </div>
            )}

            <div className="bg-slate-50 rounded-xl p-5 space-y-3 text-sm">
              <h3 className="font-semibold text-slate-800">Récapitulatif</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-slate-500">Titre :</span> <span className="font-medium">{form.titre}</span></div>
                <div><span className="text-slate-500">Date :</span> <span className="font-medium">{form.dateConstatation ? formatDateFr(form.dateConstatation) : "—"}</span></div>
                <div><span className="text-slate-500">Processus demandeur :</span> <span className="font-medium">{form.processusDemandeur}</span></div>
                <div><span className="text-slate-500">Processus assigné :</span> <span className="font-medium">{form.processusAssigné}</span></div>
                <div><span className="text-slate-500">Source :</span> <span className="font-medium">{form.source || "—"}</span></div>
                <div><span className="text-slate-500">Circuit :</span> <span className="font-medium">{isPapier ? "Papier" : "Numérique"}</span></div>
                {form.piecesJointes.length > 0 && (
                  <div><span className="text-slate-500">PJ :</span> <span className="font-medium">{form.piecesJointes.length} fichier(s)</span></div>
                )}
              </div>
              <div>
                <p className="text-slate-500">Écart constaté :</p>
                <p className="text-slate-700 mt-1">{form.ecartConstate}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
          {step > 1 ? (
            <Button variant="outline" onClick={() => { setAttempted(false); setStep(step - 1); }}>
              <ArrowLeft className="w-4 h-4 mr-2" />Précédent
            </Button>
          ) : <div />}

          {step < 2 ? (
            <Button
              onClick={() => {
                if (!step1Valid) { setAttempted(true); return; }
                setAttempted(false);
                setStep(step + 1);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Suivant<ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (!step2Valid) { setAttempted(true); return; }
                setAttempted(false);
                handleSubmit();
              }}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {submitting
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                : <Check className="w-4 h-4 mr-2" />}
              Soumettre la NC
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}