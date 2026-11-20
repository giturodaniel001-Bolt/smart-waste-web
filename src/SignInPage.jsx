import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "./api";
import GoogleSignIn from "./GoogleSignIn.jsx";
import { PORTALS, ROLE_LABELS, portalForRole, portalPath, roleAllowed } from "./authConfig";

const CAPABILITIES = {
  household: [
    "Request and cancel waste pickups",
    "Track your smart bin and reward points",
    "Report illegal dumping with a photo and GPS",
  ],
  authority: [
    "Live KPIs, charts and the city pickup map",
    "Triage illegal-dumping reports",
    "Oversee hub deliveries and collections",
  ],
  hub_operator: [
    "See collected pickups awaiting intake",
    "Log each waste type delivered to your hub",
    "Review recent deliveries",
  ],
};

function Icon({ name }) {
  if (name === "city") {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 21h18M5 21V9l5-3v15M14 21V5l5 3v13" />
        <path d="M7 11h1M7 14h1M16 9h1M16 12h1M16 15h1" />
      </svg>
    );
  }
  if (name === "hub") {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 8l8-4 8 4v8l-8 4-8-4z" />
        <path d="M4 8l8 4 8-4M12 12v8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

export default function SignInPage({ portal }) {
  const config = PORTALS[portal];
  const navigate = useNavigate();
  const [mode, setMode] = useState("signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [reg, setReg] = useState({
    name: "",
    email: "",
    phone: "",
    zone: "",
    address: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [mismatch, setMismatch] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleClientId, setGoogleClientId] = useState("");

  useEffect(() => {
    let active = true;
    api
      .authConfig()
      .then((data) => {
        if (active) setGoogleClientId(data.google_client_id || "");
      })
      .catch(() => {
        if (active) setGoogleClientId("");
      });
    return () => {
      active = false;
    };
  }, []);

  const finish = (data) => {
    const user = data?.user;
    if (!user) {
      setError("The server did not return an account. Please try again.");
      return;
    }
    if (!roleAllowed(portal, user.role)) {
      api.logout();
      const actualPortal = portalForRole(user.role);
      setMismatch(actualPortal);
      setError(
        `This account is registered as ${ROLE_LABELS[user.role] || user.role}. ` +
          `Use the ${PORTALS[actualPortal].title} sign-in page instead.`
      );
      return;
    }
    navigate("/app", { replace: true });
  };

  const submitSignIn = async (e) => {
    e.preventDefault();
    setError("");
    setMismatch("");
    setBusy(true);
    try {
      const data = await api.login(identifier.trim(), password);
      finish(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    setError("");
    setMismatch("");
    if (reg.password !== reg.confirm) {
      setError("The two passwords do not match.");
      return;
    }
    if (portal === "household" && !reg.address.trim()) {
      setError("Enter your home address so collectors can find you.");
      return;
    }
    const body = {
      name: reg.name.trim(),
      email: reg.email.trim(),
      password: reg.password,
      role: portal === "authority" ? "authority" : "household",
      zone: reg.zone.trim(),
    };
    if (reg.phone.trim()) body.phone = reg.phone.trim();
    if (portal === "household") body.address = reg.address.trim();

    setBusy(true);
    try {
      const data = await api.register(body);
      finish(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const googleSuccess = (data) => {
    setError("");
    setMismatch("");
    finish(data);
  };

  const googleError = (message) => {
    setError(typeof message === "string" ? message : message?.message || "Google sign-in failed.");
  };

  const canRegister = portal !== "hub_operator";
  const otherPortals = ["household", "authority", "hub_operator"].filter((p) => p !== portal);

  return (
    <div className="auth-page" style={{ "--accent": config.accent, "--accent-soft": config.accentSoft }}>
      <div className="auth-top">
        <Link to="/" className="link-quiet">
          &larr; All portals
        </Link>
        <span className="portal-tag">{config.short}</span>
      </div>

      <div className="auth-shell">
        <aside className="auth-aside">
          <span className="portal-icon" style={{ background: config.accentSoft, color: config.accent }}>
            <Icon name={config.icon} />
          </span>
          <p className="eyebrow">Smart Waste</p>
          <h1>{config.signInTitle}</h1>
          <p>{config.subtitle}</p>
          <ul className="auth-list">
            {CAPABILITIES[portal].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="auth-note">
            {canRegister
              ? "Use email and password, continue with Google, or create an account in a few steps."
              : "Hub operator accounts are issued by your municipality."}
          </p>
        </aside>

        <section className="auth-card">
          <div className="auth-card-head">
            <div>
              <h2>{mode === "signin" || !canRegister ? "Sign in" : "Create account"}</h2>
              <p className="muted">{config.title}</p>
            </div>
            {canRegister ? (
              <div className="auth-tabs">
                <button
                  type="button"
                  className={mode === "signin" ? "on" : ""}
                  onClick={() => {
                    setMode("signin");
                    setError("");
                    setMismatch("");
                  }}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className={mode === "register" ? "on" : ""}
                  onClick={() => {
                    setMode("register");
                    setError("");
                    setMismatch("");
                  }}
                >
                  Register
                </button>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="error auth-error">
              {error}
              {mismatch ? (
                <>
                  {" "}
                  <Link to={portalPath(mismatch)}>Go to {PORTALS[mismatch].title}</Link>
                </>
              ) : null}
            </div>
          ) : null}

          {mode === "signin" || !canRegister ? (
            <form className="auth-form" onSubmit={submitSignIn}>
              <label htmlFor="identifier">Email or phone</label>
              <input
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com or 0712 345 678"
                autoComplete="username"
                autoFocus
                required
              />
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button className="auth-submit" type="submit" disabled={busy || !identifier || !password}>
                {busy ? "Signing in..." : "Sign in"}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={submitRegister}>
              <div className="auth-row">
                <label>
                  Full name
                  <input
                    value={reg.name}
                    onChange={(e) => setReg({ ...reg, name: e.target.value })}
                    autoComplete="name"
                    required
                  />
                </label>
                <label>
                  <span>
                    Phone <span className="optional">(optional)</span>
                  </span>
                  <input
                    value={reg.phone}
                    onChange={(e) => setReg({ ...reg, phone: e.target.value })}
                    placeholder="0712 345 678"
                    autoComplete="tel"
                  />
                </label>
              </div>
              <label>
                {portal === "authority" ? "Official email" : "Email"}
                <input
                  type="email"
                  value={reg.email}
                  onChange={(e) => setReg({ ...reg, email: e.target.value })}
                  placeholder={portal === "authority" ? "name@county.gov" : "you@example.com"}
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                {portal === "authority" ? "County / department" : "Zone / ward"}
                <input
                  value={reg.zone}
                  onChange={(e) => setReg({ ...reg, zone: e.target.value })}
                  placeholder={portal === "authority" ? "e.g. Nairobi - Environment" : "e.g. Zone C"}
                />
              </label>
              {portal === "household" ? (
                <label>
                  Home address
                  <input
                    value={reg.address}
                    onChange={(e) => setReg({ ...reg, address: e.target.value })}
                    placeholder="Street, plot or landmark"
                    autoComplete="street-address"
                    required
                  />
                </label>
              ) : null}
              <div className="auth-row">
                <label>
                  Password
                  <input
                    type="password"
                    value={reg.password}
                    onChange={(e) => setReg({ ...reg, password: e.target.value })}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>
                <label>
                  Confirm password
                  <input
                    type="password"
                    value={reg.confirm}
                    onChange={(e) => setReg({ ...reg, confirm: e.target.value })}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>
              </div>
              <p className="auth-hint">Use at least 8 characters.</p>
              <button className="auth-submit" type="submit" disabled={busy}>
                {busy ? "Creating account..." : `Create ${portal === "authority" ? "authority" : "household"} account`}
              </button>
            </form>
          )}

          {canRegister ? (
            <>
              <div className="auth-divider">
                <span>or</span>
              </div>
              <GoogleSignIn
                clientId={googleClientId}
                portal={portal}
                onSuccess={googleSuccess}
                onError={googleError}
              />
            </>
          ) : null}

          {canRegister ? (
            <p className="auth-switch">
              {mode === "signin" ? (
                <>
                  New to Smart Waste?{" "}
                  <button type="button" className="link-button" onClick={() => setMode("register")}>
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button type="button" className="link-button" onClick={() => setMode("signin")}>
                    Sign in
                  </button>
                </>
              )}
            </p>
          ) : null}

          <div className="auth-other">
            {otherPortals.map((key) => (
              <Link key={key} to={portalPath(key)}>
                {PORTALS[key].title}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
