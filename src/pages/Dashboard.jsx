import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useUserRole } from "@/components/qhse/useUserRole";
import KPICard from "@/components/qhse/KPICard";
import StatusBadge from "@/components/qhse/StatusBadge";
import NCKanban from "@/components/qhse/NCKanban";
import ActionsCalendar from "@/components/qhse/ActionsCalendar";
import ChartCard from "@/components/qhse/dashboard/ChartCard";
import StatutDonut from "@/components/qhse/dashboard/StatutDonut";
import SourceBar from "@/components/qhse/dashboard/SourceBar";
import DeptBar from "@/components/qhse/dashboard/DeptBar";
import MonthlyLine from "@/components/qhse/dashboard/MonthlyLine";
import { Link, Navigate } from "react-router-dom";
import {
  AlertTriangle, CheckCircle2, Clock, FileText, TrendingUp,
  Activity, LayoutDashboard, Kanban, CalendarDays,
  ListChecks, PieChart as PieChartIcon, BarChart3, Building2, LineChart as LineChartIcon,
  ClipboardList
} from "lucide-react";
import { format, differenceInDays, startOfDay } from "date-fns";
import { isActionLate, isActionDone } from "@/components/qhse/actionUtils";
import { isActionLateAC } from "@/components/qhse/acActionUtils";
import DeclareNCButton from "@/components/qhse/DeclareNCButton";
import DeclareACButton from "@/components/qhse/DeclareACButton";

const VIEW_TABS = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "kanban", label: "Kanban NC", icon: Kanban },
  { id: "calendar", label: "Calendrier", icon: CalendarDays },
];

export default function Dashboard() {
  const { user, role, isCollaborateur, isQHSE, isAdminGestion } = useUserRole();
  const [view, setView] = useState("dashboard"); // "dashboard" | "kanban"

  const { data: ncs = [], isLoading } = useQuery({
    queryKey: ["ncs-dashboard"],
    queryFn: () => base44.entities.NonConformite.list("-created_date", 200),
  });

  const { data: actions = [] } = useQuery({
    queryKey: ["actions-dashboard"],
    queryFn: () => base44.entities.Action.list("-created_date", 500),
  });

  const { data: acs = [] } = useQuery({
    queryKey: ["ac-dashboard"],
    queryFn: () => base44.entities.AmeliorationContinue.list("-created_date", 200),
  });

  const { data: actionsAC = [] } = useQuery({
    queryKey: ["actions-ac-dashboard"],
    queryFn: () => base44.entities.ActionAmelioration.list("-created_date", 500),
  });

  // Filter for collaborateur
  const filteredNCs = useMemo(() => {
    if (isCollaborateur && user) {
      return ncs.filter(nc => nc.initiateurEmail === user.email);
    }
    return ncs;
  }, [ncs, isCollaborateur, user]);

  const myActions = useMemo(() => {
    if (!user) return [];
    return actions.filter(a => a.responsable === user.email && !isActionDone(a));
  }, [actions, user]);

  const filteredACs = useMemo(() => {
    if (isCollaborateur && user) {
      return acs.filter(ac => ac.initiateurEmail === user.email);
    }
    return acs;
  }, [acs, isCollaborateur, user]);

  const myAcActions = useMemo(() => {
    if (!user) return [];
    return actionsAC.filter(a => (a.responsablesProcessus || []).includes(user.email) && !["Réalisée", "Abandonnée"].includes(a.statut));
  }, [actionsAC, user]);

  // KPIs
  const totalNC = filteredNCs.length;
  const ouvertes = filteredNCs.filter(nc => nc.statut !== "Clôturée").length;
  const enRetard = filteredNCs.filter(nc => nc.statut === "En retard").length;
  const cloturees = filteredNCs.filter(nc => nc.statut === "Clôturée").length;
  const clotureesDansDelai = filteredNCs.filter(nc => nc.statut === "Clôturée" && nc.clotureDansDelai).length;
  const tauxCloture = cloturees > 0 ? Math.round((clotureesDansDelai / cloturees) * 100) : 0;

  const delaiMoyen = useMemo(() => {
    const closed = filteredNCs.filter(nc => nc.delaiTraitementEffectif);
    if (closed.length === 0) return 0;
    return Math.round(closed.reduce((s, nc) => s + nc.delaiTraitementEffectif, 0) / closed.length);
  }, [filteredNCs]);

  // Charts data
  const statutData = useMemo(() => {
    const counts = {};
    filteredNCs.forEach(nc => {
      counts[nc.statut] = (counts[nc.statut] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredNCs]);

  const sourceData = useMemo(() => {
    const counts = {};
    filteredNCs.forEach(nc => {
      if (nc.source) counts[nc.source] = (counts[nc.source] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredNCs]);

  const deptData = useMemo(() => {
    const counts = {};
    filteredNCs.forEach(nc => {
      if (nc.departement) counts[nc.departement] = (counts[nc.departement] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredNCs]);

  const monthlyData = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = format(d, "yyyy-MM");
      const label = format(d, "MMM yy");
      const opened = filteredNCs.filter(nc => nc.created_date && format(new Date(nc.created_date), "yyyy-MM") === key).length;
      const closed = filteredNCs.filter(nc => nc.dateCloture && format(new Date(nc.dateCloture), "yyyy-MM") === key).length;
      months.push({ name: label, Ouvertes: opened, Clôturées: closed });
    }
    return months;
  }, [filteredNCs]);

  // === Amélioration continue (AC) : KPIs et graphiques ===
  const totalAC = filteredACs.length;
  const acEnCours = filteredACs.filter(ac => ["À traiter", "En cours"].includes(ac.statut)).length;
  const acActionsRetard = actionsAC.filter(a => isActionLateAC(a)).length;
  const acCloturees = filteredACs.filter(ac => ac.statut === "Clôturée").length;
  const acClotureesAuto = filteredACs.filter(ac => ac.statut === "Clôturée" && !ac.motifCloture).length;
  const tauxClotureAutoAC = acCloturees > 0 ? Math.round((acClotureesAuto / acCloturees) * 100) : 0;

  const acStatutData = useMemo(() => {
    const counts = {};
    filteredACs.forEach(ac => { counts[ac.statut] = (counts[ac.statut] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredACs]);

  const acSourceData = useMemo(() => {
    const counts = {};
    filteredACs.forEach(ac => { if (ac.source) counts[ac.source] = (counts[ac.source] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredACs]);

  const acProcData = useMemo(() => {
    const counts = {};
    filteredACs.forEach(ac => { if (ac.processusInitiateur) counts[ac.processusInitiateur] = (counts[ac.processusInitiateur] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredACs]);

  const acMonthlyData = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = format(d, "yyyy-MM");
      const label = format(d, "MMM yy");
      const opened = filteredACs.filter(ac => ac.created_date && format(new Date(ac.created_date), "yyyy-MM") === key).length;
      const closed = filteredACs.filter(ac => ac.dateCloture && format(new Date(ac.dateCloture), "yyyy-MM") === key).length;
      months.push({ name: label, Ouvertes: opened, Clôturées: closed });
    }
    return months;
  }, [filteredACs]);

  // Le profil Administrateur (gestion membres) n'a pas accès au tableau de bord
  if (isAdminGestion) {
    return <Navigate to="/Parametres" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 sm:pb-24">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tableau de bord</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isCollaborateur ? "Vue personnelle de vos NC et actions" : "Vue consolidée des Non-Conformités et améliorations continues"}
          </p>
        </div>
        {!isCollaborateur && (
          <div className="flex items-center gap-1 bg-slate-100/90 rounded-xl p-1 shadow-inner">
            {VIEW_TABS.map(({ id, label, icon: TabIcon }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${view === id ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
              >
                <TabIcon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Vue Kanban */}
      {view === "kanban" && !isCollaborateur && (
        <NCKanban ncs={filteredNCs} isQHSE={isQHSE} />
      )}

      {/* Vue Calendrier */}
      {view === "calendar" && !isCollaborateur && (
        <ActionsCalendar actions={actions} ncs={filteredNCs} />
      )}

      {/* Vue Dashboard */}
      {(view === "dashboard" || isCollaborateur) && (
      <div className="space-y-8">

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <KPICard title="NC Totales" value={totalNC} icon={FileText} color="blue" />
        <KPICard title="NC Ouvertes" value={ouvertes} icon={Activity} color="orange" />
        <KPICard title="En retard" value={enRetard} icon={AlertTriangle} color="red" />
        <KPICard title="Clôturées" value={cloturees} subtitle={`${tauxCloture}% dans les délais`} icon={CheckCircle2} color="green" />
      </div>

      {/* KPI Cards : Amélioration continue */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <KPICard title="AC Totales" value={totalAC} icon={ClipboardList} color="blue" />
        <KPICard title="AC en cours" value={acEnCours} icon={Activity} color="orange" />
        <KPICard title="Actions AC en retard" value={acActionsRetard} icon={AlertTriangle} color="red" />
        <KPICard title="AC Clôturées" value={acCloturees} subtitle={`${tauxClotureAutoAC}% clôturées automatiquement`} icon={CheckCircle2} color="green" />
      </div>

      {isCollaborateur && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          {/* Mes actions en cours */}
          <ChartCard title="Mes actions en cours" icon={ListChecks}>
            {myActions.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune action en cours</p>
            ) : (
              <div className="space-y-3">
                {myActions.map(action => {
                  const isLate = isActionLate(action);
                  const isNear = !isLate && action.dateFinPrevue && differenceInDays(startOfDay(new Date(action.dateFinPrevue)), startOfDay(new Date())) <= 7 && differenceInDays(startOfDay(new Date(action.dateFinPrevue)), startOfDay(new Date())) >= 0;
                  return (
                    <div key={action.id} className={`p-3 rounded-lg border ${isLate ? "bg-red-50 border-red-200" : isNear ? "bg-orange-50 border-orange-200" : "bg-slate-50 border-slate-100"}`}>
                      <p className="text-sm font-medium text-slate-800">{action.description}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <StatusBadge statut={isLate ? "En retard" : action.statut} type="action" />
                        {action.dateFinPrevue && (
                          <span className="text-xs text-slate-500">Échéance : {format(new Date(action.dateFinPrevue), "dd/MM/yyyy")}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ChartCard>

          {/* Mes NC déclarées */}
          <ChartCard title="Mes NC déclarées" icon={FileText}>
            {filteredNCs.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune NC déclarée</p>
            ) : (
              <div className="space-y-3">
                {filteredNCs.slice(0, 5).map(nc => (
                  <Link to={`/NCDetail?id=${nc.id}`} key={nc.id} className="block p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-blue-300 hover:bg-blue-50/50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800 flex-shrink-0">{nc.numero}</span>
                      <StatusBadge statut={nc.statut} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1 truncate">{nc.ecartConstate}</p>
                  </Link>
                ))}
              </div>
            )}
          </ChartCard>

          {/* Mes actions AC en cours */}
          <ChartCard title="Mes actions AC en cours" icon={ListChecks}>
            {myAcActions.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune action AC en cours</p>
            ) : (
              <div className="space-y-3">
                {myAcActions.map(action => {
                  const isLateAC = isActionLateAC(action);
                  const isNearAC = !isLateAC && action.dateFinPrevue && differenceInDays(startOfDay(new Date(action.dateFinPrevue)), startOfDay(new Date())) <= 7 && differenceInDays(startOfDay(new Date(action.dateFinPrevue)), startOfDay(new Date())) >= 0;
                  return (
                    <Link to={`/ACDetail?id=${action.acId}`} key={action.id} className={`block p-3 rounded-lg border transition-colors ${isLateAC ? "bg-red-50 border-red-200" : isNearAC ? "bg-orange-50 border-orange-200" : "bg-slate-50 border-slate-100"} hover:border-blue-300`}>
                      <p className="text-sm font-medium text-slate-800">{action.description}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {isLateAC ? (
                          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">En retard</span>
                        ) : (
                          <StatusBadge statut={action.statut} type="action-ac" />
                        )}
                        {action.dateFinPrevue && (
                          <span className="text-xs text-slate-500">Échéance : {format(new Date(action.dateFinPrevue), "dd/MM/yyyy")}</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </ChartCard>

          {/* Mes AC déclarées */}
          <ChartCard title="Mes AC déclarées" icon={ClipboardList}>
            {filteredACs.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune AC déclarée</p>
            ) : (
              <div className="space-y-3">
                {filteredACs.slice(0, 5).map(ac => (
                  <Link to={`/ACDetail?id=${ac.id}`} key={ac.id} className="block p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-blue-300 hover:bg-blue-50/50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800 flex-shrink-0">{ac.numero}</span>
                      <StatusBadge statut={ac.statut} type="ac" />
                    </div>
                    <p className="text-xs text-slate-500 mt-1 truncate">{ac.constat}</p>
                  </Link>
                ))}
              </div>
            )}
          </ChartCard>
        </div>
      )}

      {/* Charts - QHSE & Direction */}
      {!isCollaborateur && (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          <ChartCard title="Répartition par statut" icon={PieChartIcon}>
            <StatutDonut data={statutData} />
          </ChartCard>

          <ChartCard title="Répartition par source" icon={BarChart3}>
            <SourceBar data={sourceData} />
          </ChartCard>

          <ChartCard title="Répartition par département" icon={Building2}>
            <DeptBar data={deptData} />
          </ChartCard>

          <ChartCard title="Évolution mensuelle" subtitle="12 derniers mois" icon={LineChartIcon}>
            <MonthlyLine data={monthlyData} />
          </ChartCard>
        </div>

        {/* Graphiques : Amélioration continue */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          <ChartCard title="AC : Répartition par statut" icon={PieChartIcon}>
            <StatutDonut data={acStatutData} />
          </ChartCard>

          <ChartCard title="AC : Répartition par source" icon={BarChart3}>
            <SourceBar data={acSourceData} />
          </ChartCard>

          <ChartCard title="AC : Répartition par processus initiateur" icon={Building2}>
            <DeptBar data={acProcData} />
          </ChartCard>

          <ChartCard title="AC : Évolution mensuelle" subtitle="12 derniers mois" icon={LineChartIcon}>
            <MonthlyLine data={acMonthlyData} />
          </ChartCard>
        </div>
        </>
      )}

      {/* Délai moyen */}
      {!isCollaborateur && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <KPICard title="Délai moyen de traitement" value={`${delaiMoyen}j`} icon={Clock} color="violet" />
          <KPICard title="Taux de clôture dans les délais" value={`${tauxCloture}%`} icon={TrendingUp} color="green" />
        </div>
      )}

      </div>
      )}

      {/* Boutons flottants : déclarer une NC / une AC */}
      <DeclareNCButton />
      <DeclareACButton />
    </div>
  );
}