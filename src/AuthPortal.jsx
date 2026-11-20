import React from "react";
import { Link } from "react-router-dom";
import { PORTALS } from "./authConfig";

function PortalIcon({ name }) {
  if (name === "city") {
    return (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 21h18M5 21V9l5-3v15M14 21V5l5 3v13" />
        <path d="M7 11h1M7 14h1M16 9h1M16 12h1M16 15h1" />
      </svg>
    );
  }
  if (name === "hub") {
    return (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 8l8-4 8 4v8l-8 4-8-4z" />
        <path d="M4 8l8 4 8-4M12 12v8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

const FEATURES = {
  household: [
    "Schedule and track waste pickups",
    "Watch your smart bin fill level and rewards",
    "Report illegal dumping with photo and GPS",
  ],
  authority: [
    "Live KPIs, charts and a city pickup map",
    "Triage illegal-dumping reports by status",
    "Oversee hub deliveries and collection activity",
  ],
};

export default function AuthPortal() {
  return (
    <div className="portal-page">
      <header className="portal-nav">
        <div className="brand">
          <span className="brand-mark">SW</span>
          <div>
            <strong>Smart Waste</strong>
            <span>City waste operations</span>
          </div>
        </div>
        <Link className="link-quiet" to="/hub">
          Hub operator sign in
        </Link>
      </header>

      <main className="portal-main">
        <p className="eyebrow">One web app, two portals</p>
        <h1 className="portal-title">Choose how you sign in</h1>
        <p className="portal-lede">
          Households and municipal authorities use separate sign-in pages, so each account lands
          in the right dashboard.
        </p>

        <div className="portal-grid">
          {["household", "authority"].map((key) => {
            const p = PORTALS[key];
            return (
              <Link key={key} to={`/${key}`} className="portal-card" style={{ "--accent": p.accent }}>
                <span className="portal-icon" style={{ background: p.accentSoft, color: p.accent }}>
                  <PortalIcon name={p.icon} />
                </span>
                <span className="portal-kicker">{p.short}</span>
                <h2>{p.title}</h2>
                <p>{p.subtitle}</p>
                <ul>
                  {FEATURES[key].map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <span className="portal-cta">Sign in or create an account &rarr;</span>
              </Link>
            );
          })}
        </div>

        <p className="portal-foot">
          Municipal authority accounts can register with an official email address. Hub operator
          accounts are issued by the municipality.
        </p>
      </main>
    </div>
  );
}
