import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus, Pencil, Trash2, Download, Check, AlertCircle, ChevronDown, ChevronUp, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { normalizePiece } from "@/components/qhse/fileUtils";

const BRANCHES = [
  { id: "Méthode",      color: "#363886", side: "top",    xRatio: 0.22 },
  { id: "Matière",      color: "#7c3aed", side: "top",    xRatio: 0.45 },
  { id: "Milieu",       color: "#0891b2", side: "top",    xRatio: 0.68 },
  { id: "Main d'œuvre", color: "#b45309", side: "bottom", xRatio: 0.22 },
  { id: "Matériel",     color: "#dc2626", side: "bottom", xRatio: 0.45 },
  { id: "Management",   color: "#16a34a", side: "bottom", xRatio: 0.68 },
];

const W = 900, H = 440, SPINE_Y = 220, HEAD_X = 820, TAIL_X = 60;

function branchPoints(b) {
  const spineX = TAIL_X + (HEAD_X - 80 - TAIL_X) * b.xRatio;
  const labelY = b.side === "top" ? 55 : H - 55;
  const labelX = spineX - 30;
  return { spineX, labelY, labelX };
}

export default function FishboneDiagram({ nc, onSave, saveStatus, onOpenFiveWhys }) {
  const [activeBranch, setActiveBranch] = useState(null);
  const [causeInput, setCauseInput] = useState("");
  const [causeError, setCauseError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [fiveWhysTarget, setFiveWhysTarget] = useState(null);
  const [fiveWhysInputs, setFiveWhysInputs] = useState(["", "", "", "", ""]);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const diagramRef = useRef();

  const causes = nc.fishboneCauses || {};
  const branchCauses = (id) => causes[id] || [];
  const totalCauses = Object.values(causes).flat().length;
  const filledBranches = BRANCHES.filter(b => branchCauses(b.id).length > 0).length;

  const handleSave = (updated) => onSave("fishboneCauses", updated);

  const addCause = () => {
    const trimmed = causeInput.trim();
    if (!trimmed) { setCauseError("La cause ne peut pas être vide."); return; }
    setCauseError("");
    const newCause = { id: Date.now().toString(), text: trimmed, fiveWhys: [] };
    const updated = { ...causes, [activeBranch]: [...branchCauses(activeBranch), newCause] };
    handleSave(updated);
    setCauseInput("");
  };

  const deleteCause = (branchId, causeId) => {
    const updated = { ...causes, [branchId]: branchCauses(branchId).filter(c => c.id !== causeId) };
    handleSave(updated);
    setConfirmDelete(null);
  };

  const startEdit = (cause) => { setEditingId(cause.id); setEditText(cause.text); };
  const saveEdit = (branchId) => {
    const updated = {
      ...causes,
      [branchId]: branchCauses(branchId).map(c => c.id === editingId ? { ...c, text: editText } : c)
    };
    handleSave(updated);
    setEditingId(null);
  };

  const saveFiveWhys = (branchId, causeId) => {
    const updated = {
      ...causes,
      [branchId]: branchCauses(branchId).map(c => c.id === causeId ? { ...c, fiveWhys: fiveWhysInputs } : c)
    };
    handleSave(updated);
    setFiveWhysTarget(null);
  };

  const openFiveWhys = (branchId, cause) => {
    if (onOpenFiveWhys) {
      onOpenFiveWhys({ branchId, causeId: cause.id, causeText: cause.text, initialWhys: cause.fiveWhys || [], initialConclusion: cause.fiveWhysConclusion || "" });
      setActiveBranch(null);
    } else {
      setFiveWhysTarget({ branchId, causeId: cause.id });
      setFiveWhysInputs(cause.fiveWhys?.length === 5 ? cause.fiveWhys : ["", "", "", "", ""]);
      setActiveBranch(null);
    }
  };

  const exportDiagram = async (type) => {
    setExportLoading(true);
    const exportDiv = document.createElement("div");
    exportDiv.style.cssText = "position:fixed;left:-9999px;top:0;background:#fff;padding:24px;width:1100px;font-family:sans-serif;";
    const title = document.createElement("h2");
    title.textContent = `Diagramme Fishbone — ${nc.numero || "NC"} ${nc.titre ? "— " + nc.titre : ""}`;
    title.style.cssText = "font-size:16px;font-weight:bold;margin-bottom:12px;color:#363886;";
    exportDiv.appendChild(title);
    const svgClone = diagramRef.current.cloneNode(true);
    svgClone.style.cssText = "width:1050px;height:auto;display:block;margin-bottom:20px;";
    exportDiv.appendChild(svgClone);
    BRANCHES.forEach(b => {
      const bc = (causes[b.id] || []);
      if (bc.length === 0) return;
      const section = document.createElement("div");
      section.style.cssText = "margin-bottom:16px;";
      const heading = document.createElement("div");
      heading.textContent = b.id;
      heading.style.cssText = `font-size:13px;font-weight:700;color:${b.color};border-left:4px solid ${b.color};padding-left:8px;margin-bottom:6px;`;
      section.appendChild(heading);
      bc.forEach((cause, ci) => {
        const row = document.createElement("div");
        row.style.cssText = "background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;margin-bottom:6px;";
        const causeText = document.createElement("p");
        causeText.textContent = `${ci + 1}. ${cause.text}`;
        causeText.style.cssText = "font-size:12px;font-weight:600;color:#1e293b;margin:0 0 4px 0;";
        row.appendChild(causeText);
        if (cause.fiveWhys?.some(w => w)) {
          cause.fiveWhys.filter(w => w).forEach((w, wi) => {
            const why = document.createElement("p");
            why.textContent = `  Pourquoi ${wi + 1} : ${w}`;
            why.style.cssText = "font-size:11px;color:#64748b;margin:1px 0 1px 12px;";
            row.appendChild(why);
          });
          if (cause.fiveWhysConclusion) {
            const concl = document.createElement("p");
            concl.textContent = `  → Conclusion : ${cause.fiveWhysConclusion}`;
            concl.style.cssText = "font-size:11px;color:#b45309;font-weight:600;margin:2px 0 0 12px;";
            row.appendChild(concl);
          }
        }
        section.appendChild(row);
      });
      exportDiv.appendChild(section);
    });
    document.body.appendChild(exportDiv);
    const canvas = await html2canvas(exportDiv, { backgroundColor: "#fff", scale: 2, useCORS: true });
    document.body.removeChild(exportDiv);
    if (type === "png") {
      const link = document.createElement("a");
      link.download = `fishbone-${nc.numero || "nc"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } else {
      const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width / 2, canvas.height / 2] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`fishbone-${nc.numero || "nc"}.pdf`);
    }
    try {
      const blob = await (await fetch(canvas.toDataURL("image/png"))).blob();
      const file = new File([blob], `fishbone-${nc.numero}.png`, { type: "image/png" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const existing = nc.piecesJointes || [];
      if (!existing.some(item => normalizePiece(item).url === file_url)) {
        onSave("piecesJointes", [...existing, { url: file_url, nom: file.name }]);
      }
    } catch (_) {}
    setExportLoading(false);
  };

  const activeBranchData = BRANCHES.find(b => b.id === activeBranch);
  const totalFilledWhys = Object.values(causes).flat().filter(c => c.fiveWhys?.some(w => w)).length;

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            Cliquez sur une branche du diagramme pour ajouter ou consulter ses causes
          </span>
          {/* Progress pill */}
          <div className="flex items-center gap-1.5 bg-slate-100 rounded-full px-3 py-1">
            <div className="flex gap-0.5">
              {BRANCHES.map(b => (
                <div key={b.id}
                  title={`${b.id} : ${branchCauses(b.id).length} cause(s)`}
                  style={{ backgroundColor: branchCauses(b.id).length > 0 ? b.color : "#e2e8f0" }}
                  className="w-2.5 h-2.5 rounded-full transition-colors cursor-pointer hover:scale-125"
                  onClick={() => setActiveBranch(b.id)}
                />
              ))}
            </div>
            <span className="text-xs font-medium text-slate-600">{filledBranches}/6</span>
          </div>
          {totalFilledWhys > 0 && (
            <div className="flex items-center gap-1 bg-amber-100 rounded-full px-2.5 py-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
              <span className="text-xs font-medium text-amber-700">{totalFilledWhys} 5W renseigné{totalFilledWhys > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === "saving" && <span className="text-xs text-slate-400 animate-pulse">Sauvegarde…</span>}
          {saveStatus === "saved" && <span className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Sauvegardé</span>}
          {saveStatus === "error" && <span className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Erreur</span>}
          <Button size="sm" variant="outline" disabled={exportLoading} onClick={() => exportDiagram("png")}>
            <Download className="w-3 h-3 mr-1" />{exportLoading ? "…" : "PNG"}
          </Button>
          <Button size="sm" variant="outline" disabled={exportLoading} onClick={() => exportDiagram("pdf")}>
            <Download className="w-3 h-3 mr-1" />{exportLoading ? "…" : "PDF"}
          </Button>
        </div>
      </div>

      {totalCauses === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Cliquez sur l'une des 6 branches pour ajouter une première cause. Le diagramme doit contenir au moins une cause avant de passer à l'étape suivante.
        </div>
      )}

      {/* SVG Fishbone */}
      <div ref={diagramRef} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minHeight: 240 }}>
          {/* Spine */}
          <line x1={TAIL_X} y1={SPINE_Y} x2={HEAD_X - 30} y2={SPINE_Y} stroke="#363886" strokeWidth="3" />
          <polygon points={`${HEAD_X},${SPINE_Y} ${HEAD_X - 18},${SPINE_Y - 8} ${HEAD_X - 18},${SPINE_Y + 8}`} fill="#363886" />
          {/* Fish head */}
          <ellipse cx={HEAD_X + 28} cy={SPINE_Y} rx={32} ry={22} fill="#363886" />
          <text x={HEAD_X + 28} y={SPINE_Y - 7} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">
            {(nc.titre || "NC").substring(0, 14)}
          </text>
          <text x={HEAD_X + 28} y={SPINE_Y + 5} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">
            {(nc.titre || "NC").length > 14 ? (nc.titre || "NC").substring(14, 28) + "…" : ""}
          </text>
          {/* "Effet" label */}
          <text x={HEAD_X + 28} y={SPINE_Y + 15} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="6">Effet</text>

          {/* Branches */}
          {BRANCHES.map(b => {
            const { spineX, labelY, labelX } = branchPoints(b);
            const bCauses = branchCauses(b.id);
            const isActive = activeBranch === b.id;
            const midY = b.side === "top" ? labelY + 25 : labelY - 25;

            return (
              <g key={b.id} onClick={() => { setActiveBranch(b.id); setCauseInput(""); setCauseError(""); }} style={{ cursor: "pointer" }}>
                {/* Branch line */}
                <line x1={labelX} y1={midY} x2={spineX} y2={SPINE_Y}
                  stroke={b.color} strokeWidth={isActive ? 3.5 : 2}
                  strokeDasharray={isActive ? "none" : "none"}
                />
                {/* Active glow */}
                {isActive && <line x1={labelX} y1={midY} x2={spineX} y2={SPINE_Y} stroke={b.color} strokeWidth="8" opacity="0.12" />}

                {/* Branch label pill */}
                <rect
                  x={labelX - 38} y={b.side === "top" ? midY - 24 : midY + 4}
                  width={90} height={20} rx={10}
                  fill={bCauses.length > 0 || isActive ? b.color : "#f1f5f9"}
                  stroke={bCauses.length === 0 && !isActive ? "#cbd5e1" : "none"}
                  strokeWidth={1}
                />
                <text
                  x={labelX + 7} y={b.side === "top" ? midY - 10 : midY + 17}
                  textAnchor="middle"
                  fill={bCauses.length > 0 || isActive ? "white" : "#64748b"}
                  fontSize="9.5" fontWeight="700"
                >{b.id}</text>

                {/* Causes count badge */}
                {bCauses.length > 0 && (
                  <g>
                    <circle cx={labelX + 50} cy={b.side === "top" ? midY - 14 : midY + 14} r={10} fill="white" stroke={b.color} strokeWidth="2" />
                    <text x={labelX + 50} y={b.side === "top" ? midY - 10 : midY + 18}
                      textAnchor="middle" fill={b.color} fontSize="9" fontWeight="bold">{bCauses.length}</text>
                  </g>
                )}

                {/* "+" hint when empty */}
                {bCauses.length === 0 && !isActive && (
                  <text x={labelX + 7} y={b.side === "top" ? midY + 14 : midY - 4}
                    textAnchor="middle" fill="#94a3b8" fontSize="14">+</text>
                )}

                {/* Mini sub-cause ticks */}
                {bCauses.slice(0, 4).map((cause, ci) => {
                  const cx = labelX - 10 + ci * 18;
                  const cy1 = b.side === "top" ? midY + 5 : midY - 5;
                  const dy = b.side === "top" ? 18 : -18;
                  return (
                    <g key={cause.id}>
                      <line x1={cx} y1={cy1} x2={cx + 7} y2={cy1 + dy} stroke={b.color} strokeWidth="1.5" opacity="0.6" />
                      {cause.fiveWhys?.some(w => w) && (
                        <circle cx={cx + 7} cy={cy1 + dy} r={3} fill="#f59e0b" />
                      )}
                    </g>
                  );
                })}
                {bCauses.length > 4 && (
                  <text
                    x={labelX + 50}
                    y={b.side === "top" ? midY + 18 : midY - 10}
                    textAnchor="middle" fill={b.color} fontSize="8" opacity="0.7"
                  >+{bCauses.length - 4}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Summary accordion */}
      {totalCauses > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setSummaryOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700"
          >
            <span>Récapitulatif — {totalCauses} cause{totalCauses > 1 ? "s" : ""} sur {filledBranches} branche{filledBranches > 1 ? "s" : ""}</span>
            {summaryOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {summaryOpen && (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {BRANCHES.map(b => {
                const bc = branchCauses(b.id);
                if (bc.length === 0) return null;
                return (
                  <div key={b.id} className="rounded-lg border overflow-hidden" style={{ borderColor: b.color + "40" }}>
                    <div className="px-3 py-2 flex items-center gap-2" style={{ backgroundColor: b.color + "15" }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                      <span className="text-xs font-bold" style={{ color: b.color }}>{b.id}</span>
                      <span className="ml-auto text-xs font-medium text-slate-500">{bc.length}</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {bc.map((cause, ci) => {
                        const hasWhys = cause.fiveWhys?.some(w => w);
                        return (
                          <div key={cause.id} className="px-3 py-2 hover:bg-slate-50 group transition-colors">
                            <div className="flex items-start gap-2">
                              <span className="text-xs text-slate-400 font-mono mt-0.5 flex-shrink-0">{ci + 1}.</span>
                              <span className="text-xs text-slate-700 flex-1 leading-relaxed">{cause.text}</span>
                              <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => setActiveBranch(b.id)}
                                  title="Modifier dans la branche"
                                  className="text-slate-400 hover:text-slate-600 p-1 rounded"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            {hasWhys && (
                              <button
                                onClick={() => openFiveWhys(b.id, cause)}
                                className="mt-1.5 ml-4 flex items-center gap-1.5 text-[10px] bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-medium transition-colors"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                5 Pourquoi renseignés
                                {cause.fiveWhysConclusion && (
                                  <span className="text-amber-500 truncate max-w-[120px]">→ {cause.fiveWhysConclusion}</span>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Slide-in panel — branch causes */}
      {activeBranch && activeBranchData && (
        <div className="fixed inset-0 z-40" onClick={() => setActiveBranch(null)}>
          <div
            className="absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ backgroundColor: activeBranchData.color }}>
              <div>
                <h3 className="font-bold text-white text-base">{activeBranch}</h3>
                <p className="text-white/70 text-xs mt-0.5">
                  {branchCauses(activeBranch).length} cause{branchCauses(activeBranch).length !== 1 ? "s" : ""} identifiée{branchCauses(activeBranch).length !== 1 ? "s" : ""}
                </p>
              </div>
              <button onClick={() => setActiveBranch(null)} className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Causes list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {branchCauses(activeBranch).length === 0 && (
                <div className="text-center py-12 space-y-3">
                  <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: activeBranchData.color + "15" }}>
                    <Plus className="w-7 h-7" style={{ color: activeBranchData.color }} />
                  </div>
                  <p className="text-sm text-slate-600 font-semibold">Aucune cause pour "{activeBranch}"</p>
                  <p className="text-xs text-slate-400 max-w-[200px] mx-auto leading-relaxed">Ajoutez une première cause en utilisant le champ ci-dessous</p>
                </div>
              )}
              {branchCauses(activeBranch).map((cause, idx) => {
                const hasWhys = cause.fiveWhys?.some(w => w);
                return (
                  <div key={cause.id}
                    className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm hover:shadow transition-shadow">
                    {/* Cause header */}
                    <div className="flex items-start gap-3 px-4 py-3">
                      <span className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white mt-0.5"
                        style={{ backgroundColor: activeBranchData.color }}>
                        {idx + 1}
                      </span>
                      {editingId === cause.id ? (
                        <div className="flex-1 flex gap-2">
                          <Input
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") saveEdit(activeBranch); if (e.key === "Escape") setEditingId(null); }}
                            className="text-sm flex-1"
                            autoFocus
                          />
                          <Button size="sm" onClick={() => saveEdit(activeBranch)} className="flex-shrink-0" style={{ backgroundColor: activeBranchData.color }}>
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="flex-shrink-0">
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-800 font-medium flex-1 leading-relaxed">{cause.text}</p>
                      )}
                    </div>

                    {/* 5W preview if exists */}
                    {hasWhys && !editingId && (
                      <div className="mx-4 mb-2 rounded-lg bg-amber-50 border border-amber-200 overflow-hidden">
                        <div className="px-3 py-1.5 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                          <span className="text-xs font-semibold text-amber-700">
                            {cause.fiveWhys.filter(w => w).length} pourquoi renseigné{cause.fiveWhys.filter(w => w).length > 1 ? "s" : ""}
                          </span>
                        </div>
                        {cause.fiveWhys.filter(w => w).slice(0, 2).map((w, wi) => (
                          <div key={wi} className="px-3 pb-1 flex items-start gap-2">
                            <span className="text-[10px] text-amber-400 font-mono mt-0.5 flex-shrink-0">P{wi + 1}</span>
                            <span className="text-[10px] text-amber-700 leading-relaxed truncate">{w}</span>
                          </div>
                        ))}
                        {cause.fiveWhys.filter(w => w).length > 2 && (
                          <p className="px-3 pb-1.5 text-[10px] text-amber-500">+{cause.fiveWhys.filter(w => w).length - 2} autres…</p>
                        )}
                        {cause.fiveWhysConclusion && (
                          <div className="px-3 pb-2 pt-1 border-t border-amber-200 flex items-start gap-2">
                            <span className="text-[10px] text-amber-500 font-semibold mt-0.5 flex-shrink-0">→</span>
                            <span className="text-[10px] text-amber-800 font-semibold leading-relaxed">{cause.fiveWhysConclusion}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    {editingId !== cause.id && (
                      <div className="flex items-center gap-1 px-4 pb-3 border-t border-slate-100 pt-2">
                        <button onClick={() => startEdit(cause)}
                          className="text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-md flex items-center gap-1 transition-colors">
                          <Pencil className="w-3 h-3" /> Modifier
                        </button>
                        <button
                          onClick={() => openFiveWhys(activeBranch, cause)}
                          className={`text-xs px-2 py-1 rounded-md flex items-center gap-1 transition-colors font-medium ${
                            hasWhys
                              ? "text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200"
                              : "text-slate-500 hover:bg-slate-100"
                          }`}>
                          <Search className="w-3 h-3" />
                          {hasWhys ? "Éditer 5 Pourquoi" : "+ 5 Pourquoi"}
                        </button>
                        <button
                          onClick={() => {
                            if (hasWhys) { setConfirmDelete({ branchId: activeBranch, causeId: cause.id }); }
                            else { deleteCause(activeBranch, cause.id); }
                          }}
                          className="ml-auto text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-md flex items-center gap-1 transition-colors">
                          <Trash2 className="w-3 h-3" /> Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add cause footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-2">
              <p className="text-xs font-medium text-slate-600">Ajouter une cause</p>
              <div className="flex gap-2">
                <Input
                  value={causeInput}
                  onChange={e => { setCauseInput(e.target.value); setCauseError(""); }}
                  onKeyDown={e => e.key === "Enter" && addCause()}
                  placeholder="Décrire la cause… (Entrée pour valider)"
                  className={`text-sm ${causeError ? "border-red-400 focus-visible:ring-red-300" : ""}`}
                  autoFocus={branchCauses(activeBranch).length === 0}
                />
                <Button
                  onClick={addCause}
                  size="sm"
                  className="flex-shrink-0"
                  style={{ backgroundColor: activeBranchData.color }}
                  disabled={!causeInput.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {causeError && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{causeError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* 5 Whys panel */}
      {fiveWhysTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Analyse 5 Pourquoi</h3>
                <p className="text-xs text-slate-500 mt-0.5">Remontez à la cause racine</p>
              </div>
              <button onClick={() => setFiveWhysTarget(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-700">Cause initiale :</p>
              <p className="text-sm font-semibold text-amber-900">
                {branchCauses(fiveWhysTarget.branchId).find(c => c.id === fiveWhysTarget.causeId)?.text}
              </p>
            </div>
            <div className="space-y-3">
              {fiveWhysInputs.map((w, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-xs font-bold text-amber-700">{i + 1}</span>
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-slate-500 mb-1 block">Pourquoi {i + 1} {i === 0 ? "(cause directe)" : i === 4 ? "(cause racine)" : ""}</Label>
                    <Input
                      value={w}
                      onChange={e => { const arr = [...fiveWhysInputs]; arr[i] = e.target.value; setFiveWhysInputs(arr); }}
                      placeholder={`Parce que…`}
                      className="text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setFiveWhysTarget(null)}>Annuler</Button>
              <Button onClick={() => saveFiveWhys(fiveWhysTarget.branchId, fiveWhysTarget.causeId)}
                className="bg-amber-600 hover:bg-amber-700 text-white">
                <Check className="w-4 h-4 mr-1" /> Sauvegarder
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-slate-900">Confirmer la suppression</h3>
              <p className="text-sm text-slate-500 mt-1">Cette cause contient des 5 Pourquoi. La suppression est irréversible.</p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => setConfirmDelete(null)} className="flex-1">Annuler</Button>
              <Button variant="destructive" onClick={() => deleteCause(confirmDelete.branchId, confirmDelete.causeId)} className="flex-1">Supprimer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}