import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send } from "lucide-react";
import { getProcessusList, getHseEmails } from "@/components/qhse/processusUtils";
import CommentaireList from "./CommentaireList";

/**
 * Fil de commentaires d'une fiche NC ou AC.
 * Notification in-app uniquement (aucun email) : initiateur + responsables du
 * processus + équipe QHSE, hors l'auteur du commentaire.
 */
export default function CommentairesSection({ entityType, entityId, numero, initiateurEmail, responsablesProcessus, user }) {
  const queryClient = useQueryClient();
  const [texte, setTexte] = useState("");
  const [sending, setSending] = useState(false);

  const { data: commentaires = [], isLoading } = useQuery({
    queryKey: ["commentaires", entityType, entityId],
    queryFn: () => base44.entities.Commentaire.filter({ entityType, entityId }, "created_date"),
    enabled: !!entityId,
  });

  const handleSend = async () => {
    const value = texte.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await base44.entities.Commentaire.create({
        entityType,
        entityId,
        auteurEmail: user?.email || "",
        auteurNom: user?.full_name || user?.email || "—",
        texte: value,
        initiateurEmail: initiateurEmail || "",
        responsablesProcessus: [...(responsablesProcessus || [])],
      });

      // Notification in-app uniquement (pas d'email) : les autres personnes ayant
      // accès à la fiche, hors l'auteur du commentaire.
      try {
        const recipients = new Set([...(initiateurEmail ? [initiateurEmail] : []), ...(responsablesProcessus || [])]);
        const processusList = await getProcessusList();
        getHseEmails(processusList).forEach(e => recipients.add(e));
        recipients.delete(user?.email);
        await Promise.all([...recipients].filter(Boolean).map(email =>
          base44.entities.Notification.create({
            destinataire: email,
            type: "Commentaire",
            titre: `Nouveau commentaire — ${numero || entityType}`,
            message: `${user?.full_name || user?.email} a commenté la fiche ${numero || ""} : « ${value.slice(0, 120)}${value.length > 120 ? "…" : ""} »`,
            lu: false,
            lienType: entityType.toLowerCase(),
            lienId: entityId,
          }).catch(e => console.warn("[Commentaires] Notification in-app échouée", { email, err: String(e?.message || e) }))
        ));
      } catch (e) {
        console.warn("[Commentaires] Notification in-app échouée", { err: String(e?.message || e) });
      }

      setTexte("");
      queryClient.invalidateQueries({ queryKey: ["commentaires", entityType, entityId] });
    } catch (e) {
      console.error("[Commentaires] Échec de l'envoi du commentaire", e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <MessageSquare className="w-4 h-4" /> Commentaires
      </h2>
      <div className="space-y-2">
        <Textarea
          value={texte}
          onChange={e => setTexte(e.target.value)}
          rows={3}
          placeholder="Ajouter un commentaire — visible par les personnes ayant accès à la fiche…"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSend} disabled={sending || !texte.trim()} className="bg-blue-600 hover:bg-blue-700">
            <Send className="w-3.5 h-3.5 mr-1" />{sending ? "Envoi…" : "Envoyer"}
          </Button>
        </div>
      </div>
      <CommentaireList commentaires={commentaires} loading={isLoading} />
    </div>
  );
}