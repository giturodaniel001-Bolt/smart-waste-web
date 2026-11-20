export const STATUS_COLORS = {
  requested: "#EF6C00",
  assigned: "#1565C0",
  collected: "#2E7D32",
  delivered: "#00695C",
  cancelled: "#9E9E9E",
};

export const STATUS_LABELS = {
  requested: "Requested",
  assigned: "Assigned",
  collected: "Collected",
  delivered: "Delivered to hub",
  cancelled: "Cancelled",
};

export const REPORT_STATUS_LABELS = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export const REPORT_STATUS_COLORS = {
  open: "#C62828",
  in_progress: "#EF6C00",
  resolved: "#2E7D32",
};

export const WASTE_LABELS = {
  organic: "Organic",
  plastic: "Plastic",
  glass: "Glass",
  paper: "Paper",
  metal: "Metal",
  ewaste: "E-waste",
  other: "Other",
};

export const wasteList = (types) => (types || []).map((t) => WASTE_LABELS[t] || t).join(", ");

export const fmt = (n) =>
  n === undefined || n === null ? "-" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 });

export function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// 0712345678 / 254712345678 / +254712345678 -> +254712345678 (same rule as the backend)
export function normalizePhone(value) {
  const v = (value || "").replace(/[\s\-()]/g, "");
  if (v.startsWith("+")) return v;
  if (v.startsWith("0")) return "+254" + v.slice(1);
  if (v.startsWith("254")) return "+" + v;
  return v;
}
