import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "./api";
import {
  REPORT_STATUS_COLORS, REPORT_STATUS_LABELS, STATUS_COLORS, STATUS_LABELS, WASTE_LABELS,
  fmt, fmtDateTime, wasteList,
} from "./theme";

const SLOTS = [
  { label: "Morning", hour: 9 },
  { label: "Afternoon", hour: 14 },
];

// next 3 days x morning/afternoon
function buildSlots() {
  const out = [];
  for (let d = 1; d <= 3; d++) {
    for (const s of SLOTS) {
      const date = new Date();
      date.setDate(date.getDate() + d);
      date.setHours(s.hour, 0, 0, 0);
      const day = date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
      out.push({ key: `${d}-${s.label}`, date, label: `${day} \u00B7 ${s.label}` });
    }
  }
  return out;
}

function binColor(level, status) {
  if (status === "offline" || level == null) return "#9E9E9E";
  if (level >= 80) return "#C62828";
  if (level >= 50) return "#F9A825";
  return "#2E7D32";
}

const BIN_STATUS_TEXT = {
  ok: "Online",
  full: "Almost full - needs a pickup",
  offline: "No recent reading",
};

function StatCard({ label, value, unit, hint }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}
        {unit ? <span className="stat-unit"> {unit}</span> : null}
      </div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function HouseholdView({ user, onLogout }) {
  const [pickups, setPickups] = useState([]);
  const [balance, setBalance] = useState(null);
  const [history, setHistory] = useState([]);
  const [bins, setBins] = useState([]);
  const [readings, setReadings] = useState({});
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState(null);

  // profile (fetched once so editing is not clobbered by the 30s refresh)
  const [me, setMe] = useState(user);

  // request-a-pickup form
  const slots = useMemo(buildSlots, []);
  const [types, setTypes] = useState([]);
  const [slot, setSlot] = useState(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState(null);

  // dumping-report form
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [reportDesc, setReportDesc] = useState("");
  const [coords, setCoords] = useState(null);
  const [locMsg, setLocMsg] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMsg, setReportMsg] = useState(null);

  // account forms
  const [profile, setProfile] = useState({
    name: user.name || "",
    zone: user.zone || "",
    address: "",
    latitude: "",
    longitude: "",
  });
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  useEffect(() => {
    api
      .me()
      .then((prof) => {
        setMe(prof);
        setProfile({
          name: prof.name || "",
          zone: prof.zone || "",
          address: prof.address || "",
          latitude: prof.latitude ?? "",
          longitude: prof.longitude ?? "",
        });
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const [p, b, h, bn, rp] = await Promise.all([
        api.pickups(),
        api.rewardsBalance(),
        api.rewardsHistory(),
        api.bins().catch(() => []),
        api.reports().catch(() => []),
      ]);
      setPickups(p);
      setBalance(b);
      setHistory(h);
      setBins(bn);
      setReports(rp);
      const entries = await Promise.all(
        bn.map(async (x) => [x.id, await api.binReadings(x.id).catch(() => [])])
      );
      setReadings(Object.fromEntries(entries));
      setError("");
      setUpdated(new Date());
    } catch (e) {
      setError(e.message);
      if (e.status === 401) onLogout();
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const toggleType = (value) =>
    setTypes((cur) => (cur.includes(value) ? cur.filter((t) => t !== value) : [...cur, value]));

  const submit = async (e) => {
    e.preventDefault();
    if (types.length === 0) return setFormMsg({ kind: "error", text: "Choose at least one type of waste." });
    if (!slot) return setFormMsg({ kind: "error", text: "Choose when you want the pickup." });
    setSubmitting(true);
    try {
      await api.createPickup({
        waste_types: types,
        scheduled_for: slot.date.toISOString(),
        notes: notes.trim(),
      });
      setTypes([]);
      setSlot(null);
      setNotes("");
      setFormMsg({ kind: "ok", text: "Pickup requested. A collector will be assigned soon." });
      await load();
    } catch (err) {
      setFormMsg({ kind: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (p) => {
    if (!window.confirm("Cancel this pickup? This cannot be undone.")) return;
    try {
      await api.cancelPickup(p.id);
      await load();
    } catch (err) {
      setError(err.message);
      load();
    }
  };

  const pickPhoto = (e) => {
    const file = e.target.files?.[0] || null;
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : "");
  };

  const locateMe = () => {
    if (!navigator.geolocation) {
      setLocMsg("This browser cannot read your location.");
      return;
    }
    setLocMsg("Locating...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords([pos.coords.latitude, pos.coords.longitude]);
        setLocMsg("Location captured.");
      },
      () => setLocMsg("Location permission denied. Try your home location instead."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const useHomeLocation = () => {
    if (me?.latitude == null || me?.longitude == null) {
      setLocMsg("No home coordinates saved. Add them under Account settings.");
      return;
    }
    setCoords([me.latitude, me.longitude]);
    setLocMsg("Using your home location.");
  };

  const submitReport = async (e) => {
    e.preventDefault();
    if (!photo) return setReportMsg({ kind: "error", text: "Add a photo of the dumping site." });
    if (!coords) return setReportMsg({ kind: "error", text: "Share the location of the site." });
    const data = new FormData();
    data.append("photo", photo);
    data.append("latitude", coords[0]);
    data.append("longitude", coords[1]);
    data.append("description", reportDesc.trim());
    setReportBusy(true);
    try {
      await api.createReport(data);
      setPhoto(null);
      setPhotoPreview("");
      setReportDesc("");
      setCoords(null);
      setLocMsg("");
      setReportMsg({ kind: "ok", text: "Report sent. The council will review it." });
      await load();
    } catch (err) {
      setReportMsg({ kind: "error", text: err.message });
    } finally {
      setReportBusy(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileBusy(true);
    try {
      const body = { name: profile.name, zone: profile.zone, address: profile.address };
      if (profile.latitude !== "") body.latitude = Number(profile.latitude);
      if (profile.longitude !== "") body.longitude = Number(profile.longitude);
      const prof = await api.updateProfile(body);
      setMe(prof);
      setProfileMsg({ kind: "ok", text: "Profile saved." });
    } catch (err) {
      setProfileMsg({ kind: "error", text: err.message });
    } finally {
      setProfileBusy(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pw.next !== pw.confirm) {
      setPwMsg({ kind: "error", text: "The new passwords do not match." });
      return;
    }
    setPwBusy(true);
    try {
      await api.changePassword({ current_password: pw.current, new_password: pw.next });
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg({ kind: "ok", text: "Password updated. Use it the next time you sign in." });
    } catch (err) {
      setPwMsg({ kind: "error", text: err.message });
    } finally {
      setPwBusy(false);
    }
  };

  if (loading) return <p className="center-note">Loading your account...</p>;

  const active = pickups.filter((p) => p.status === "requested" || p.status === "assigned").length;
  const collectedKg = pickups.reduce((sum, p) => sum + (p.collection ? parseFloat(p.collection.weight_kg) : 0), 0);
  const firstBin = bins[0];

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>Hello, {me?.name || user.name || user.email || user.phone}</h1>
          <span className="muted">
            Your Smart Waste account
            {updated ? ` \u00B7 updated ${updated.toLocaleTimeString()}` : ""}
          </span>
        </div>
        <div className="actions">
          <button className="ghost" onClick={load}>Refresh</button>
          <button className="ghost" onClick={onLogout}>Log out</button>
        </div>
      </header>

      {error ? <div className="error banner">{error}</div> : null}

      <div className="stats">
        <StatCard label="Reward points" value={fmt(balance?.balance ?? 0)} hint="your balance" />
        <StatCard label="Active pickups" value={fmt(active)} hint="requested or assigned" />
        <StatCard label="Waste collected" value={fmt(collectedKg)} unit="kg" hint="from your household" />
        <StatCard
          label="Smart bin"
          value={firstBin && firstBin.last_fill_level != null ? firstBin.last_fill_level : "-"}
          unit={firstBin && firstBin.last_fill_level != null ? "% full" : ""}
          hint={firstBin ? firstBin.label || firstBin.device_id : "no bin linked"}
        />
      </div>

      <div className="hh-grid">
        <Panel title="My smart bin">
          {bins.length === 0 ? (
            <p className="muted">No smart bin is linked to your account yet.</p>
          ) : (
            bins.map((b) => {
              const level = b.last_fill_level;
              const color = binColor(level, b.status);
              const series = [...(readings[b.id] || [])].reverse().map((r) => ({
                time: new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                level: r.fill_level,
              }));
              return (
                <div className="bin-block" key={b.id}>
                  <div className="bin-head">
                    <strong>{b.label || b.device_id}</strong>
                    <span className="bin-level" style={{ color }}>{level == null ? "-" : `${level}%`}</span>
                  </div>
                  <div className="gauge">
                    <div style={{ width: `${level || 0}%`, background: color }} />
                  </div>
                  <div className="muted">
                    {BIN_STATUS_TEXT[b.status] || b.status}
                    {b.last_seen ? ` \u00B7 last reading ${fmtDateTime(b.last_seen)}` : ""}
                  </div>
                  {series.length > 1 ? (
                    <ResponsiveContainer width="100%" height={170}>
                      <LineChart data={series} margin={{ top: 14, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <ReferenceLine y={80} stroke="#C62828" strokeDasharray="4 4" />
                        <Line type="monotone" dataKey="level" name="% full" stroke={color} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : null}
                </div>
              );
            })
          )}
        </Panel>

        <Panel title="Request a pickup">
          <form onSubmit={submit}>
            {formMsg ? (
              <div className={formMsg.kind === "ok" ? "notice ok" : "notice error"}>{formMsg.text}</div>
            ) : null}
            <span className="form-label">What are you putting out?</span>
            <div className="chips">
              {Object.entries(WASTE_LABELS).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={types.includes(value) ? "chip chip-on" : "chip"}
                  onClick={() => toggleType(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="form-label">When should we collect?</span>
            <div className="chips">
              {slots.map((s) => (
                <button
                  type="button"
                  key={s.key}
                  className={slot?.key === s.key ? "chip chip-on" : "chip"}
                  onClick={() => setSlot(s)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <span className="form-label">Anything the collector should know?</span>
            <input
              className="text-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. bags are at the gate"
              maxLength={250}
            />
            <button type="submit" disabled={submitting}>
              {submitting ? "Requesting..." : "Request pickup"}
            </button>
          </form>
        </Panel>
      </div>

      <div className="hh-grid">
        <Panel title="My pickups">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Waste</th><th>Scheduled</th><th>Status</th><th>Collector</th><th>Weight</th><th></th>
                </tr>
              </thead>
              <tbody>
                {pickups.slice(0, 10).map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{wasteList(p.waste_types)}</td>
                    <td>{fmtDateTime(p.scheduled_for)}</td>
                    <td>
                      <span className="badge" style={{ background: STATUS_COLORS[p.status] }}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td>{p.collector_name || "-"}</td>
                    <td>{p.collection ? `${p.collection.weight_kg} kg` : "-"}</td>
                    <td>
                      {p.status === "requested" || p.status === "assigned" ? (
                        <button className="ghost small" onClick={() => cancel(p)}>Cancel</button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!pickups.length ? (
                  <tr><td colSpan={7} className="muted">No pickups yet. Request your first one above.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Reward points history">
          <p className="muted" style={{ marginTop: 0 }}>
            Earned {fmt(balance?.total_earned ?? 0)} {"\u00B7"} Used {fmt(balance?.total_redeemed ?? 0)}
          </p>
          {history.length ? (
            history.slice(0, 10).map((h) => (
              <div className="pts-row" key={h.id}>
                <span>
                  {h.reason}
                  <span className="muted"> {"\u00B7"} {fmtDateTime(h.created_at)}</span>
                </span>
                <span className={h.points >= 0 ? "pts-plus" : "pts-minus"}>
                  {h.points >= 0 ? "+" : ""}
                  {h.points}
                </span>
              </div>
            ))
          ) : (
            <p className="muted">No points yet. You earn points every time your waste is collected.</p>
          )}
        </Panel>
      </div>

      <div className="hh-grid">
        <Panel title="Report illegal dumping">
          <form onSubmit={submitReport}>
            {reportMsg ? (
              <div className={reportMsg.kind === "ok" ? "notice ok" : "notice error"}>{reportMsg.text}</div>
            ) : null}
            <span className="form-label">Photo of the site</span>
            <input className="file-input" type="file" accept="image/*" capture="environment" onChange={pickPhoto} />
            {photoPreview ? <img className="report-preview" src={photoPreview} alt="Selected dumping site" /> : null}
            <span className="form-label">What did you see?</span>
            <input
              className="text-input"
              value={reportDesc}
              onChange={(e) => setReportDesc(e.target.value)}
              placeholder="e.g. household waste dumped by the river"
              maxLength={250}
            />
            <span className="form-label">Where is it?</span>
            <div className="chips">
              <button type="button" className="chip" onClick={locateMe}>Use my location</button>
              <button type="button" className="chip" onClick={useHomeLocation}>Use my home location</button>
            </div>
            {coords ? (
              <p className="muted" style={{ marginTop: 0 }}>
                Location: {coords[0].toFixed(5)}, {coords[1].toFixed(5)}
              </p>
            ) : null}
            {locMsg ? <p className="muted" style={{ marginTop: 0 }}>{locMsg}</p> : null}
            <button type="submit" disabled={reportBusy}>
              {reportBusy ? "Sending..." : "Send report"}
            </button>
          </form>
        </Panel>

        <Panel title="My reports">
            {reports.length ? (
            reports.slice(0, 10).map((r) => (
              <div className="report-row" key={r.id}>
                {r.photo_url ? (
                  <img className="thumb" src={r.photo_url} alt="Dumping report" />
                ) : (
                  <div className="thumb thumb-empty" />
                )}
                <div className="report-body">
                  <div className="report-desc">{r.description || "No description"}</div>
                  <div className="muted">{fmtDateTime(r.created_at)}</div>
                </div>
                <span className="badge" style={{ background: REPORT_STATUS_COLORS[r.status] }}>
                  {REPORT_STATUS_LABELS[r.status] || r.status}
                </span>
              </div>
            ))
          ) : (
            <p className="muted">No reports yet. Use the form to flag dumping hotspots.</p>
          )}
        </Panel>
      </div>

      <div className="hh-grid">
        <Panel title="Account settings">
          <form onSubmit={saveProfile}>
            {profileMsg ? (
              <div className={profileMsg.kind === "ok" ? "notice ok" : "notice error"}>{profileMsg.text}</div>
            ) : null}
            <span className="form-label">Name</span>
            <input
              className="text-input"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              required
            />
            <span className="form-label">Email</span>
            <input className="text-input" value={me?.email || "Not set"} disabled />
            <p className="muted" style={{ marginTop: -8 }}>
              Sign-in method: {me?.auth_provider === "google" ? "Google account" : "Email or phone + password"}
            </p>
            <span className="form-label">Zone / ward</span>
            <input
              className="text-input"
              value={profile.zone}
              onChange={(e) => setProfile({ ...profile, zone: e.target.value })}
            />
            <span className="form-label">Home address</span>
            <input
              className="text-input"
              value={profile.address}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
            />
            <div className="field-row">
              <label>
                Latitude
                <input
                  type="number"
                  step="any"
                  value={profile.latitude}
                  onChange={(e) => setProfile({ ...profile, latitude: e.target.value })}
                />
              </label>
              <label>
                Longitude
                <input
                  type="number"
                  step="any"
                  value={profile.longitude}
                  onChange={(e) => setProfile({ ...profile, longitude: e.target.value })}
                />
              </label>
            </div>
            <p className="muted">Coordinates are used as a fallback when you report dumping.</p>
            <button type="submit" disabled={profileBusy}>
              {profileBusy ? "Saving..." : "Save profile"}
            </button>
          </form>
        </Panel>

        <Panel title="Password">
          <form onSubmit={savePassword}>
            {pwMsg ? (
              <div className={pwMsg.kind === "ok" ? "notice ok" : "notice error"}>{pwMsg.text}</div>
            ) : null}
            <p className="muted" style={{ marginTop: 0 }}>
              Google and USSD accounts can set a password here to also sign in with email and password.
              Leave "Current password" blank if you have never set one.
            </p>
            <span className="form-label">Current password</span>
            <input
              className="text-input"
              type="password"
              value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })}
              autoComplete="current-password"
            />
            <span className="form-label">New password</span>
            <input
              className="text-input"
              type="password"
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
              autoComplete="new-password"
              minLength={6}
              required
            />
            <span className="form-label">Confirm new password</span>
            <input
              className="text-input"
              type="password"
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              autoComplete="new-password"
              minLength={6}
              required
            />
            <button type="submit" disabled={pwBusy || !pw.next}>
              {pwBusy ? "Updating..." : "Update password"}
            </button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
