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

const CHART_GRID = "#E5E7EB";
const AXIS_TICK = { fill: "#6B7280", fontSize: 12 };
const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "1px solid #E5E7EB",
  boxShadow: "0 8px 24px rgba(17,24,39,.08)",
};
const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "reports", label: "Dumping reports" },
  { id: "pickups", label: "Pickups" },
  { id: "map", label: "City map" },
];

function StatIcon({ name }) {
  const paths = {
    leaf: <path d="M5 19c0-7 5-12 14-13 0 9-5 14-12 14M5 19c2-4 5-7 9-9" />,
    hub: <path d="M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8" />,
    truck: <path d="M3 7h11v9H3zM14 11h4l3 3v2h-7M6.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />,
    alert: <path d="M12 4l9 16H3zM12 10v4M12 17h.01" />,
    home: <path d="M4 11l8-7 8 7v9H4zM9 20v-6h6v6" />,
    people: <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 2.5-5 6-5s6 2 6 5M16 11a2.5 2.5 0 1 0 0-5M15 15c3 0 6 1.5 6 5" />,
    bin: <path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />,
    scale: <path d="M12 4v16M6 8h12M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0z" />,
  };
  return (
    <span className="stat-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {paths[name] || paths.leaf}
      </svg>
    </span>
  );
}

function StatCard({ label, value, unit, hint, icon, tone = "green" }) {
  return (
    <div className={`stat stat-${tone}`}>
      <StatIcon name={icon} />
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}
        {unit ? <span className="stat-unit"> {unit}</span> : null}
      </div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}

function Metric({ label, value, unit }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">
        {value}
        {unit ? <span className="metric-unit"> {unit}</span> : null}
      </strong>
    </div>
  );
}

function Panel({ title, subtitle, action, children }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="panel-sub">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ReportPhoto({ url }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <div className="triage-photo-empty">No photo</div>;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="Dumping report" onError={() => setFailed(true)} />
    </a>
  );
}

function FilterChips({ options, value, onChange }) {
  return (
    <div className="filter-chips" role="group" aria-label="Filter">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`filter-chip${value === option.value ? " on" : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count === undefined ? null : <span className="filter-count">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

export default function Dashboard({ user, onLogout }) {
  const [summary, setSummary] = useState(null);
  const [pickups, setPickups] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [bins, setBins] = useState([]);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState(null);
  const [pickupFilter, setPickupFilter] = useState("all");
  const [reportFilter, setReportFilter] = useState("all");
  const [assignments, setAssignments] = useState({});
  const [assigning, setAssigning] = useState(null);

  const load = useCallback(async () => {
    try {
      // the optional lists keep the dashboard usable if one endpoint is unavailable
      const [s, p, h, b, r, c] = await Promise.all([
        api.summary(),
        api.pickups(),
        api.hubs(),
        api.bins().catch(() => []),
        api.reports().catch(() => []),
        api.collectors().catch(() => []),
      ]);
      setSummary(s);
      setPickups(p);
      setHubs(h);
      setBins(b);
      setReports(r);
      setCollectors(c);
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
    const t = setInterval(load, 30000); // refresh every 30 seconds
    return () => clearInterval(t);
  }, [load]);

  const changeReport = async (report, status) => {
    try {
      await api.setReportStatus(report.id, status);
      setNotice({ kind: "ok", text: `Report #${report.id} marked ${REPORT_STATUS_LABELS[status].toLowerCase()}.` });
      await load();
    } catch (e) {
      setNotice({ kind: "error", text: e.message });
    }
  };

  const assignPickup = async (pickup) => {
    const collector = assignments[pickup.id];
    if (!collector) return;
    setAssigning(pickup.id);
    try {
      await api.assignPickup(pickup.id, Number(collector));
      setNotice({ kind: "ok", text: `Pickup #${pickup.id} assigned to a collector.` });
      setAssignments((cur) => {
        const next = { ...cur };
        delete next[pickup.id];
        return next;
      });
      await load();
    } catch (e) {
      setNotice({ kind: "error", text: e.message });
    } finally {
      setAssigning(null);
    }
  };

  if (loading) return <p className="center-note">Loading dashboard...</p>;

  const byStatus = summary?.pickups_by_status || {};
  const totalPickups = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const statusData = Object.entries(byStatus)
    .map(([k, v]) => ({ key: k, name: STATUS_LABELS[k] || k, value: v }))
    .filter((d) => d.value > 0);
  const typeData = Object.entries(summary?.received_by_waste_type_kg || {}).map(([k, v]) => ({
    name: WASTE_LABELS[k] || k,
    kg: v,
  }));
  const daily = (summary?.collected_kg_by_day || []).map((d) => ({ ...d, label: d.date.slice(5) }));
  const binsFull = bins.filter((b) => b.needs_pickup).length;
  const openReports = reports.filter((r) => r.status === "open").length;
  const requestedPickups = pickups.filter((p) => p.status === "requested").length;

  const reportFilters = [
    { value: "all", label: "All reports", count: reports.length },
    ...Object.entries(REPORT_STATUS_LABELS).map(([value, label]) => ({
      value,
      label,
      count: reports.filter((r) => r.status === value).length,
    })),
  ];
  const visibleReports = reports.filter((r) => reportFilter === "all" || r.status === reportFilter);

  const pickupFilters = [
    { value: "all", label: "All", count: totalPickups },
    ...Object.entries(STATUS_LABELS).map(([value, label]) => ({
      value,
      label,
      count: pickups.filter((p) => p.status === value).length,
    })),
  ];
  const visiblePickups = pickups
    .filter((p) => pickupFilter === "all" || p.status === pickupFilter)
    .slice(0, 15);

  const displayName = user.name || user.email || user.phone || "Authority user";

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand app-brand">
          <span className="brand-mark">SW</span>
          <div>
            <span className="app-kicker">Smart Waste {"\u00B7"} Authority</span>
            <h1>City waste operations</h1>
            <span className="muted">
              Signed in as {displayName}
              {updated ? ` \u00B7 updated ${updated.toLocaleTimeString()}` : ""}
            </span>
          </div>
        </div>
        <div className="actions">
          <span className="role-pill">Authority</span>
          <button className="ghost" onClick={load}>Refresh</button>
          <button className="ghost" onClick={onLogout}>Log out</button>
        </div>
      </header>

      <nav className="section-nav" aria-label="Dashboard sections">
        {SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`}>{section.label}</a>
        ))}
      </nav>

      {error ? <div className="error banner">{error}</div> : null}
      {notice ? (
        <div className={`notice ${notice.kind === "ok" ? "ok" : "error"} banner`}>{notice.text}</div>
      ) : null}

      <section id="overview" className="dashboard-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Overview</p>
            <h2>Today at a glance</h2>
          </div>
          <span className="section-note">Live totals from pickups, hubs and smart bins</span>
        </div>

        <div className="stats hero-stats">
          <StatCard
            label="Waste collected"
            value={fmt(summary?.total_collected_kg)}
            unit="kg"
            hint="all recorded collections"
            icon="leaf"
          />
          <StatCard
            label="Hub delivery rate"
            value={fmt(summary?.hub_delivery_rate_pct)}
            unit="%"
            hint="kg received / kg collected"
            icon="hub"
          />
          <StatCard
            label="Total pickups"
            value={fmt(totalPickups)}
            hint={`${requestedPickups} waiting for a collector`}
            icon="truck"
          />
          <StatCard
            label="Open dumping reports"
            value={fmt(openReports)}
            hint="waiting for review"
            icon="alert"
            tone="amber"
          />
        </div>

        <div className="metrics-strip">
          <Metric label="Received at hubs" value={fmt(summary?.total_received_at_hubs_kg)} unit="kg" />
          <Metric label="Households" value={fmt(summary?.households)} />
          <Metric label="Collectors" value={fmt(summary?.collectors)} />
          <Metric label="Smart bins full" value={`${binsFull} / ${bins.length}`} />
        </div>

        <div className="grid-2">
          <Panel
            title="Waste collected per day"
            subtitle="Kilograms over the last 14 days"
          >
            {daily.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={daily} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(46,125,50,.06)" }} />
                  <Bar dataKey="kg" name="kg collected" fill="#2E7D32" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No daily data yet.</p>
            )}
          </Panel>

          <Panel title="Pickups by status" subtitle={`${fmt(totalPickups)} pickups in the system`}>
            {statusData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={94}
                    paddingAngle={2}
                  >
                    {statusData.map((d) => (
                      <Cell key={d.key} fill={STATUS_COLORS[d.key] || "#999"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No pickups yet.</p>
            )}
          </Panel>
        </div>
      </section>

      <section id="reports" className="dashboard-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Waste reporting</p>
            <h2>Illegal dumping reports</h2>
          </div>
          <span className="section-note">{openReports} open {"\u00B7"} {reports.length} total</span>
        </div>

        <FilterChips options={reportFilters} value={reportFilter} onChange={setReportFilter} />

        {visibleReports.length ? (
          <div className="report-grid">
            {visibleReports.map((r) => {
              const next =
                r.status === "open"
                  ? { status: "in_progress", label: "Start review" }
                  : r.status === "in_progress"
                    ? { status: "resolved", label: "Mark resolved" }
                    : { status: "open", label: "Reopen" };
              return (
                <article className="triage-card" key={r.id}>
                  <div className="triage-photo">
                    <ReportPhoto url={r.photo_url} />
                    <span className="badge triage-badge" style={{ background: REPORT_STATUS_COLORS[r.status] }}>
                      {REPORT_STATUS_LABELS[r.status] || r.status}
                    </span>
                  </div>
                  <div className="triage-body">
                    <div className="triage-meta">
                      <span>Report #{r.id}</span>
                      <span>{fmtDateTime(r.created_at)}</span>
                    </div>
                    <h3>{r.description || "Illegal dumping report"}</h3>
                    <p className="muted">
                      Reported by {r.reporter_name}
                      {r.reporter_phone ? ` \u00B7 ${r.reporter_phone}` : ""}
                    </p>
                    <div className="triage-loc">
                      <span>Lat {Number(r.latitude).toFixed(4)}</span>
                      <span>Lng {Number(r.longitude).toFixed(4)}</span>
                    </div>
                    <div className="triage-actions">
                      <select
                        className="status-select"
                        aria-label={`Status for report ${r.id}`}
                        value={r.status}
                        style={{ borderColor: REPORT_STATUS_COLORS[r.status] }}
                        onChange={(e) => changeReport(r, e.target.value)}
                      >
                        {Object.entries(REPORT_STATUS_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>{label}</option>
                        ))}
                      </select>
                      <button className="ghost small" onClick={() => changeReport(r, next.status)}>
                        {next.label}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <Panel title="No matching reports">
            <p className="muted">There are no reports with this status right now.</p>
          </Panel>
        )}
      </section>

      <section id="pickups" className="dashboard-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Collection tasks</p>
            <h2>Assign and track pickups</h2>
          </div>
          <span className="section-note">{requestedPickups} requested {"\u00B7"} {collectors.length} collectors available</span>
        </div>

        <Panel
          title="Recent pickups"
          subtitle="Dispatch requested pickups to an available collector"
        >
          <FilterChips options={pickupFilters} value={pickupFilter} onChange={setPickupFilter} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Household</th><th>Waste</th><th>Scheduled</th>
                  <th>Status</th><th>Collector</th><th>Weight</th>
                </tr>
              </thead>
              <tbody>
                {visiblePickups.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>
                      {p.household_name}
                      <div className="muted">{p.address}</div>
                    </td>
                    <td>{wasteList(p.waste_types)}</td>
                    <td>{fmtDateTime(p.scheduled_for)}</td>
                    <td>
                      <span className="badge" style={{ background: STATUS_COLORS[p.status] }}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td>
                      {p.status === "requested" ? (
                        <div className="assign-control">
                          <select
                            aria-label={`Collector for pickup ${p.id}`}
                            value={assignments[p.id] || ""}
                            onChange={(e) => setAssignments({ ...assignments, [p.id]: e.target.value })}
                          >
                            <option value="">Choose collector</option>
                            {collectors.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.group_name || c.name}
                                {c.active_zone ? ` \u00B7 ${c.active_zone}` : ""}
                              </option>
                            ))}
                          </select>
                          <button
                            className="ghost small"
                            disabled={!assignments[p.id] || assigning === p.id}
                            onClick={() => assignPickup(p)}
                          >
                            {assigning === p.id ? "Assigning..." : "Assign"}
                          </button>
                        </div>
                      ) : (
                        p.collector_name || <span className="muted">Not assigned</span>
                      )}
                    </td>
                    <td>{p.collection ? `${p.collection.weight_kg} kg` : "-"}</td>
                  </tr>
                ))}
                {!visiblePickups.length ? (
                  <tr><td colSpan={7} className="muted">No pickups match this filter.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      <section id="map" className="dashboard-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Location intelligence</p>
            <h2>City pickup map</h2>
          </div>
          <span className="section-note">Pickups, hubs, bins and dumping reports</span>
        </div>
        <Panel title="Live map">
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
      </section>

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
