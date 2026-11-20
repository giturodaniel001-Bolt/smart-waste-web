import { API_URL } from "./config";

const KEY = "waste_dashboard_tokens";
let tokens = {};
try {
  tokens = JSON.parse(localStorage.getItem(KEY) || "{}");
} catch (e) {
  tokens = {};
}

function save(t) {
  tokens = t || {};
  if (tokens.access) localStorage.setItem(KEY, JSON.stringify(tokens));
  else localStorage.removeItem(KEY);
}

export const hasToken = () => Boolean(tokens.access);

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function errorText(data) {
  if (!data) return "";
  if (typeof data === "string") return data.slice(0, 200);
  if (data.detail) return String(data.detail);
  return Object.entries(data)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`)
    .join("\n");
}

async function raw(path, { method = "GET", body, formData, auth = true } = {}) {
  const headers = { Accept: "application/json" };
  if (!formData) headers["Content-Type"] = "application/json";
  if (auth && tokens.access) headers.Authorization = `Bearer ${tokens.access}`;
  try {
    return await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: formData || (body ? JSON.stringify(body) : undefined),
    });
  } catch (e) {
    throw new ApiError(
      "Cannot reach the server. Is Django running, and is CORS_ALLOWED_ORIGINS set in the backend .env?",
      0
    );
  }
}

async function refresh() {
  if (!tokens.refresh) return false;
  const res = await raw("/api/auth/refresh/", { method: "POST", body: { refresh: tokens.refresh }, auth: false });
  if (!res.ok) return false;
  const data = await res.json();
  save({ access: data.access, refresh: data.refresh || tokens.refresh });
  return true;
}

export async function request(path, options = {}) {
  let res = await raw(path, options);
  if (res.status === 401 && options.auth !== false) {
    if (await refresh()) {
      res = await raw(path, options);
    } else {
      save({});
      throw new ApiError("Session expired. Please log in again.", 401);
    }
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }
  }
  if (!res.ok) throw new ApiError(errorText(data) || `Request failed (${res.status})`, res.status);
  return data;
}

async function allPages(path) {
  let all = [];
  for (let page = 1; page <= 25; page++) {
    const data = await request(`${path}?page=${page}`);
    all = all.concat(data.results);
    if (!data.next) break;
  }
  return all;
}

export const api = {
  async login(identifier, password) {
    const data = await request("/api/auth/login/", {
      method: "POST",
      body: { identifier, password },
      auth: false,
    });
    save({ access: data.access, refresh: data.refresh });
    return data;
  },
  async register(body) {
    const data = await request("/api/auth/register/", { method: "POST", body, auth: false });
    save({ access: data.access, refresh: data.refresh });
    return data;
  },
  async googleLogin(credential, portal) {
    const data = await request("/api/auth/google/", {
      method: "POST",
      body: { credential, portal },
      auth: false,
    });
    save({ access: data.access, refresh: data.refresh });
    return data;
  },
  authConfig: () => request("/api/auth/config/", { auth: false }),
  logout: () => save({}),
  me: () => request("/api/auth/me/"),
  updateProfile: (body) => request("/api/auth/me/", { method: "PATCH", body }),
  changePassword: (body) => request("/api/auth/password/", { method: "POST", body }),
  summary: () => request("/api/stats/summary/"),
  pickups: () => allPages("/api/pickups/"),
  hubs: () => allPages("/api/hubs/"),
  bins: () => allPages("/api/bins/"),
  binReadings: (id) => request(`/api/bins/${id}/readings/`),
  rewardsBalance: () => request("/api/rewards/balance/"),
  rewardsHistory: () => allPages("/api/rewards/history/"),
  createPickup: (body) => request("/api/pickups/", { method: "POST", body }),
  cancelPickup: (id) => request(`/api/pickups/${id}/cancel/`, { method: "POST" }),
  reports: () => allPages("/api/reports/"),
  createReport: (formData) => request("/api/reports/", { method: "POST", formData }),
  setReportStatus: (id, status) => request(`/api/reports/${id}/`, { method: "PATCH", body: { status } }),
  hubIntakes: () => allPages("/api/hub-intakes/"),
  createHubIntake: (body) => request("/api/hub-intakes/", { method: "POST", body }),
};
