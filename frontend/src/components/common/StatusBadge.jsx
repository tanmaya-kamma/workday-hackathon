import React from "react";
import { Badge } from "./Badge.jsx";

export function StatusBadge({ status, stage = null, className = "", size = "sm" }) {
  let normalized = String(status || "default").toLowerCase();

  // 6+ day requests route directly to HR: status stays "pending" but
  // the approval stage is "HR", so label them as awaiting HR.
  if (normalized === "pending" && String(stage || "").toUpperCase() === "HR") {
    normalized = "pending_hr";
  }

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
