import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export default function NCClotureesCard({ nbDelai, nbRetard }) {
  const total = nbDelai + nbRetard;
  const percentDelai = total > 0 ? Math.round((nbDelai / total) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">NC Clôturées</h3>
      
      <div className="space-y-4">
        {/* Clôturées dans les délais */}
        <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-green-700">Clôturées dans les délais</p>
              <p className="text-2xl font-bold text-green-900">{nbDelai}</p>
            </div>
          </div>
        </div>

        {/* Clôturées en retard */}
        <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-red-700">Clôturées en retard</p>
              <p className="text-2xl font-bold text-red-900">{nbRetard}</p>
            </div>
          </div>
        </div>

        {/* Pourcentage */}
        {total > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <div className="flex justify-between items-center text-xs text-slate-600 mb-1">
              <span>Taux de respect des délais</span>
              <span className="font-semibold">{percentDelai}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${percentDelai}%` }}
              />
            </div>
          </div>
        )}

        {total === 0 && (
          <p className="text-xs text-slate-400 text-center pt-2">
            Aucune NC clôturée avec échéance QHSE renseignée
          </p>
        )}
      </div>
    </div>
  );
}