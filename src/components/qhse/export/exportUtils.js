import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

const stamp = () => format(new Date(), "yyyy-MM-dd");

/**
 * Génère un fichier Excel (.xlsx) à partir de lignes et de définitions de colonnes.
 * En-tête sur la première ligne avec filtres automatiques, largeurs adaptées au contenu.
 */
export function exportRowsToExcel({ rows, columns, fileName, sheetName = "Export" }) {
  const header = columns.map((c) => c.label);
  const data = rows.map((r) => columns.map((c) => c.get(r)));

  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  ws["!cols"] = columns.map((c, i) => {
    let max = c.label.length;
    for (const row of data) max = Math.max(max, String(row[i] ?? "").length);
    return { wch: Math.min(Math.max(max + 2, 10), 48) };
  });
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length, c: header.length - 1 } }),
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${fileName}-${stamp()}.xlsx`);
}

/**
 * Génère un PDF de type rapport : en-tête titre + date + nombre d'éléments,
 * tableau auto-table (paysage si plus de 6 colonnes), pied de page numéroté.
 */
export function exportRowsToPdf({ rows, columns, fileName, title }) {
  const doc = new jsPDF({
    orientation: columns.length > 6 ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `ID Rental — Portal QHSE · Exporté le ${format(new Date(), "dd/MM/yyyy à HH:mm")} · ${rows.length} élément(s)`,
    14,
    22
  );

  autoTable(doc, {
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => c.get(r))),
    startY: 27,
    margin: { left: 14, right: 14, top: 27, bottom: 16 },
    styles: { fontSize: 7.5, cellPadding: 1.6, overflow: "linebreak", textColor: [51, 65, 85] },
    headStyles: { fillColor: [30, 64, 124], textColor: 255, fontSize: 7.5, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 248, 250] },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("Portal QHSE — ID Rental", 14, pageHeight - 7);
      doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - 14, pageHeight - 7, { align: "right" });
    },
  });

  doc.save(`${fileName}-${stamp()}.pdf`);
}