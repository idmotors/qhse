import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, FileText, ClipboardList, AlertTriangle, ListChecks,
  Bell, Settings, ChevronDown, ChevronRight, LogOut, Shield, ScrollText, History
} from "lucide-react";
import { useUserRole } from "./useUserRole";
import { useNcATraiter } from "./useNcATraiter";
import { useAcATraiter } from "./useAcATraiter";
import { useMesProcessus } from "./useMesProcessus";

export default function Sidebar() {
  const location = useLocation();
  const { user, role, isQHSE, isDirection, isAdminGestion, loading } = useUserRole();
  const [ticketsOpen, setTicketsOpen] = useState(true);
  const [notifCount, setNotifCount] = useState(0);

  // NC à traiter : NC assignées à un processus piloté par l'utilisateur (hors celles qu'il a déclarées)
  const { ncs: ncsATraiter, nbATraiter } = useNcATraiter(user, !loading);
  const { nbATraiter: nbACATraiter } = useAcATraiter(user, !loading);
  // Processus pilotés par l'utilisateur (liste des pilotes/responsables uniquement)
  const { mesProcessus } = useMesProcessus(user, !loading);
  const isPiloteProcessus = mesProcessus.length > 0 || ncsATraiter.length > 0 || nbACATraiter > 0;

  // Charge le compteur initial
  const loadCount = async (currentUser) => {
    if (!currentUser) return;
    // Les QHSE reçoivent aussi les notifs broadcast "qhse-broadcast"
    const personal = await base44.entities.Notification.filter({ destinataire: currentUser.email, lu: false }).catch(() => []);
    let broadcast = [];
    if (currentUser.role === "qhse") {
      broadcast = await base44.entities.Notification.filter({ destinataire: "qhse-broadcast", lu: false }).catch(() => []);
    }
    setNotifCount(personal.length + broadcast.length);
  };

  useEffect(() => {
    if (!user) return;
    loadCount(user);
  }, [user, location.pathname]);

  // Temps réel : abonnement aux nouvelles notifications
  useEffect(() => {
    if (!user) return;
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      if (event.type === "create") {
        const dest = event.data?.destinataire;
        const isForMe = dest === user.email;
        const isForQhseTeam = dest === "qhse-broadcast" && user.role === "qhse";
        if (isForMe || isForQhseTeam) {
          setNotifCount(prev => prev + 1);
        }
      }
      if (event.type === "update" && event.data?.lu === true) {
        // Recharger proprement si une notif est marquée lue
        loadCount(user);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const isActive = (path) => location.pathname === path;

  const navItem = (path, icon, label, badge) => (
    <Link
      to={path}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 ${
        isActive(path)
          ? "bg-amber-500 text-white font-semibold shadow-md"
          : "text-white/80 hover:bg-indigo-700 hover:text-white"
      }`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
          {badge}
        </span>
      )}
    </Link>
  );

  return (
    <aside className="w-64 h-screen bg-indigo-900 flex flex-col fixed left-0 top-0 z-40 shadow-xl">
      {/* Logo */}
      <div className="p-6 border-b border-indigo-800">
        <div className="flex items-center gap-3">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69b3c0ea23c840dd58dcc9cd/164b1881b_LOGOOOOO.png" 
            alt="IDRental Logo" 
            className="w-12 h-12 rounded-xl object-cover"
          />
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">IDR QHSE</h1>
            <p className="text-xs text-indigo-300">Portail Qualité</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {isAdminGestion ? (
          <>
            {navItem("/Parametres", <Settings className="w-4 h-4" />, "Paramètres")}
            {navItem("/Journal", <ScrollText className="w-4 h-4" />, "Journal")}
          </>
        ) : (
          <>
            {navItem("/Dashboard", <LayoutDashboard className="w-4 h-4" />, "Tableau de bord")}

            {/* Mes tickets - collapsible */}
            <button
              onClick={() => setTicketsOpen(!ticketsOpen)}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-white/80 hover:bg-indigo-700 hover:text-white w-full transition-all"
            >
              <FileText className="w-4 h-4" />
              <span className="flex-1 text-left">Mes tickets</span>
              {ticketsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {ticketsOpen && (
              <div className="ml-4 space-y-0.5">
                {navItem("/MesNC", <AlertTriangle className="w-4 h-4" />, "Mes NC")}
                {isPiloteProcessus &&
                  navItem("/NCTraiter", <ListChecks className="w-4 h-4" />, "NC à traiter", nbATraiter)}
                {navItem("/MesAC", <ClipboardList className="w-4 h-4" />, "Mes AC")}
                {isPiloteProcessus &&
                  navItem("/ACTraiter", <ListChecks className="w-4 h-4" />, "AC à traiter", nbACATraiter)}
              </div>
            )}

            {(isQHSE || isDirection) &&
              navItem("/TraitementNC", <FileText className="w-4 h-4" />, "Traitement des NC")}

            {(isQHSE || isDirection) &&
              navItem("/TraitementAC", <ClipboardList className="w-4 h-4" />, "Traitement des AC")}

            {navItem("/MonProcessus", <History className="w-4 h-4" />, "Historiques")}

            {navItem("/Notifications", <Bell className="w-4 h-4" />, "Notifications", notifCount)}

            {isQHSE && navItem("/Parametres", <Settings className="w-4 h-4" />, "Paramètres")}
          </>
        )}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-indigo-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
            {user?.full_name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.full_name || "Utilisateur"}</p>
            <p className="text-xs text-indigo-300 capitalize">{role === "admin_gestion" ? "Administrateur" : role}</p>
          </div>
        </div>
        <button
          onClick={() => base44.auth.logout()}
          className="flex items-center gap-2 text-xs text-indigo-300 hover:text-amber-400 transition-colors w-full"
        >
          <LogOut className="w-3.5 h-3.5" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}