import React, { useCallback, useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "./api";
import PickupMap from "./PickupMap.jsx";
import {
  REPORT_STATUS_COLORS, REPORT_STATUS_LABELS, STATUS_COLORS, STATUS_LABELS, WASTE_LABELS,
  fmt, fmtDateTime, wasteList,
} from "./theme";

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

export default function Dashboard({ user, onLogout }) {
  const [summary, setSummary] = useState(null);
  const [pickups, setPickups] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [bins, setBins] = useState([]);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      // the bins/reports lists are optional: if an endpoint is missing, the rest still loads
      const [s, p, h, b, r] = await Promise.all([
        api.summary(),
        api.pickups(),
        api.hubs(),
        api.bins().catch(() => []),
        api.reports().catch(() => []),
      ]);
      setSummary(s);
      setPickups(p);
      setHubs(h);
      setBins(b);
      setReports(r);
      setError("");
      setUpdated(new Date());
    } catch (e) {
      setError(e.message);
      if (e.status === 401) onLogout();
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  const changeReport = async (report, status) => {
    try {
      await api.setReportStatus(report.id, status);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // refresh every 30 seconds
    return () => clearInterval(t);
  }, [load]);

  if (loading) return <p className="center-note">Loading dashboard...</p>;

  const byStatus = summary?.pickups_by_status || {};
  const totalPickups = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const statusData = Object.entries(byStatus).map(([k, v]) => ({ key: k, name: STATUS_LABELS[k] || k, value: v }));
  const typeData = Object.entries(summary?.received_by_waste_type_kg || {}).map(([k, v]) => ({
    name: WASTE_LABELS[k] || k,
    kg: v,
  }));
  const daily = (summary?.collected_kg_by_day || []).map((d) => ({ ...d, label: d.date.slice(5) }));
  const binsFull = bins.filter((b) => b.needs_pickup).length;
  const openReports = reports.filter((r) => r.status === "open").length;
  const rows = pickups.filter((p) => filter === "all" || p.status === filter).slice(0, 15);

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>Smart Waste Dashboard</h1>
          <span className="muted">
            Signed in as {user.name || user.email || user.phone}
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
        <StatCard label="Waste collected" value={fmt(summary?.total_collected_kg)} unit="kg" />
        <StatCard label="Received at hubs" value={fmt(summary?.total_received_at_hubs_kg)} unit="kg" />
        <StatCard
          label="Hub delivery rate"
          value={fmt(summary?.hub_delivery_rate_pct)}
          unit="%"
          hint="kg received at hubs / kg collected"
        />
        <StatCard label="Total pickups" value={fmt(totalPickups)} />
        <StatCard label="Households" value={fmt(summary?.households)} />
        <StatCard label="Collectors" value={fmt(summary?.collectors)} />
        <StatCard
          label="Smart bins full"
          value={`${binsFull} / ${bins.length}`}
          hint="bins at 80% or more"
        />
        <StatCard
          label="Open dumping reports"
          value={fmt(openReports)}
          hint="waiting for action"
        />
      </div>

      <div className="grid-2">
        <Panel title="Waste collected per day (kg), last 14 days">
          {daily.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="kg" name="kg collected" fill="#2E7D32" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted">No daily data yet. Did you copy the updated hubs/views.py into the backend?</p>
          )}
        </Panel>

        <Panel title="Pickups by status">
          {statusData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {statusData.map((d) => (
                    <Cell key={d.key} fill={STATUS_COLORS[d.key] || "#999"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted">No pickups yet.</p>
          )}
        </Panel>
      </div>

      <div className="grid-2">
        <Panel title="Waste received at hubs, by type (kg)">
          {typeData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={typeData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={70} />
                <Tooltip />
                <Bar dataKey="kg" name="kg received" fill="#00695C" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted">Nothing received at hubs yet.</p>
          )}
        </Panel>

        <Panel title="Pickup map">
          <PickupMap pickups={pickups} hubs={hubs} bins={bins} reports={reports} />
          <div className="legend">
            {Object.entries(STATUS_LABELS).map(([k, label]) => (
              <span key={k}>
                <i style={{ background: STATUS_COLORS[k] }} /> {label}
              </span>
            ))}
            <span>
              <i style={{ background: "#CE93D8", border: "2px solid #4A148C" }} /> Hub
            </span>
            <span>
              <i style={{ background: "#2E7D32", border: "2px solid #1F2937" }} /> Bin under 50%
            </span>
            <span>
              <i style={{ background: "#F9A825", border: "2px solid #1F2937" }} /> Bin 50-79%
            </span>
            <span>
              <i style={{ background: "#C62828", border: "2px solid #1F2937" }} /> Bin full
            </span>
            <span>
              <i style={{ background: "#9E9E9E", border: "2px solid #1F2937" }} /> Bin offline
            </span>
            <span>
              <i style={{ background: "#E91E63", border: "2px solid #880E4F" }} /> Dumping report
            </span>
          </div>
        </Panel>
      </div>

      <Panel title="Illegal dumping reports">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Photo</th><th>Reported by</th><th>Description</th>
                <th>Location</th><th>Reported</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.photo_url ? (
                      <a href={r.photo_url} target="_blank" rel="noreferrer">
                        <img className="thumb" src={r.photo_url} alt="Dumping report" />
                      </a>
                    ) : "-"}
                  </td>
                  <td>
                    {r.reporter_name}
                    <div className="muted">{r.reporter_phone}</div>
                  </td>
                  <td className="wrap">{r.description || "-"}</td>
                  <td>{Number(r.latitude).toFixed(4)}, {Number(r.longitude).toFixed(4)}</td>
                  <td>{fmtDateTime(r.created_at)}</td>
                  <td>
                    <select
                      className="status-select"
                      value={r.status}
                      style={{ borderColor: REPORT_STATUS_COLORS[r.status] }}
                      onChange={(e) => changeReport(r, e.target.value)}
                    >
                      {Object.entries(REPORT_STATUS_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>{label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {!reports.length ? (
                <tr><td colSpan={6} className="muted">No dumping reports yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Recent pickups">
        <div className="filters">
          <label>Status: </label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            {Object.entries(STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Household</th><th>Address</th><th>Waste</th>
                <th>Scheduled</th><th>Status</th><th>Collector</th><th>Weight</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.household_name}</td>
                  <td>{p.address}</td>
                  <td>{wasteList(p.waste_types)}</td>
                  <td>{fmtDateTime(p.scheduled_for)}</td>
                  <td>
                    <span className="badge" style={{ background: STATUS_COLORS[p.status] }}>
                      {STATUS_LABELS[p.status] || p.status}
                    </span>
                  </td>
                  <td>{p.collector_name || "-"}</td>
                  <td>{p.collection ? `${p.collection.weight_kg} kg` : "-"}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr><td colSpan={8} className="muted">No pickups match this filter.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
