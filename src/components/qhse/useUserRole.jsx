import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export function useUserRole() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const me = await base44.auth.me();
      setUser(me);
      setLoading(false);
    };
    load();
  }, []);

  const role = user?.role || "collaborateur";
  const isQHSE = role === "qhse";
  const isDirection = role === "direction";
  const isCollaborateur = role === "collaborateur";
  const isAdminGestion = role === "admin_gestion";

  return { user, role, isQHSE, isDirection, isCollaborateur, isAdminGestion, loading };
}