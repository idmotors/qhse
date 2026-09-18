import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import { getCauseRacine } from "@/components/qhse/nc/causeRacineUtils";
import { parseStoredDate } from "@/components/qhse/dateFormat";

export default function NCExportPDF({ nc, actions = [], inefficaceActionIds = [], actionsImmediates = [] }) {
  const [loading, setLoading] = useState(false);

  const generatePDF = async () => {
    setLoading(true);
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210;
    const margin = 15;
    const contentWidth = W - margin * 2;
    let y = 20;

    const LINE_H = 6;
    const SECTION_GAP = 8;

    const checkPage = (needed = 10) => {
      if (y + needed > 280) {
        doc.addPage();
        y = 20;
      }
    };

    const drawHeader = () => {
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, W, 18, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("RAPPORT NON-CONFORMITÉ", margin, 11);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Généré le ${format(new Date(), "dd/MM/yyyy à HH:mm")}`, W - margin, 11, { align: "right" });
      doc.setTextColor(0, 0, 0);
      y = 26;
    };

    const sectionTitle = (title) => {
      checkPage(12);
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 64, 175);
      doc.text(title.toUpperCase(), margin + 3, y + 5);
      doc.setTextColor(0, 0, 0);
      y += 10;
    };

    const field = (label, value, indent = 0) => {
      if (!value && value !== false) return;
      const str = String(value);
      const lines = doc.splitTextToSize(str, contentWidth - 40 - indent);
      checkPage(LINE_H * lines.length + 2);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(label + " :", margin + indent, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      doc.text(lines, margin + 40 + indent, y);
      y += LINE_H * lines.length;
    };

    const separator = () => {
      checkPage(4);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, W - margin, y);
      y += 4;
    };

    // === PAGE 1 : EN-TÊTE + IDENTIFICATION ===
    drawHeader();

    // Bandeau numéro NC + statut
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(margin, y, contentWidth, 14, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(nc.numero || "—", margin + 5, y + 9);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Statut : ${nc.statut}`, W - margin - 5, y + 9, { align: "right" });
    y += 18;

    sectionTitle("1. Identification");
    field("Date création", nc.created_date ? format(parseStoredDate(nc.created_date), "dd/MM/yyyy") : null);
    field("Initiateur", nc.initiateur);
    field("Email initiateur", nc.initiateurEmail);
    field("Source", nc.source);
    field("Département", nc.departement);
    field("Processus", nc.processusConcerne);
    field("Circuit", nc.circuitCreation);
    y += SECTION_GAP;

    sectionTitle("2. Description de l'écart");
    if (nc.ecartConstate) {
      const lines = doc.splitTextToSize(nc.ecartConstate, contentWidth - 6);
      checkPage(LINE_H * lines.length + 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 30, 30);
      doc.text(lines, margin + 3, y);
      y += LINE_H * lines.length + 2;
    }
    y += SECTION_GAP;

    if (nc.correctionsImmediates) {
      sectionTitle("3. Corrections immédiates");
      const lines = doc.splitTextToSize(nc.correctionsImmediates, contentWidth - 6);
      checkPage(LINE_H * lines.length + 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(lines, margin + 3, y);
      y += LINE_H * lines.length + SECTION_GAP;
    }

    // Dérogation
    if (nc.derogationRequise) {
      sectionTitle("4. Dérogation");
      field("Date début", nc.derogationDateDebut ? format(new Date(nc.derogationDateDebut), "dd/MM/yyyy") : null);
      field("Date échéance", nc.derogationDateEcheance ? format(new Date(nc.derogationDateEcheance), "dd/MM/yyyy") : null);
      y += SECTION_GAP;
    }

    // Analyse causale
    sectionTitle("5. Analyse causale");
    field("Méthode", nc.methodeAnalyse);
    field("Cause racine", getCauseRacine(nc));
    if (nc.criteresEfficacite) field("Critères efficacité", nc.criteresEfficacite);
    y += SECTION_GAP;

    // 5 Pourquoi
    if (nc.methodeAnalyse === "5 Pourquoi" && nc.fiveWhysAnalyses?.length > 0) {
      sectionTitle("5a. Analyses 5 Pourquoi");
      nc.fiveWhysAnalyses.forEach((a, idx) => {
        checkPage(12);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 30, 30);
        const causeLines = doc.splitTextToSize(`Cause ${idx + 1} : ${a.causeText || ""}`, contentWidth - 6);
        doc.text(causeLines, margin + 3, y);
        y += LINE_H * causeLines.length;
        (a.whys || []).forEach((w, wi) => {
          if (!w) return;
          const wLines = doc.splitTextToSize(`   Pourquoi ${wi + 1} : ${w}`, contentWidth - 10);
          checkPage(LINE_H * wLines.length + 1);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(71, 85, 105);
          doc.text(wLines, margin + 6, y);
          y += LINE_H * wLines.length;
        });
        if (a.conclusion) {
          const cLines = doc.splitTextToSize(`   → Conclusion : ${a.conclusion}`, contentWidth - 10);
          checkPage(LINE_H * cLines.length + 1);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(30, 64, 175);
          doc.text(cLines, margin + 6, y);
          doc.setTextColor(0, 0, 0);
          y += LINE_H * cLines.length;
        }
        y += 3;
      });
      y += SECTION_GAP;
    }

    // 5M / Fishbone
    if (nc.methodeAnalyse === "5M" && nc.fishboneCauses) {
      sectionTitle("5b. Causes Fishbone (5M)");
      const branches = ["Méthode", "Matière", "Milieu", "Main d'œuvre", "Matériel", "Management"];
      branches.forEach(branch => {
        const causes = nc.fishboneCauses?.[branch] || [];
        if (causes.length === 0) return;
        checkPage(8 + causes.length * LINE_H);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 30, 30);
        doc.text(branch + " :", margin + 3, y);
        y += LINE_H;
        causes.forEach(c => {
          const txt = typeof c === "object" ? (c.text || c.cause || JSON.stringify(c)) : String(c);
          const lines = doc.splitTextToSize("• " + txt, contentWidth - 12);
          checkPage(LINE_H * lines.length + 1);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(71, 85, 105);
          doc.text(lines, margin + 8, y);
          y += LINE_H * lines.length;
        });
      });
      y += SECTION_GAP;
    }

    // Actions immédiates (nouveau workflow) — section distincte des actions correctives
    if (actionsImmediates.length > 0) {
      sectionTitle("Actions immédiates");
      actionsImmediates.forEach((action, idx) => {
        checkPage(24);
        const statColor = action.statut === "Réalisée" ? [34, 197, 94] : [251, 191, 36];
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, y, contentWidth, 18, 2, 2, "F");
        doc.setFillColor(...statColor);
        doc.circle(margin + 4, y + 5, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 30, 30);
        const descLines = doc.splitTextToSize(`${idx + 1}. ${action.description}`, contentWidth - 10);
        doc.text(descLines, margin + 8, y + 5);
        y += 5 + LINE_H * descLines.length;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Responsable : ${action.responsableNom || action.responsable || "—"}`, margin + 8, y);
        doc.text(`Échéance : ${action.dateFinPrevue ? format(new Date(action.dateFinPrevue), "dd/MM/yyyy") : "—"}`, margin + 90, y);
        doc.text(`Statut : ${action.statut || "À faire"}`, margin + 155, y);
        y += LINE_H + 4;
      });
      y += SECTION_GAP;
    }

    // Actions correctives
    const activeActions = actions.filter(a => !inefficaceActionIds.includes(a.id));
    sectionTitle("6. Actions correctives");
    if (activeActions.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text("Aucune action corrective enregistrée.", margin + 3, y);
      y += LINE_H + SECTION_GAP;
    } else {
      activeActions.forEach((action, idx) => {
        checkPage(28);
        const statColor = (action.statut === "Réalisée" || action.statut === "Terminé") ? [34, 197, 94] : action.statut === "En retard" ? [239, 68, 68] : action.statut === "En vérification" ? [139, 92, 246] : [251, 191, 36];
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, y, contentWidth, 22, 2, 2, "F");
        doc.setFillColor(...statColor);
        doc.circle(margin + 4, y + 5, 2, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 30, 30);
        const descLines = doc.splitTextToSize(`${idx + 1}. ${action.description}`, contentWidth - 10);
        doc.text(descLines, margin + 8, y + 5);
        y += 5 + LINE_H * descLines.length;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Responsable : ${action.responsableNom || action.responsable || "—"}`, margin + 8, y);
        doc.text(`Échéance : ${action.dateFinPrevue ? format(new Date(action.dateFinPrevue), "dd/MM/yyyy") : "—"}`, margin + 90, y);
        doc.text(`Statut : ${action.statut}`, margin + 155, y);
        y += LINE_H;

        if (action.commentaireRealisation) {
          const cLines = doc.splitTextToSize("Note : " + action.commentaireRealisation, contentWidth - 12);
          checkPage(LINE_H * cLines.length + 1);
          doc.setFontSize(7.5);
          doc.setTextColor(71, 85, 105);
          doc.text(cLines, margin + 8, y);
          y += LINE_H * cLines.length;
        }
        y += 5;
      });
      y += SECTION_GAP;
    }

    // Vérification
    if (nc.criteresVerification || nc.resultatsVerification) {
      sectionTitle("7. Vérification d'efficacité");
      field("Critères", nc.criteresVerification);
      field("Résultats", nc.resultatsVerification);
      field("Vérifié par", nc.verifiePar);
      field("Date vérification", nc.dateVerification ? format(new Date(nc.dateVerification), "dd/MM/yyyy") : null);
      field("Action efficace", nc.actionEfficace === true ? "Oui ✓" : nc.actionEfficace === false ? "Non ✗" : null);
      y += SECTION_GAP;
    }

    // Clôture
    if (nc.statut === "Clôturée" || nc.clotureValidee || nc.commentaireCloture) {
      sectionTitle("8. Clôture");
      field("Clôturée le", nc.dateCloture ? format(new Date(nc.dateCloture), "dd/MM/yyyy") : null);
      field("Délai de traitement", nc.delaiTraitementEffectif != null ? `${nc.delaiTraitementEffectif} jours` : null);
      field("Dans les délais", nc.clotureDansDelai === true ? "Oui ✓" : nc.clotureDansDelai === false ? "Non ✗" : null);
      field("Commentaire", nc.commentaireCloture);
      y += SECTION_GAP;
    }

    // Documents qualité
    if (nc.miseAJourDocumentsQualite && nc.documentsQualiteConcernes) {
      sectionTitle("9. Documents qualité mis à jour");
      field("Documents", nc.documentsQualiteConcernes);
      y += SECTION_GAP;
    }

    // Pied de page sur chaque page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, 287, W - margin, 287);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`${nc.numero} — CONFIDENTIEL`, margin, 291);
      doc.text(`Page ${i} / ${pageCount}`, W - margin, 291, { align: "right" });
    }

    doc.save(`${nc.numero || "NC"}_rapport.pdf`);
    setLoading(false);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={generatePDF}
      disabled={loading}
      className="flex items-center gap-2 text-slate-600 border-slate-200 hover:bg-slate-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
      {loading ? "Génération..." : "Exporter PDF"}
    </Button>
  );
}