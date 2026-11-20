import React, { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api, hasToken } from "./api";
import AuthPortal from "./AuthPortal.jsx";
import Dashboard from "./Dashboard.jsx";
import HouseholdView from "./HouseholdView.jsx";
import HubOperatorView from "./HubOperatorView.jsx";
import SignInPage from "./SignInPage.jsx";

const ALLOWED = ["authority", "admin", "household", "hub_operator"];
const BASENAME =
  import.meta.env.BASE_URL === "/"
    ? "/"
    : import.meta.env.BASE_URL.replace(/\/$/, "");

function ProtectedApp() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(hasToken());

  useEffect(() => {
    if (!hasToken()) {
      setChecking(false);
      return;
    }
    let active = true;
    api
      .me()
      .then((u) => {
        if (!active) return;
        if (ALLOWED.includes(u.role)) setUser(u);
        else api.logout();
      })
      .catch(() => {
        api.logout();
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
    navigate("/", { replace: true });
  }, [navigate]);

  if (checking) return <p className="center-note">Loading...</p>;
  if (!user) return <Navigate to="/" replace />;
  if (user.role === "household") return <HouseholdView user={user} onLogout={logout} />;
  if (user.role === "hub_operator") return <HubOperatorView user={user} onLogout={logout} />;
  return <Dashboard user={user} onLogout={logout} />;
}

export default function App() {
  return (
    <BrowserRouter basename={BASENAME}>
      <Routes>
        <Route path="/" element={<AuthPortal />} />
        <Route path="/household" element={<SignInPage portal="household" />} />
        <Route path="/authority" element={<SignInPage portal="authority" />} />
        <Route path="/hub" element={<SignInPage portal="hub_operator" />} />
        <Route path="/app" element={<ProtectedApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
