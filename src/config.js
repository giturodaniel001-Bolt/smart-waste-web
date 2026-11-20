// Local development falls back to the Django server on this laptop. Production
// builds set VITE_API_URL to the deployed API origin.
const configured = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");

export const API_URL = configured || "http://127.0.0.1:8000";
