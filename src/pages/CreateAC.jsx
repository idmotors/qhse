import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/components/qhse/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Plus, Save, Trash2 } from "lucide-react";
import { PROCESSUS, SOURCES } from "@/components/qhse/constants";
import { getProcessusList, getResponsablesEmails } from "@/components/qhse/processusUtils";
import { notifyAC } from "@/components/qhse/notifyAC";
import { logJournal } from "@/components/qhse/journalUtils";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import FieldError from "@/components/qhse/FieldError";

const emptyAction = { description: "", responsable: "", dateFinPrevue: "" };

export default function CreateAC() {
  const { user } = useUserRole();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  // Erreurs rouges : visibles uniquement après une tentative de passage/soumission
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdAC, setCreatedAC] = useState(null);

  const [form, setForm] = useState({ processusInitiateur: "", source: "", constat: "", descriptionAmelioration: "" });
  const [actions, setActions] = useState([emptyAction]);

  // Mode édition d'un brouillon : ?draftId=... charge la fiche et les actions déjà saisies
  const navigate = useNavigate();
  const draftId = new URLSearchParams(window.location.search).get("draftId");
  const [draft, setDraft] = useState(null);
  const [draftLoading, setDraftLoading] = useState(!!draftId);
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    if (!draftId) return;
    (async () => {
      try {
        const ac = await base44.entities.AmeliorationContinue.get(draftId);
        if (ac && ac.statut === "Brouillon") {
          setDraft(ac);
          setForm({
            processusInitiateur: ac.processusInitiateur || "",
            source: ac.source || "",
            constat: ac.constat || "",
            descriptionAmelioration: ac.descriptionAmelioration === "(à compléter)" ? "" : (ac.descriptionAmelioration || ""),
          });
          const rows = (ac.brouillonActions || []).map(a => ({ description: a.description || "", responsable: a.responsable || "", dateFinPrevue: a.dateFinPrevue || "" }));
          setActions(rows.length > 0 ? rows : [emptyAction]);
        }
      } catch (e) {
        console.warn("[CreateAC] Brouillon introuvable ou inaccessible", { draftId, err: String(e?.message || e) });
      } finally {
        setDraftLoading(false);
      }
    })();
  }, [draftId]);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const updateAction = (i, field, value) => setActions(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a));
  const addActionRow = () => setActions(prev => [...prev, emptyAction]);
  const removeActionRow = (i) => setActions(prev => prev.filter((_, idx) => idx !== i));

  const step1Valid = form.processusInitiateur && form.source && form.constat.trim();
  const step2Valid = form.descriptionAmelioration.trim() &&
    actions.length > 0 &&
    actions.every(a => a.description.trim() && a.responsable && a.dateFinPrevue);

  // Brouillon : validation allégée — seul le constat est requis pour identifier la fiche
  const draftValid = !!form.constat.trim();

  // Enregistrement en brouillon : aucune notification, aucune assignation — les actions
  // restent dans la fiche (brouillonActions) et ne sont créées dans ActionAmelioration
  // qu'au moment de la soumission finale.
  const handleSaveDraft = async () => {
    if (!draftValid || savingDraft) return;
    setSavingDraft(true);
    try {
      const processusList = await getProcessusList();
      const payload = {
        processusInitiateur: form.processusInitiateur || "",
        source: form.source || "Autre",
        constat: form.constat.trim(),
        descriptionAmelioration: form.descriptionAmelioration.trim() || "(à compléter)",
        initiateur: user?.full_name,
        initiateurEmail: user?.email,
        pilotesProcessusInitiateur: form.processusInitiateur ? getResponsablesEmails(processusList, form.processusInitiateur) : [],
        brouillonActions: actions
          .filter(a => a.description.trim())
          .map(a => ({ description: a.description.trim(), responsable: a.responsable || "", dateFinPrevue: a.dateFinPrevue || "" })),
      };
      if (draft) {
        await base44.entities.AmeliorationContinue.update(draft.id, {
          ...payload,
          historique: [...(draft.historique || []), { date: new Date().toISOString(), type: "Brouillon", auteur: user?.full_name || user?.email || "—", detail: "Brouillon mis à jour" }],
        });
        toast({ title: "Brouillon mis à jour", description: `La fiche ${draft.numero} reste modifiable depuis « Mes AC ».` });
      } else {
        // Numérotation identique à la soumission : AC-AAAA-MM-JJ-XXX, compteur journalier
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const prefix = `AC-${dateStr}`;
        let numero = `${prefix}-001`;
        try {
          const acs = await base44.entities.AmeliorationContinue.filter({}, "-created_date", 500).catch(() => []);
          const nums = [...(acs || [])]
            .map(t => t.numero || "")
            .filter(n => n.startsWith(prefix))
            .map(n => parseInt(n.split("-").pop(), 10) || 0);
          const next = (nums.length ? Math.max(...nums) : 0) + 1;
          numero = `${prefix}-${String(next).padStart(3, "0")}`;
        } catch (e) { /* fallback : 001 */ }
        const created = await base44.entities.AmeliorationContinue.create({
          numero,
          statut: "Brouillon",
          ...payload,
          historique: [{ date: new Date().toISOString(), type: "Création", auteur: user?.full_name || user?.email || "—", detail: "Brouillon enregistré" }],
        });
        setDraft(created);
        toast({ title: "Brouillon enregistré", description: `La fiche ${numero} est disponible dans « Mes AC » pour être reprise plus tard.` });
      }
      queryClient.invalidateQueries({ queryKey: ["mes-ac"] });
      navigate("/MesAC");
    } catch (e) {
      console.error("[CreateAC] Échec de l'enregistrement du brouillon", e);
      toast({
        title: "Échec de l'enregistrement",
        description: "Le brouillon n'a pas pu être enregistré. Vous pouvez réessayer.",
        variant: "destructive",
      });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
    // Responsables de chaque processus assigné + union pour la fiche
    const processusList = await getProcessusList();
    const respByEmails = actions.map(a => getResponsablesEmails(processusList, a.responsable));
    const responsablesProcessus = [...new Set(respByEmails.flat())];

    let acId;
    let numero;

    if (draft) {
      // Soumission depuis un brouillon : la fiche passe à « À traiter », les actions réelles
      // sont créées et le circuit de notification standard s'applique comme pour une création.
      numero = draft.numero;
      acId = draft.id;
      await base44.entities.AmeliorationContinue.update(draft.id, {
        statut: "À traiter",
        processusInitiateur: form.processusInitiateur,
        source: form.source,
        initiateur: user?.full_name,
        initiateurEmail: user?.email,
        constat: form.constat.trim(),
        descriptionAmelioration: form.descriptionAmelioration.trim(),
        responsablesProcessus,
        // Pilotes du processus initiateur, (re)figés à la soumission :
        // accès lecture « Mes AC » pour tous les pilotes du processus initiateur.
        pilotesProcessusInitiateur: getResponsablesEmails(processusList, form.processusInitiateur),
        brouillonActions: [],
        historique: [
          ...(draft.historique || []),
          { date: new Date().toISOString(), type: "Soumission", auteur: user?.full_name || user?.email || "—", detail: `Brouillon soumis avec ${actions.length} action(s)` },
        ],
      });
    } else {
      // Numérotation : AC-AAAA-MM-JJ-XXX, compteur journalier (AC existantes pour éviter tout doublon)
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const prefix = `AC-${dateStr}`;
      numero = `${prefix}-001`;
      try {
        const acs = await base44.entities.AmeliorationContinue.filter({}, "-created_date", 500).catch(() => []);
        const nums = [...(acs || [])]
          .map(t => t.numero || "")
          .filter(n => n.startsWith(prefix))
          .map(n => parseInt(n.split("-").pop(), 10) || 0);
        const next = (nums.length ? Math.max(...nums) : 0) + 1;
        numero = `${prefix}-${String(next).padStart(3, "0")}`;
      } catch (e) { /* fallback : 001 */ }

      const created = await base44.entities.AmeliorationContinue.create({
        numero,
        statut: "À traiter",
        processusInitiateur: form.processusInitiateur,
        source: form.source,
        initiateur: user?.full_name,
        initiateurEmail: user?.email,
        constat: form.constat.trim(),
        descriptionAmelioration: form.descriptionAmelioration.trim(),
        responsablesProcessus,
        // Pilotes du processus initiateur, figés à la création :
        // accès lecture « Mes AC » pour tous les pilotes du processus initiateur, même si un collègue a soumis la fiche.
        pilotesProcessusInitiateur: getResponsablesEmails(processusList, form.processusInitiateur),
        historique: [
          { date: new Date().toISOString(), type: "Création", auteur: user?.full_name || user?.email || "—", detail: `Fiche AC créée avec ${actions.length} action(s)` },
        ],
      });
      acId = created.id;
    }

    // Création des actions liées
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i];
      await base44.entities.ActionAmelioration.create({
        acId,
        initiateurEmail: user?.email,
        responsablesProcessus: respByEmails[i],
        description: a.description.trim(),
        responsable: a.responsable,
        responsableNom: a.responsable,
        dateFinPrevue: a.dateFinPrevue,
        statut: "En cours",
        historique: [
          { date: new Date().toISOString(), ancienStatut: "—", nouveauStatut: "En cours", auteurEmail: user?.email || "", auteurNom: user?.full_name || "—" },
        ],
      });
    }

    // Notification groupée : une seule notification par processus responsable,
    // listant toutes les actions qui lui sont assignées (description + échéance)
    const byProcessus = {};
    actions.forEach(a => {
      if (!byProcessus[a.responsable]) byProcessus[a.responsable] = [];
      byProcessus[a.responsable].push({ description: a.description.trim(), responsable: a.responsable, dateFinPrevue: a.dateFinPrevue });
    });
    Object.entries(byProcessus).forEach(([proc, procActions]) => {
      notifyAC({ ac: { id: acId, numero }, event: "action_assigned", actions: procActions })
        .catch(e => console.warn("[CreateAC] Échec de la notification 'action_assigned'", { numero, processus: proc, err: String(e?.message || e) }));
    });

    // Supervision : l'équipe QHSE est informée de la déclaration de la fiche (dédoublonnée des processus assignés)
    notifyAC({ ac: { id: acId, numero }, event: "new_ac" })
      .catch(e => console.warn("[CreateAC] Échec de la notification 'new_ac'", { numero, err: String(e?.message || e) }));

    logJournal({ user, type: "Création AC", element: numero, details: `AC créée avec ${actions.length} action(s) — ${form.constat.slice(0, 100)}` });
    queryClient.invalidateQueries({ queryKey: ["mes-ac"] });
    queryClient.invalidateQueries({ queryKey: ["ac-dashboard"] });
    setCreatedAC({ id: acId, numero });
    setSubmitted(true);
    setSubmitting(false);
    } catch (e) {
      console.error("[CreateAC] Échec de la soumission", e);
      toast({
        title: "Échec de l'envoi de l'AC",
        description: "L'AC n'a pas pu être envoyée. Vous pouvez réessayer ; si le problème persiste, contactez l'équipe QHSE.",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  if (draftLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (submitted && createdAC) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">AC créée avec succès</h2>
        <p className="text-slate-500 mb-6">Votre AC <strong>{createdAC.numero}</strong> a été enregistrée. Les processus assignés et l'équipe QHSE ont été notifiés.</p>
        <div className="flex gap-3 justify-center">
          <Link to={`/ACDetail?id=${createdAC.id}`}>
            <Button className="bg-blue-600 hover:bg-blue-700">Voir mon AC</Button>
          </Link>
          <Link to="/MesAC">
            <Button variant="outline">Retour à la liste</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/MesAC" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 mb-6">
        <ArrowLeft className="w-4 h-4" /> Retour
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        {draft ? `Reprendre le brouillon ${draft.numero}` : "Déclarer une Amélioration Continue"}
      </h1>

      {/* Progress */}
      <div className="flex items-center gap-4 mb-8">
        {[{ num: 1, label: "Identification" }, { num: 2, label: "Amélioration & actions" }].map((s, i) => (
          <React.Fragment key={s.num}>
            <div className={`flex items-center gap-2 ${step >= s.num ? "text-blue-600" : "text-slate-400"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step > s.num ? "bg-blue-600 text-white" : step === s.num ? "bg-blue-100 text-blue-700 ring-2 ring-blue-600" : "bg-slate-100"}`}>
                {step > s.num ? <Check className="w-4 h-4" /> : s.num}
              </div>
              <span className="text-xs font-medium">{s.label}</span>
            </div>
            {i === 0 && <div className={`flex-1 h-0.5 ${step > 1 ? "bg-blue-600" : "bg-slate-200"}`} />}
          </React.Fragment>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-slate-900">Identification</h2>
            <div>
              <Label>Processus initiateur <span className="text-red-500">*</span></Label>
              <Select value={form.processusInitiateur} onValueChange={v => update("processusInitiateur", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {PROCESSUS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldError show={attempted && !form.processusInitiateur} message="Veuillez sélectionner le processus initiateur." />
            </div>
            <div>
              <Label>Source <span className="text-red-500">*</span></Label>
              <Select value={form.source} onValueChange={v => update("source", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldError show={attempted && !form.source} message="Veuillez sélectionner la source." />
            </div>
            <div>
              <Label>Constat / opportunité identifiée <span className="text-red-500">*</span></Label>
              <Textarea value={form.constat} onChange={e => update("constat", e.target.value)} placeholder="Décrivez le constat ou l'opportunité..." rows={4} className="mt-1" />
              <FieldError show={attempted && !form.constat.trim()} message="Veuillez décrire le constat / l'opportunité identifiée." />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-slate-900">Amélioration & actions</h2>
            <div>
              <Label>Amélioration souhaitée <span className="text-red-500">*</span></Label>
              <Textarea value={form.descriptionAmelioration} onChange={e => update("descriptionAmelioration", e.target.value)} placeholder="Décrivez l'amélioration souhaitée..." rows={4} className="mt-1" />
              <FieldError show={attempted && !form.descriptionAmelioration.trim()} message="Veuillez décrire l'amélioration souhaitée." />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Actions d'amélioration <span className="text-red-500">*</span></Label>
                <Button size="sm" variant="outline" onClick={addActionRow}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter une action
                </Button>
              </div>
              {actions.map((a, i) => (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Action {i + 1}</span>
                    {actions.length > 1 && (
                      <button
                        onClick={() => removeActionRow(i)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                        title="Supprimer cette action"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <Input value={a.description} onChange={e => updateAction(i, "description", e.target.value)} placeholder="Titre de l'action" />
                  <FieldError show={attempted && !a.description.trim()} message="Veuillez saisir l'intitulé de l'action." />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Select value={a.responsable} onValueChange={v => updateAction(i, "responsable", v)}>
                        <SelectTrigger><SelectValue placeholder="Processus responsable" /></SelectTrigger>
                        <SelectContent>
                          {PROCESSUS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FieldError show={attempted && !a.responsable} message="Veuillez sélectionner le processus responsable." />
                    </div>
                    <div>
                      <Input type="date" value={a.dateFinPrevue} onChange={e => updateAction(i, "dateFinPrevue", e.target.value)} />
                      <FieldError show={attempted && !a.dateFinPrevue} message="Veuillez renseigner l'échéance de l'action." />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recap */}
            <div className="bg-slate-50 rounded-xl p-5 space-y-2 text-sm">
              <h3 className="font-semibold text-slate-800">Récapitulatif</h3>
              <div><span className="text-slate-500">Processus initiateur :</span> {form.processusInitiateur}</div>
              <div><span className="text-slate-500">Source :</span> {form.source}</div>
              <div><span className="text-slate-500">Constat :</span> {form.constat}</div>
              <div><span className="text-slate-500">Amélioration souhaitée :</span> {form.descriptionAmelioration}</div>
              <div><span className="text-slate-500">Actions :</span> {actions.filter(a => a.description.trim()).length}</div>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
          {step > 1 ? (
            <Button variant="outline" onClick={() => { setAttempted(false); setStep(1); }}>
              <ArrowLeft className="w-4 h-4 mr-2" />Précédent
            </Button>
          ) : <div />}

          {step === 1 ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => { if (!draftValid) { setAttempted(true); return; } handleSaveDraft(); }} disabled={savingDraft}>
                <Save className="w-4 h-4 mr-2" />{savingDraft ? "Enregistrement..." : "Enregistrer en brouillon"}
              </Button>
              <Button onClick={() => { if (!step1Valid) { setAttempted(true); return; } setAttempted(false); setStep(2); }} className="bg-blue-600 hover:bg-blue-700">
                Suivant<ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => { if (!draftValid) { setAttempted(true); return; } handleSaveDraft(); }} disabled={savingDraft}>
                <Save className="w-4 h-4 mr-2" />{savingDraft ? "Enregistrement..." : "Enregistrer en brouillon"}
              </Button>
              <Button onClick={() => { if (!step2Valid) { setAttempted(true); return; } setAttempted(false); handleSubmit(); }} disabled={submitting} className="bg-green-600 hover:bg-green-700">
                {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                Soumettre l'AC
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}