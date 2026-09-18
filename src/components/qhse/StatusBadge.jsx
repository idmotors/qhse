import React from "react";
import { Badge } from "@/components/ui/badge";
import { STATUT_CONFIG, ACTION_STATUT_CONFIG, AC_STATUT_CONFIG, ACTION_AC_STATUT_CONFIG } from "./constants";

export default function StatusBadge({ statut, type = "nc", className = "" }) {
  const configs =
    type === "nc" ? STATUT_CONFIG :
    type === "ac" ? AC_STATUT_CONFIG :
    type === "action-ac" ? ACTION_AC_STATUT_CONFIG :
    ACTION_STATUT_CONFIG;
  const config = configs[statut] || { color: "bg-gray-100 text-gray-800 border-gray-200" };

  return (
    <Badge className={`${config.color} border font-medium text-xs px-2.5 py-0.5 rounded-full ${className}`}>
      {statut}
    </Badge>
  );
}