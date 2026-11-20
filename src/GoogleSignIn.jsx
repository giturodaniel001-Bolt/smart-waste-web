import React, { useEffect, useRef } from "react";
import { api } from "./api";

let scriptPromise = null;

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-google-gsi]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google script failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleGsi = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google script failed"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6.1C12.3 13.3 17.6 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v7.8h12.7c-.3 2.1-1.6 5.2-4.7 7.3l7.6 5.9c4.5-4.2 6.5-10.3 6.5-16.9z"
      />
      <path
        fill="#FBBC05"
        d="M10.4 28.6A14.6 14.6 0 0 1 9.6 24c0-1.6.3-3.2.8-4.6l-7.8-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.8-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.2 0 11.4-2 15.2-5.6l-7.6-5.9c-2 1.4-4.7 2.4-7.6 2.4-6.4 0-11.7-3.8-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

export default function GoogleSignIn({ clientId, portal, onSuccess, onError }) {
  const slot = useRef(null);
  const handlers = useRef({ onSuccess, onError });
  handlers.current = { onSuccess, onError };

  useEffect(() => {
    if (!clientId || !slot.current) return undefined;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !slot.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            if (!response?.credential) {
              handlers.current.onError("Google did not return a credential.");
              return;
            }
            try {
              const data = await api.googleLogin(response.credential, portal);
              handlers.current.onSuccess(data);
            } catch (err) {
              handlers.current.onError(err.message || "Google sign-in failed.");
            }
          },
        });
        const width = Math.max(200, Math.min(320, slot.current.clientWidth || 320));
        window.google.accounts.id.renderButton(slot.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width,
        });
      })
      .catch(() => {
        if (!cancelled) handlers.current.onError("Could not load Google sign-in. Check your connection.");
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, portal]);

  if (!clientId) {
    return (
      <div className="google-block">
        <button type="button" className="google-btn" disabled>
          <GoogleMark /> Continue with Google
        </button>
        <p className="google-hint">
          Google sign-in is not configured yet. Add GOOGLE_CLIENT_ID to the backend .env.
        </p>
      </div>
    );
  }

  return <div className="google-slot" ref={slot} />;
}
