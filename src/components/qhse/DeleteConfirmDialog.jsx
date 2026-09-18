import React from "react";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle } from "lucide-react";

/**
 * Confirmation dialog for destructive delete actions.
 * Usage: wrap with a portal-style overlay, controlled by `open`.
 */
export default function DeleteConfirmDialog({ open, title, description, onConfirm, onCancel, loading }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 max-w-sm w-full mx-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        </div>
        <p className="text-sm text-slate-500">{description}</p>
        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
            Annuler
          </Button>
          <Button
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            onClick={onConfirm}
            disabled={loading}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            {loading ? "Suppression..." : "Supprimer"}
          </Button>
        </div>
      </div>
    </div>
  );
}