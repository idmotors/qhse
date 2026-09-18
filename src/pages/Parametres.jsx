import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/components/qhse/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, UserPlus, Shield, Download, Trash2 } from "lucide-react";
import { format } from "date-fns";
import JournalActivite from "@/components/qhse/JournalActivite";
import DeleteConfirmDialog from "@/components/qhse/DeleteConfirmDialog";
import ProcessusManager from "@/components/qhse/ProcessusManager";
import { logJournal } from "@/components/qhse/journalUtils";
import { getProcessusList, invalidateProcessusCache } from "@/components/qhse/processusUtils";
import { sendWelcomeEmail } from "@/components/qhse/welcomeEmail";
import FieldError from "@/components/qhse/FieldError";

export default function Parametres() {
  const { user, isQHSE, isAdminGestion, loading } = useUserRole();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("collaborateur");
  const [inviteProcessus, setInviteProcessus] = useState([]);
  const [inviteAttempted, setInviteAttempted] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: processusList = [] } = useQuery({
    queryKey: ["processus-list"],
    queryFn: getProcessusList,
  });

  const setUserProcessus = async (userEmail, userId, newProcessusNoms) => {
    await Promise.all((processusList || []).map(p => {
      const has = (p.responsableEmails || []).includes(userEmail);
      const wants = newProcessusNoms.includes(p.nom);
      if (has === wants) return null;
      let emails = (p.responsableEmails || []).filter(e => e !== userEmail);
      let ids = (p.responsableIds || []).filter(i => i !== userId);
      if (wants) { emails.push(userEmail); if (userId) ids.push(userId); }
      return base44.entities.Processus.update(p.id, {
        responsableEmails: [...new Set(emails)],
        responsableIds: [...new Set(ids)],
      });
    }).filter(Boolean));
    invalidateProcessusCache();
    queryClient.invalidateQueries({ queryKey: ["processus-list"] });
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    const base44Role = inviteRole === "qhse" || inviteRole === "admin_gestion" ? "admin" : "user";
    await base44.users.inviteUser(inviteEmail, base44Role);
    // If user exists, update their role
    const existing = users.find(u => u.email === inviteEmail);
    if (existing) {
      await base44.entities.User.update(existing.id, { role: inviteRole });
    }
    // Rattachement aux processus sélectionnés (email + id si déjà connu)
    if (inviteProcessus.length > 0) {
      await setUserProcessus(inviteEmail, existing?.id, inviteProcessus);
    }
    // Email de bienvenue personnalisé via Brevo — accompagne l'email d'activation
    // officiel pour le rendre reconnaissable (ne bloque jamais l'invitation).
    let bienvenue = "envoyé";
    try {
      await sendWelcomeEmail({ to: inviteEmail, role: inviteRole, processus: inviteProcessus });
    } catch (e) {
      bienvenue = "échec de l'envoi";
      console.warn("[Parametres] Échec de l'email de bienvenue Brevo", String(e?.message || e));
    }
    logJournal({ user, type: "Invitation utilisateur", element: inviteEmail, details: `Rôle : ${inviteRole} · Processus : ${inviteProcessus.join(", ") || "—"} · Email de bienvenue : ${bienvenue}` });
    setInviteEmail("");
    setInviteProcessus([]);
    queryClient.invalidateQueries({ queryKey: ["all-users"] });
    setInviting(false);
  };

  const handleRoleChange = async (userId, newRole) => {
    await base44.entities.User.update(userId, { role: newRole });
    const target = users.find(u => u.id === userId);
    logJournal({ user, type: "Modification droits", element: target?.email || target?.full_name || "", details: `Nouveau rôle : ${newRole}` });
    queryClient.invalidateQueries({ queryKey: ["all-users"] });
  };

  // Suppression d'un compte utilisateur (interdit pour soi-même et pour le Propriétaire,
  // déjà masqués dans la table) — le backend nettoie les rattachements processus
  // puis supprime le compte et révoque l'accès.
  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await base44.functions.invoke("deleteUser", { userId: deleteTarget.id });
      logJournal({
        user,
        type: "Suppression utilisateur",
        element: deleteTarget.email || deleteTarget.full_name || "",
        details: `Compte supprimé · Nom : ${deleteTarget.full_name || "—"} · Email : ${deleteTarget.email || "—"} · Rattachements processus nettoyés : ${res?.data?.processusNettoyes ?? 0}`,
      });
      invalidateProcessusCache();
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      queryClient.invalidateQueries({ queryKey: ["processus-list"] });
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportUsers = () => {
    const now = format(new Date(), "yyyy-MM-dd_HH-mm");
    const header = `Export des utilisateurs - ${format(new Date(), "dd/MM/yyyy à HH:mm")}\nNom;Email;Profil\n`;
    const rows = users.map(u => `${(u.full_name || "").replace(/;/g, ",")};${u.email || ""};${u.role || "collaborateur"}`).join("\n");
    const csv = "\uFEFF" + header + rows;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `utilisateurs_droits_${now}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isQHSE && !isAdminGestion) {
    return <div className="text-center py-20 text-slate-500">Accès réservé à l'équipe QHSE et aux administrateurs</div>;
  }

  const roleColors = {
    qhse: "bg-violet-100 text-violet-800",
    direction: "bg-blue-100 text-blue-800",
    collaborateur: "bg-slate-100 text-slate-700",
    admin_gestion: "bg-amber-100 text-amber-800",
    admin: "bg-slate-200 text-slate-700",
    user: "bg-slate-100 text-slate-700",
  };

  const roleLabel = (r) => r === "admin" ? "Propriétaire" : r === "admin_gestion" ? "Administrateur" : r === "user" ? "Collaborateur" : (r || "collaborateur");
  const APP_ROLES = ["collaborateur", "admin_gestion", "qhse", "direction"];

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
        <p className="text-sm text-slate-500 mt-1">Gestion des utilisateurs et des accès</p>
      </div>

      {/* Invite */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <UserPlus className="w-4 h-4" /> Inviter un utilisateur
        </h2>
        <div className="flex gap-3">
          <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@exemple.com" className="flex-1" />
          <Select value={inviteRole} onValueChange={setInviteRole}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="collaborateur">Collaborateur</SelectItem>
              <SelectItem value="admin_gestion">Administrateur</SelectItem>
              <SelectItem value="qhse">QHSE</SelectItem>
              <SelectItem value="direction">Direction</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => { if (!inviteEmail) { setInviteAttempted(true); return; } handleInvite(); }} disabled={inviting} className="bg-blue-600 hover:bg-blue-700">
            {inviting ? "..." : "Inviter"}
          </Button>
        </div>
        <FieldError show={inviteAttempted && !inviteEmail} message="Veuillez saisir l'adresse email de l'utilisateur à inviter." />
        <div className="mt-4">
          <Label className="text-xs font-medium text-slate-600">Processus rattaché(s) — pilote du processus</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {(processusList.length ? processusList.map(p => p.nom) : []).map(nom => {
              const active = inviteProcessus.includes(nom);
              return (
                <button
                  key={nom}
                  type="button"
                  onClick={() => setInviteProcessus(prev => active ? prev.filter(p => p !== nom) : [...prev, nom])}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    active ? "bg-[#363886] border-[#363886] text-white" : "bg-slate-50 border-slate-200 text-slate-600 hover:border-[#363886]"
                  }`}
                >
                  {nom}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Users list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4" /> Utilisateurs ({users.length})
          </h2>
          <Button variant="outline" size="sm" onClick={handleExportUsers}>
            <Download className="w-4 h-4 mr-1" /> Exporter
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="font-semibold">Nom</TableHead>
              <TableHead className="font-semibold">Email</TableHead>
              <TableHead className="font-semibold">Profil</TableHead>
              <TableHead className="font-semibold">Processus</TableHead>
              <TableHead className="font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => {
              const attached = (processusList || []).filter(p => (p.responsableEmails || []).includes(u.email)).map(p => p.nom);
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell className="text-slate-500">{u.email}</TableCell>
                  <TableCell>
                    <Badge className={`${roleColors[u.role] || roleColors.collaborateur} font-medium capitalize`}>
                      {roleLabel(u.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[280px]">
                      {(processusList || []).map(p => {
                        const active = attached.includes(p.nom);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            title={active ? "Détacher" : "Rattacher"}
                            onClick={() => setUserProcessus(u.email, u.id, active ? attached.filter(n => n !== p.nom) : [...attached, p.nom])}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                              active ? "bg-[#363886] border-[#363886] text-white" : "bg-slate-50 border-slate-200 text-slate-400 hover:border-[#363886]"
                            }`}
                          >
                            {p.nom}
                          </button>
                        );
                      })}
                      {processusList.length === 0 && <span className="text-xs text-slate-400">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.role === "admin" ? (
                      <span className="text-xs text-slate-400 italic">Propriétaire (non modifiable)</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Select value={APP_ROLES.includes(u.role) ? u.role : "collaborateur"} onValueChange={v => handleRoleChange(u.id, v)}>
                          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="collaborateur">Collaborateur</SelectItem>
                            <SelectItem value="admin_gestion">Administrateur</SelectItem>
                            <SelectItem value="qhse">QHSE</SelectItem>
                            <SelectItem value="direction">Direction</SelectItem>
                          </SelectContent>
                        </Select>
                        {u.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title="Supprimer cet utilisateur"
                            onClick={() => setDeleteTarget(u)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Gestion des processus */}
      <ProcessusManager user={user} />

      {/* Journal d'activité */}
      <JournalActivite />

      {/* Confirmation de suppression d'un utilisateur */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        title="Supprimer cet utilisateur ?"
        description={`Le compte de ${deleteTarget?.full_name || "—"} (${deleteTarget?.email || "—"}) sera définitivement supprimé et son accès à l'application révoqué. Il sera retiré des processus où il est pilote ou membre. Les NC et AC déjà créées seront conservées (traçabilité). Cette action est irréversible.`}
        loading={deleting}
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}