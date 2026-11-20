import React, { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import { STATUS_COLORS, STATUS_LABELS, REPORT_STATUS_LABELS, wasteList } from "./theme";

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) map.fitBounds(points, { padding: [30, 30], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length]);
  return null;
}

function binColor(b) {
  if (b.status === "offline" || b.last_fill_level == null) return "#9E9E9E";
  if (b.last_fill_level >= 80) return "#C62828";
  if (b.last_fill_level >= 50) return "#F9A825";
  return "#2E7D32";
}

export default function PickupMap({ pickups, hubs, bins = [], reports = [] }) {
  const withCoords = pickups.filter((p) => p.latitude != null && p.longitude != null);
  const hubsWithCoords = hubs.filter((h) => h.latitude != null && h.longitude != null);
  const binsWithCoords = bins.filter((b) => b.latitude != null && b.longitude != null);
  const reportsWithCoords = reports.filter((r) => r.latitude != null && r.longitude != null);
  const points = [
    ...withCoords.map((p) => [p.latitude, p.longitude]),
    ...hubsWithCoords.map((h) => [h.latitude, h.longitude]),
    ...binsWithCoords.map((b) => [b.latitude, b.longitude]),
    ...reportsWithCoords.map((r) => [r.latitude, r.longitude]),
  ];

  return (
    <MapContainer center={[0.02, 37.9]} zoom={6} style={{ height: 420, borderRadius: 12 }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />

      {withCoords.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.latitude, p.longitude]}
          radius={7}
          pathOptions={{ color: "#fff", weight: 1.5, fillColor: STATUS_COLORS[p.status] || "#666", fillOpacity: 0.9 }}
        >
          <Tooltip>
            <b>{p.household_name}</b>
            <br />
            {wasteList(p.waste_types)}
            <br />
            {STATUS_LABELS[p.status] || p.status}
          </Tooltip>
        </CircleMarker>
      ))}

      {binsWithCoords.map((b) => (
        <CircleMarker
          key={`bin-${b.id}`}
          center={[b.latitude, b.longitude]}
          radius={11}
          pathOptions={{ color: "#1F2937", weight: 3, fillColor: binColor(b), fillOpacity: 0.95 }}
        >
          <Tooltip>
            <b>Bin: {b.label || b.device_id}</b>
            <br />
            {b.last_fill_level == null ? "No readings yet" : `${b.last_fill_level}% full`}
            {b.status === "offline" && b.last_fill_level != null ? " (offline)" : ""}
          </Tooltip>
        </CircleMarker>
      ))}

      {reportsWithCoords.map((r) => (
        <CircleMarker
          key={`report-${r.id}`}
          center={[r.latitude, r.longitude]}
          radius={9}
          pathOptions={{ color: "#880E4F", weight: 2, fillColor: "#E91E63", fillOpacity: 0.95 }}
        >
          <Tooltip>
            <b>Dumping report</b>
            <br />
            {r.description || "No description"}
            <br />
            Reported by {r.reporter_name} {"\u00B7"} {REPORT_STATUS_LABELS[r.status] || r.status}
          </Tooltip>
        </CircleMarker>
      ))}

      {hubsWithCoords.map((h) => (
        <CircleMarker
          key={`hub-${h.id}`}
          center={[h.latitude, h.longitude]}
          radius={13}
          pathOptions={{ color: "#4A148C", weight: 3, fillColor: "#CE93D8", fillOpacity: 0.85 }}
        >
          <Tooltip permanent direction="top">
            Hub: {h.name}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
