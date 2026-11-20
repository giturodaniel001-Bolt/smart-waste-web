import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { WASTE_LABELS, fmt, fmtDateTime, wasteList } from "./theme";

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

const round2 = (n) => Math.round(Number(n) * 100) / 100;

export default function HubOperatorView({ user, onLogout }) {
  const [pickups, setPickups] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [intakes, setIntakes] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState(null);

  const [selected, setSelected] = useState(null);
  const [hubId, setHubId] = useState("");
  const [wasteType, setWasteType] = useState("");
  const [weight, setWeight] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      const [p, h, i] = await Promise.all([api.pickups(), api.hubs(), api.hubIntakes()]);
      setPickups(p);
      setHubs(h);
      setIntakes(i);
      setHubId((cur) => cur || (h[0] ? String(h[0].id) : ""));
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

  const loggedTypes = useMemo(() => {
    const map = {};
    intakes.forEach((i) => {
      (map[i.pickup_id] = map[i.pickup_id] || new Set()).add(i.waste_type);
    });
    return map;
  }, [intakes]);

  const awaiting = useMemo(
    () =>
      pickups.filter(
        (p) =>
          p.collection &&
          (p.status === "collected" || p.status === "delivered") &&
          p.waste_types.some((t) => !(loggedTypes[p.id] || new Set()).has(t))
      ),
    [pickups, loggedTypes]
  );

  const startLogging = (p) => {
    const missing = p.waste_types.filter((t) => !(loggedTypes[p.id] || new Set()).has(t));
    setSelected(p);
    setWasteType(missing[0] || p.waste_types[0]);
    setWeight(round2(Number(p.collection.weight_kg) / p.waste_types.length));
    setMsg(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      await api.createHubIntake({
        hub: Number(hubId),
        collection: selected.collection.id,
        waste_type: wasteType,
        weight_kg: weight,
      });
      setMsg({ kind: "ok", text: `Delivery of ${WASTE_LABELS[wasteType] || wasteType} logged.` });
      setSelected(null);
      await load();
    } catch (err) {
      setMsg({ kind: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="center-note">Loading your hub...</p>;

  const today = new Date().toDateString();
  const receivedToday = intakes
    .filter((i) => new Date(i.received_at).toDateString() === today)
    .reduce((sum, i) => sum + Number(i.weight_kg), 0);
  const totalKg = intakes.reduce((sum, i) => sum + Number(i.weight_kg), 0);
  const hubName = hubs.length === 1 ? hubs[0].name : null;

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand app-brand">
          <span className="brand-mark">SW</span>
          <div>
            <span className="app-kicker">Smart Waste {"\u00B7"} Hub operator</span>
            <h1>{hubName ? hubName : "Hub deliveries"}</h1>
            <span className="muted">
              Signed in as {user.name || user.email || user.phone}
              {updated ? ` \u00B7 updated ${updated.toLocaleTimeString()}` : ""}
            </span>
          </div>
        </div>
        <div className="actions">
          <span className="role-pill">Hub operator</span>
          <button className="ghost" onClick={load}>Refresh</button>
          <button className="ghost" onClick={onLogout}>Log out</button>
        </div>
      </header>

      {error ? <div className="error banner">{error}</div> : null}

      <div className="stats">
        <StatCard label="Awaiting delivery" value={fmt(awaiting.length)} hint="pickups still missing a waste type" />
        <StatCard label="Deliveries logged" value={fmt(intakes.length)} />
        <StatCard label="Received today" value={fmt(round2(receivedToday))} unit="kg" />
        <StatCard label="Total received" value={fmt(round2(totalKg))} unit="kg" />
      </div>

      {hubs.length === 0 ? (
        <div className="error banner">
          No hub is assigned to your account yet. Ask an administrator to make you the operator
          of a hub in the Django admin.
        </div>
      ) : null}

      <Panel title="Deliveries to log">
        {msg ? (
          <div className={msg.kind === "ok" ? "notice ok" : "notice error"}>{msg.text}</div>
        ) : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Household</th><th>Address</th><th>Waste</th>
                <th>Collected</th><th>Weight</th><th>Missing types</th><th></th>
              </tr>
            </thead>
            <tbody>
              {awaiting.slice(0, 15).map((p) => {
                const missing = p.waste_types.filter((t) => !(loggedTypes[p.id] || new Set()).has(t));
                return (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.household_name}</td>
                    <td>{p.address}</td>
                    <td>{wasteList(p.waste_types)}</td>
                    <td>{p.collection ? fmtDateTime(p.collection.collected_at) : "-"}</td>
                    <td>{p.collection ? `${p.collection.weight_kg} kg` : "-"}</td>
                    <td>{wasteList(missing)}</td>
                    <td>
                      <button className="ghost small" onClick={() => startLogging(p)} disabled={!hubs.length}>
                        Log delivery
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!awaiting.length ? (
                <tr><td colSpan={8} className="muted">Nothing is waiting for delivery. Collected pickups will appear here.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {selected ? (
          <form className="log-form" onSubmit={submit}>
            <div className="log-head">
              <strong>Log delivery for pickup #{selected.id}</strong>
              <button type="button" className="ghost small" onClick={() => setSelected(null)}>Cancel</button>
            </div>
            <div className="field-row">
              <label>
                Hub
                <select value={hubId} onChange={(e) => setHubId(e.target.value)}>
                  {hubs.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Waste type
                <select value={wasteType} onChange={(e) => setWasteType(e.target.value)}>
                  {selected.waste_types
                    .filter((t) => !(loggedTypes[selected.id] || new Set()).has(t))
                    .map((t) => (
                      <option key={t} value={t}>{WASTE_LABELS[t] || t}</option>
                    ))}
                </select>
              </label>
              <label>
                Weight (kg)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  required
                />
              </label>
              <button type="submit" disabled={busy || !hubId || !wasteType}>
                {busy ? "Saving..." : "Log delivery"}
              </button>
            </div>
            <p className="muted" style={{ margin: "8px 0 0" }}>
              Household: {selected.household_name} {"\u00B7"} {selected.address}
            </p>
          </form>
        ) : null}
      </Panel>

      <Panel title="Recent deliveries">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pickup</th><th>Hub</th><th>Household</th><th>Waste</th><th>Weight</th><th>Received</th>
              </tr>
            </thead>
            <tbody>
              {intakes.slice(0, 20).map((i) => (
                <tr key={i.id}>
                  <td>#{i.pickup_id}</td>
                  <td>{i.hub_name}</td>
                  <td>{i.household_name}</td>
                  <td>{WASTE_LABELS[i.waste_type] || i.waste_type}</td>
                  <td>{i.weight_kg} kg</td>
                  <td>{fmtDateTime(i.received_at)}</td>
                </tr>
              ))}
              {!intakes.length ? (
                <tr><td colSpan={6} className="muted">No deliveries logged yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-contact">
            <a href="mailto:support@smartwaste.city">support@smartwaste.city</a>
            <a href="tel:+254700000000">+254 700 000 000</a>
            <span>Monday to Saturday, 7:00 - 18:00</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
