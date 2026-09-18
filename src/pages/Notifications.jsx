import React, { useState, useMemo, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/components/qhse/useUserRole";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Bell, Check, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { parseStoredDate } from "@/components/qhse/dateFormat";

const TYPE_COLORS = {
  "Nouvelle NC": "bg-blue-500",
  "Retard": "bg-red-500",
  "Clôture": "bg-green-500",
  "Efficacité": "bg-yellow-500",
  "Assignation": "bg-violet-500",
  "Relance": "bg-orange-500",
  "Changement statut": "bg-slate-500",
  "Nouvelle AC": "bg-teal-500",
  "Action AC": "bg-indigo-500",
  "Retard AC": "bg-rose-500",
  "Clôture AC": "bg-emerald-500",
};

export default function Notifications() {
  const { user, loading: userLoading } = useUserRole();
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState("all");
  const [filterRead, setFilterRead] = useState("all");

  const notifQueryKey = ["notifications", user?.email];

  const { data: personalNotifs = [], isLoading: loadingPersonal } = useQuery({
    queryKey: [...notifQueryKey, "personal"],
    queryFn: () => base44.entities.Notification.filter({ destinataire: user?.email }, "-created_date", 200),
    enabled: !!user?.email,
  });

  const { data: broadcastNotifs = [], isLoading: loadingBroadcast } = useQuery({
    queryKey: [...notifQueryKey, "broadcast"],
    queryFn: () => base44.entities.Notification.filter({ destinataire: "qhse-broadcast" }, "-created_date", 200),
    enabled: !!user?.email && user?.role === "qhse",
  });

  // Fusionner et trier par date décroissante
  const notifications = React.useMemo(() => {
    const all = [...personalNotifs, ...broadcastNotifs];
    // Dédupliquer par id
    const seen = new Set();
    return all.filter(n => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    }).sort((a, b) => parseStoredDate(b.created_date) - parseStoredDate(a.created_date));
  }, [personalNotifs, broadcastNotifs]);

  const isLoading = loadingPersonal || loadingBroadcast;



  const handleMarkRead = async (id) => {
    await base44.entities.Notification.update(id, { lu: true });
    queryClient.invalidateQueries({ queryKey: notifQueryKey });
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter(n => !n.lu);
    await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { lu: true })));
    queryClient.invalidateQueries({ queryKey: notifQueryKey });
  };

  const handleDelete = async (id) => {
    await base44.entities.Notification.delete(id);
    queryClient.invalidateQueries({ queryKey: notifQueryKey });
  };



  const filtered = notifications.filter(n => {
    if (filterRead === "unread" && n.lu) return false;
    if (filterType !== "all" && n.type !== filterType) return false;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.lu).length;

  if (userLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">{unreadCount} non lue{unreadCount > 1 ? "s" : ""}</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <Check className="w-3.5 h-3.5 mr-1" /> Tout marquer comme lu
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {["all", "unread"].map(f => (
          <button key={f} onClick={() => setFilterRead(f)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterRead === f ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}
          >
            {f === "all" ? "Toutes" : "Non lues"}
          </button>
        ))}
        <div className="w-px bg-slate-200 mx-1" />
        {["all", "Retard", "Nouvelle NC", "Clôture", "Efficacité", "Assignation", "Nouvelle AC", "Action AC", "Retard AC", "Clôture AC"].map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterType === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}
          >
            {t === "all" ? "Tous types" : t}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Aucune notification</p>
          </div>
        ) : (
          filtered.map(notif => (
            <div key={notif.id}
              onClick={() => { if (!notif.lu) handleMarkRead(notif.id); }}
              className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${!notif.lu ? "bg-blue-50/50 border-blue-100 cursor-pointer" : "bg-white border-slate-100"}`}
            >
              {/* Unread dot */}
              <div className="flex-shrink-0 mt-2">
                {!notif.lu
                  ? <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  : <div className={`w-2 h-2 rounded-full ${TYPE_COLORS[notif.type] || "bg-slate-300"}`} />
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full text-white ${TYPE_COLORS[notif.type] || "bg-slate-400"}`}>
                    {notif.type}
                  </span>
                  <span className="text-xs text-slate-400">
                    {notif.created_date ? format(parseStoredDate(notif.created_date), "dd MMM yyyy HH:mm", { locale: fr }) : ""}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-800 mt-1">{notif.titre}</p>
                <p className="text-xs text-slate-500 mt-0.5">{notif.message}</p>

                <div className="flex items-center gap-3 mt-2">
                  {(notif.lienType === "nc" || notif.lienType === "ac") && notif.lienId && (
                    <Link
                      to={`/${notif.lienType === "ac" ? "ACDetail" : "NCDetail"}?id=${notif.lienId}`}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Voir {notif.lienType === "ac" ? "l'AC" : "la NC"}
                    </Link>
                  )}
                  {!notif.lu && (
                    <button onClick={(e) => { e.stopPropagation(); handleMarkRead(notif.id); }} className="text-xs text-slate-400 hover:text-blue-600">
                      Marquer comme lu
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(notif.id); }}
                className="flex-shrink-0 text-slate-200 hover:text-red-500 transition-colors ml-2 mt-1"
                title="Supprimer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}