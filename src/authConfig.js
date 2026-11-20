export const PORTALS = {
  household: {
    key: "household",
    title: "Household portal",
    short: "Households",
    signInTitle: "Welcome home",
    subtitle: "Request pickups, track your smart bin, earn rewards and report illegal dumping.",
    accent: "#2E7D32",
    accentSoft: "#E8F5E9",
    icon: "home",
  },
  authority: {
    key: "authority",
    title: "Authority dashboard",
    short: "Authorities",
    signInTitle: "City operations",
    subtitle: "Monitor collection performance, triage dumping reports and manage waste operations.",
    accent: "#1565C0",
    accentSoft: "#E3F2FD",
    icon: "city",
  },
  hub_operator: {
    key: "hub_operator",
    title: "Hub operator portal",
    short: "Hub operators",
    signInTitle: "Hub operations",
    subtitle: "Record waste deliveries and review what has been received at your hub.",
    accent: "#00695C",
    accentSoft: "#E0F2F1",
    icon: "hub",
  },
};

export const ROLE_LABELS = {
  household: "Household",
  authority: "Authority",
  admin: "Authority admin",
  hub_operator: "Hub operator",
  collector: "Collector",
};

const PORTAL_ROLES = {
  household: ["household"],
  authority: ["authority", "admin"],
  hub_operator: ["hub_operator"],
};

export function roleAllowed(portal, role) {
  return (PORTAL_ROLES[portal] || []).includes(role);
}

export function portalForRole(role) {
  if (role === "household") return "household";
  if (role === "hub_operator") return "hub_operator";
  return "authority";
}

export function portalPath(portal) {
  if (portal === "hub_operator") return "/hub";
  return `/${portal}`;
}
