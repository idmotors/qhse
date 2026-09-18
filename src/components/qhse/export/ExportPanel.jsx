import React, { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { exportRowsToExcel, exportRowsToPdf } from "./exportUtils";

const segClass = (active) =>
  cn(
    "h-8 rounded-md border px-2 text-xs transition-colors",
    active
      ? "border-blue-600 bg-blue-50 font-medium text-blue-700"
      : "border-slate-200 text-slate-600 hover:bg-slate-50"
  );

/**
 * Panneau d'export partagé : choix du format (Excel / PDF), du périmètre
 * (vue filtrée / toutes les données accessibles via fetchAll) et des colonnes.
 */
export default function ExportPanel({ items, columns, title, fileName, sheetName = "Export", fetchAll }) {
  const [open, setOpen] = useState(false);
  const [fileFormat, setFileFormat] = useState("xlsx");
  const [scope, setScope] = useState("filtered");
  const [selectedKeys, setSelectedKeys] = useState(() => columns.filter((c) => c.default).map((c) => c.key));
  const [exporting, setExporting] = useState(false);

  const allSelected = selectedKeys.length === columns.length;

  const toggleKey = (key) =>
    setSelectedKeys((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));

  const handleExport = async () => {
    const cols = columns.filter((c) => selectedKeys.includes(c.key));
    if (cols.length === 0) return;
    setExporting(true);
    try {
      const rows = scope === "all" && fetchAll ? await fetchAll() : items;
      if (fileFormat === "xlsx") {
        exportRowsToExcel({ rows, columns: cols, fileName, sheetName });
      } else {
        exportRowsToPdf({ rows, columns: cols, fileName, title });
      }
      setOpen(false);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
        >
          <FileDown className="w-4 h-4" />
          Exporter
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4 p-4">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-700">Format</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={segClass(fileFormat === "xlsx")} onClick={() => setFileFormat("xlsx")}>
              Excel (.xlsx)
            </button>
            <button type="button" className={segClass(fileFormat === "pdf")} onClick={() => setFileFormat("pdf")}>
              PDF
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-700">Périmètre</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={segClass(scope === "filtered")} onClick={() => setScope("filtered")}>
              Vue filtrée ({items.length})
            </button>
            <button type="button" className={segClass(scope === "all")} onClick={() => setScope("all")}>
              Tout
            </button>
          </div>
          {scope === "filtered" && items.length === 0 && (
            <p className="text-[11px] text-slate-400">
              Aucun élément dans la vue actuelle — choisissez « Tout » pour exporter toutes vos données.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">Colonnes à inclure</p>
            <button
              type="button"
              onClick={() => setSelectedKeys(allSelected ? [] : columns.map((c) => c.key))}
              className="text-[11px] text-blue-600 hover:underline"
            >
              {allSelected ? "Tout décocher" : "Tout cocher"}
            </button>
          </div>
          <div className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-100">
            {columns.map((c) => (
              <label
                key={c.key}
                className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                <Checkbox checked={selectedKeys.includes(c.key)} onCheckedChange={() => toggleKey(c.key)} />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <Button onClick={handleExport} disabled={exporting || selectedKeys.length === 0} className="h-8 w-full text-xs">
          {exporting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Génération…
            </>
          ) : (
            "Télécharger l'export"
          )}
        </Button>
      </PopoverContent>
    </Popover>
  );
}