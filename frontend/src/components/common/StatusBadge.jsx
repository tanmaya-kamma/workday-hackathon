import React from "react";
import { Badge } from "./Badge.jsx";

export function StatusBadge({ status, className = "", size = "sm" }) {
  const normalized = String(status || "default").toLowerCase();

  const labels = {
    pending: "Pending Manager",
    pending_hr: "Pending HR Review",
    approved: "Approved",
    rejected: "Rejected",
    draft: "Draft",
    cancelled: "Cancelled",
  };

  const label =
    labels[normalized] ||
    normalized.charAt(0).toUpperCase() + normalized.slice(1);

  return (
    <Badge variant={normalized} size={size} className={className}>
      {label}
    </Badge>
  );
}

export { Badge };
