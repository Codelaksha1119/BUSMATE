import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/*
 * BUSMATE tracking prototype
 * - Bus 301: requests road-following geometry from the public OSRM demo service.
 * - Other routes: use a clearly labelled illustrative line until stop coordinates
 *   and road geometry are supplied.
 * - The moving marker is simulated, not a real GPS position.
 */

// Custom BUSMATE bus marker instead of Leaflet's default pin.
const busIcon = L.divIcon({
  className: "busmate-bus-marker",
  html: `<div style="width:42px;height:42px;border-radius:14px;background:#1457d9;border:3px solid #ffffff;box-shadow:0 3px 12px #102a4355;display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:23px;line-height:1">🚌</div>`,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
  popupAnchor: [0, -22],
});

const cityData = {
  Tumkur: [
    { no: "201", route: "Kyathsandra – Tumkur – Heggere", km: 13.3, kmLabel: "13.30", time: "", from: "Kyathsandra", to: "Heggere" },
    { no: "202", route: "Shettihalli – Tumkur – Yellapura", km: 10.7, kmLabel: "10.70", time: "", from: "Shettihalli", to: "Yellapura" },
    { no: "203", route: "Oorukere – Tumkur – MaralurDinne", km: 11.5, kmLabel: "11.50", time: "", from: "Oorukere", to: "MaralurDinne" },
    { no: "201D/1", route: "Tumkur – DC Office – Siddaganga Mutt", km: 8.2, kmLabel: "08.20", time: "", from: "Tumkur", to: "Siddaganga Mutt" },
    { no: "204", route: "Gangasandra – Tumkur – Belagumba", km: 12, kmLabel: "12.00", time: "", from: "Gangasandra", to: "Belagumba" },
    { no: "Not provided", route: "Tumkur – SIT Back gate – Devarayapatna", km: 6.7, kmLabel: "06.70", time: "", from: "Tumkur", to: "Devarayapatna" },
    { no: "201B/1", route: "Tumkur – SIT Back gate – Kyathsandra", km: 7, kmLabel: "07.00", time: "", from: "Tumkur", to: "Kyathsandra" },
    { no: "205", route: "Tumkur – Upparahalli – Goolarive", km: 5.5, kmLabel: "05.50", time: "", from: "Tumkur", to: "Goolarive" },
    { no: "203D/1", route: "Oorukere – Tumkur – Ramakrishna Aashrama – MaralurDinne", km: 11.9, kmLabel: "11.90", time: "", from: "Oorukere", to: "MaralurDinne" },
    { no: "205D/1", route: "Tumkur – Upparahalli – Jayanagara", km: 5.5, kmLabel: "05.50", time: "", from: "Tumkur", to: "Jayanagara" },
    { no: "206", route: "Tumkur – Gulur – Ethenahalli", km: 9.4, kmLabel: "09.40", time: "", from: "Tumkur", to: "Ethenahalli" },
    { no: "207", route: "Tumkur – Baddihalli/Honnenahalli", km: null, kmLabel: "5.5 / 6.7", time: "", from: "Tumkur", to: "Baddihalli/Honnenahalli" },
    { no: "208", route: "Tumkur – Bellavi", km: 14.8, kmLabel: "14.80", time: "", from: "Tumkur", to: "Bellavi" },
    { no: "205/3", route: "Goolarive – Tumkur – Dibbur", km: 9, kmLabel: "09.00", time: "", from: "Goolarive", to: "Dibbur" },
    { no: "205/4", route: "Goolarive – Tumkur – Swandenahally", km: 14.5, kmLabel: "14.50", time: "", from: "Goolarive", to: "Swandenahally" },
    { no: "209", route: "Tumkur – Kesaramadu", km: 10, kmLabel: "10.00", time: "", from: "Tumkur", to: "Kesaramadu" },
    { no: "301", route: "Tumkur – Caltex – Bhimsandra – Heggere – Mallasandra – Gubbi – Nittur", km: null, kmLabel: "Not provided", time: "", from: "Tumkur", to: "Nittur", stops: ["Tumkur", "Caltex", "Bhimsandra", "Heggere", "Mallasandra", "Gubbi", "Nittur"] },
  ],
  Mysore: [
    ...["0700", "0825", "0905", "1010", "1400", "1430", "1615", "1705", "1830", "1945"].map((time) => ({ no: "Not provided", route: "CITY BUS STAND – SUB ADAKANAHALLIHUNDI – HOSAHUNDI", km: null, kmLabel: "Not provided", time, from: "CITY BUS STAND", to: "HOSAHUNDI", serviceClass: "Not provided", via: "SUB ADAKANAHALLIHUNDI" })),
    ...["0600", "0850", "1500", "1740", "2025"].map((time) => ({ no: "Not provided", route: "CITY BUS STAND – AHALYA – UDBURU", km: null, kmLabel: "Not provided", time, from: "CITY BUS STAND", to: "UDBURU", serviceClass: "ORD", via: "AHALYA" })),
    ...["0635", "0800", "0905", "1040", "1200", "1325", "1510"].map((time) => ({ no: "Not provided", route: "CITY BUS STAND – AMBEDKARCOLON – TRIVENI CIRCLE", km: null, kmLabel: "Not provided", time, from: "CITY BUS STAND", to: "TRIVENI CIRCLE", serviceClass: "CITY", via: "AMBEDKARCOLON" })),
  ],
  Davangere: [
    { no: "1", route: "Sriramnagar – Karur", km: 13, kmLabel: "13", time: "", from: "Sriramnagar", to: "Karur" },
    { no: "2", route: "Shamanur – University", km: 16, kmLabel: "16", time: "", from: "Shamanur", to: "University" },
    { no: "3", route: "Davangere – Harihara", km: 14, kmLabel: "14", time: "", from: "Davangere", to: "Harihara" },
    { no: "4", route: "Vidyanagara – Davangere University", km: 16, kmLabel: "16", time: "", from: "Vidyanagara", to: "Davangere University" },
  ],
};

const bus301Stops = [
  { name: "Tumkur", position: [13.34116, 77.10252] },
  { name: "Caltex", position: [13.33980, 77.09680] },
  { name: "Bhimsandra", position: [13.34544, 77.07084] },
  { name: "Heggere", position: [13.34438, 77.04805] },
  { name: "Mallasandra", position: [13.33656, 77.01649] },
  { name: "Gubbi", position: [13.30970, 76.94338] },
  { name: "Nittur", position: [13.32223, 76.86152] },
];

const centers = {
  Tumkur: [13.3409, 77.1010],
  Mysore: [12.2958, 76.6394],
  Davangere: [14.4644, 75.9218],
};

const tiles = {
  Default: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
  },
  Satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  Terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap",
  },
};

function stopsFor(route) {
  if (!route) return [];
  if (Array.isArray(route.stops)) return route.stops;
  return String(route.route || route).split(" – ").map((stop) => stop.trim());
}

function FitMapToRoute({ positions }) {
  const map = useMap();

  useEffect(() => {
    if (positions?.length) {
      map.fitBounds(positions, { padding: [28, 28], maxZoom: 14 });
    }
  }, [map, positions]);

  return null;
}

function interpolateRoute(points, progress) {
  if (!points?.length) return null;
  if (points.length === 1) return points[0];

  // Calculate each segment's approximate length in map coordinates so marker
  // movement looks reasonably uniform even when geometry points are uneven.
  const lengths = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const dy = points[i + 1][0] - points[i][0];
    const dx = (points[i + 1][1] - points[i][1]) * Math.cos((points[i][0] * Math.PI) / 180);
    const length = Math.sqrt(dx * dx + dy * dy);
    lengths.push(length);
    total += length;
  }
  if (!total) return points[0];

  let target = Math.min(1, Math.max(0, progress)) * total;
  for (let i = 0; i < lengths.length; i += 1) {
    if (target <= lengths[i] || i === lengths.length - 1) {
      const ratio = lengths[i] ? target / lengths[i] : 0;
      return [
        points[i][0] + (points[i + 1][0] - points[i][0]) * ratio,
        points[i][1] + (points[i + 1][1] - points[i][1]) * ratio,
      ];
    }
    target -= lengths[i];
  }
  return points[points.length - 1];
}

function getStopProgresses(points, stops) {
  if (!points?.length || points.length < 2 || !stops?.length) return stops.map((_, i) => i / Math.max(1, stops.length - 1));
  const cumulative = [0];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const meanLat = ((points[i][0] + points[i + 1][0]) / 2) * Math.PI / 180;
    const dy = points[i + 1][0] - points[i][0];
    const dx = (points[i + 1][1] - points[i][1]) * Math.cos(meanLat);
    total += Math.sqrt(dx * dx + dy * dy);
    cumulative.push(total);
  }
  if (!total) return stops.map((_, i) => i / Math.max(1, stops.length - 1));

  return stops.map((stop) => {
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    points.forEach((point, index) => {
      const meanLat = ((point[0] + stop.position[0]) / 2) * Math.PI / 180;
      const dy = point[0] - stop.position[0];
      const dx = (point[1] - stop.position[1]) * Math.cos(meanLat);
      const distance = dx * dx + dy * dy;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    return cumulative[nearestIndex] / total;
  });
}

function MapView({ city, bus, expanded = false, onProgress }) {
  const is301 = city === "Tumkur" && String(bus?.no) === "301";
  const center = centers[city] || centers.Tumkur;
  const anchorPositions = is301 ? bus301Stops.map((stop) => stop.position) : [];
  const [routeLine, setRouteLine] = useState(anchorPositions);
  const [routeStatus, setRouteStatus] = useState(is301 ? "Loading road route…" : "Illustrative route preview");
  const [layer, setLayer] = useState("Default");
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [cycleSeconds, setCycleSeconds] = useState(15);

  // Fetch actual road-following geometry for Bus 301.
  useEffect(() => {
    let cancelled = false;

    setProgress(0);
    setIsPlaying(true);

    if (!is301) {
      const fallback = [
        [center[0] - 0.012, center[1] - 0.012],
        [center[0] - 0.004, center[1] - 0.003],
        [center[0] + 0.004, center[1] + 0.005],
        [center[0] + 0.012, center[1] + 0.012],
      ];
      setRouteLine(fallback);
      setRouteStatus("Illustrative route preview · coordinates not supplied");
      return () => { cancelled = true; };
    }

    const coords = bus301Stops
      .map((stop) => `${stop.position[1]},${stop.position[0]}`)
      .join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;

    setRouteLine(anchorPositions);
    setRouteStatus("Loading road route…");

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("Routing service unavailable");
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        const coordinates = data?.routes?.[0]?.geometry?.coordinates;
        if (!coordinates?.length) throw new Error("No road route returned");
        setRouteLine(coordinates.map(([lon, lat]) => [lat, lon]));
        setRouteStatus("Road route loaded · demo stop coordinates");
      })
      .catch(() => {
        if (cancelled) return;
        setRouteLine(anchorPositions);
        setRouteStatus("Road routing unavailable · moving along stop-anchor preview");
      });

    return () => { cancelled = true; };
  }, [is301, city]);

  // Simulated movement: travel from route start to end, then loop.
  // Replace this progress state with a GPS/API position when real GPS is added.
  useEffect(() => {
    if (!isPlaying || routeLine.length < 2) return undefined;

    const tickMs = 250;
    const step = tickMs / (cycleSeconds * 1000);
    const timer = window.setInterval(() => {
      setProgress((previous) => {
        const next = previous + step;
        return next >= 1 ? 0 : next;
      });
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, routeLine, cycleSeconds]);

  const busPosition = useMemo(
    () => interpolateRoute(routeLine, progress) || center,
    [routeLine, progress, center]
  );

  const passedRoute = useMemo(() => {
    if (routeLine.length < 2) return [];
    const pointCount = Math.max(2, Math.ceil(progress * (routeLine.length - 1)) + 1);
    return routeLine.slice(0, pointCount);
  }, [routeLine, progress]);

  const progressPercent = Math.round(progress * 100);

  // Use each stop's nearest point on the actual route geometry, so the timeline
  // advances when the simulated bus reaches that stop's part of the route.
  const stopProgresses = useMemo(
    () => getStopProgresses(routeLine, bus301Stops),
    [routeLine]
  );
  const currentStopIndex = is301
    ? stopProgresses.reduce((current, stopProgress, index) => (progress >= stopProgress ? index : current), 0)
    : Math.min(Math.max(0, stopsFor(bus).length - 1), Math.floor(progress * Math.max(1, stopsFor(bus).length - 1)));
  const nextStopIndex = Math.min((is301 ? bus301Stops.length : Math.max(1, stopsFor(bus).length)) - 1, currentStopIndex + 1);

  useEffect(() => {
    if (typeof onProgress === "function") onProgress(progress, currentStopIndex);
  }, [progress, currentStopIndex, onProgress]);

  return (
    <div className={`map-wrap ${expanded ? "expanded" : ""}`} style={{ position: "relative" }}>
      <div
        className="busmate-map-layers"
        style={{
          position: "absolute", zIndex: 1000, top: 10, right: 10, display: "flex",
          flexWrap: "wrap", gap: 4, background: "#fff", padding: 5, borderRadius: 8,
          boxShadow: "0 1px 5px #0003",
        }}
      >
        {Object.keys(tiles).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setLayer(name)}
            style={{
              border: layer === name ? "1px solid #2878f0" : "1px solid #ddd",
              background: layer === name ? "#eaf2ff" : "#fff",
              borderRadius: 5, padding: "6px 8px", fontSize: 12, cursor: "pointer",
            }}
          >
            {name}
          </button>
        ))}
      </div>

      <MapContainer
        center={is301 ? bus301Stops[0].position : center}
        zoom={12}
        scrollWheelZoom
        key={`${city}-${String(bus?.no)}-${expanded}`}
        style={{ height: expanded ? "600px" : "360px", width: "100%" }}
      >
        <TileLayer attribution={tiles[layer].attribution} url={tiles[layer].url} />
        {routeLine.length > 1 && (
          <>
            <Polyline positions={routeLine} pathOptions={{ color: "#2878f0", weight: 5, opacity: 0.85 }} />
            {passedRoute.length > 1 && (
              <Polyline positions={passedRoute} pathOptions={{ color: "#12a875", weight: 5, opacity: 0.95 }} />
            )}
          </>
        )}

        {is301 && bus301Stops.map((stop, index) => (
          <Marker key={stop.name} position={stop.position}>
            <Popup>
              <strong>{index + 1}. {stop.name}</strong>
              <br />Bus 301 route stop
              <br /><small>Demo coordinate; verify exact stop location.</small>
            </Popup>
          </Marker>
        ))}

        {bus && (
          <Marker position={busPosition} icon={busIcon}>
            <Popup>
              <strong>Bus {bus.no}</strong>
              <br />Simulated location — not live GPS
              <br />Route progress: {progressPercent}%
            </Popup>
          </Marker>
        )}

        <FitMapToRoute positions={routeLine.length ? routeLine : [center]} />
      </MapContainer>

      <style>{`
        .map-wrap .busmate-info-panel,
        .map-wrap .busmate-controls-panel,
        .map-wrap .busmate-route-status,
        .map-wrap .busmate-map-legend {
          display: block !important; width: 100% !important; max-width: 100% !important;
          box-sizing: border-box !important; font-family: Arial, Helvetica, sans-serif !important;
          font-size: 14px !important; font-weight: 400; letter-spacing: normal !important;
          word-spacing: normal !important; line-height: 1.6 !important;
          text-transform: none !important; writing-mode: horizontal-tb !important;
          white-space: normal !important; word-break: normal !important;
          overflow-wrap: anywhere !important; text-align: left !important;
          transform: none !important; text-orientation: mixed !important;
        }
        .map-wrap .busmate-info-panel *,
        .map-wrap .busmate-controls-panel *,
        .map-wrap .busmate-route-status *,
        .map-wrap .busmate-map-legend * {
          font-family: Arial, Helvetica, sans-serif !important;
          letter-spacing: normal !important; word-spacing: normal !important;
          text-transform: none !important; writing-mode: horizontal-tb !important;
          white-space: normal !important; word-break: normal !important;
          overflow-wrap: anywhere !important; line-height: 1.6 !important;
          transform: none !important; text-orientation: mixed !important;
        }
        .map-wrap .busmate-controls-panel { display: flex !important; flex-flow: row wrap !important; align-items: center !important; gap: 12px !important; }
        .map-wrap .busmate-controls-panel button, .map-wrap .busmate-controls-panel select { min-height: 40px; }
        .map-wrap .busmate-route-status span, .map-wrap .busmate-map-legend span { display: block !important; margin: 4px 0 !important; }
      `}</style>
      <div
        className="busmate-info-panel"
        style={{
          display: "block", boxSizing: "border-box", width: "100%",
          padding: "12px 14px", margin: "10px 0 8px", lineHeight: 1.6,
          fontSize: 14, fontFamily: "Arial, sans-serif", letterSpacing: "normal",
          textTransform: "none", whiteSpace: "normal", overflowWrap: "break-word",
          wordBreak: "normal", clear: "both", color: "#172033",
          background: "#f3f7ff", border: "1px solid #d7e4ff", borderRadius: 10,
        }}
      >
        <strong style={{ display: "block", marginBottom: 3, fontSize: 14 }}>Bus {bus?.no || "—"}: simulated tracking</strong>
        <span style={{ display: "block", fontSize: 12, color: "#536174" }}>The bus icon shows a demo position, not live GPS.</span>
      </div>

      <div
        className="busmate-controls-panel"
        style={{
          display: "flex", flexDirection: "row", alignItems: "center", gap: 10,
          flexWrap: "wrap", width: "100%", boxSizing: "border-box", padding: "12px",
          margin: "4px 0 10px", lineHeight: 1.6, overflow: "visible",
          fontFamily: "Arial, sans-serif", letterSpacing: "normal", textTransform: "none",
          background: "#ffffff", border: "1px solid #e1e7ef", borderRadius: 10,
        }}
      >
        <button type="button" onClick={() => setIsPlaying((playing) => !playing)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#f8fafc", color: "#172033", fontSize: 13, lineHeight: 1.4, fontFamily: "Arial, sans-serif", letterSpacing: "normal", whiteSpace: "normal", cursor: "pointer" }}>
          {isPlaying ? "Ⅱ Pause bus" : "▶ Resume bus"}
        </button>
        <button type="button" onClick={() => { setProgress(0); setIsPlaying(true); }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#f8fafc", color: "#172033", fontSize: 13, lineHeight: 1.4, fontFamily: "Arial, sans-serif", letterSpacing: "normal", whiteSpace: "normal", cursor: "pointer" }}>
          ↺ Restart route
        </button>
        <label style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, fontSize: 13, lineHeight: 1.5, fontFamily: "Arial, sans-serif", letterSpacing: "normal", color: "#172033" }}>
          Route duration
          <select
            value={cycleSeconds}
            onChange={(event) => setCycleSeconds(Number(event.target.value))}
            style={{ marginLeft: 0, padding: "7px 8px", maxWidth: "100%", border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff", color: "#172033", fontSize: 13 }}
          >
            <option value={30}>30 sec (fast demo)</option>
            <option value={60}>1 min</option>
            <option value={120}>2 min</option>
            <option value={180}>3 min</option>
          </select>
        </label>
        <span style={{ display: "inline-block", fontSize: 13, lineHeight: 1.5, color: "#536174", fontFamily: "Arial, sans-serif", letterSpacing: "normal", whiteSpace: "normal" }}>Progress: {progressPercent}%</span>
      </div>

      {is301 && (
        <div
          className="busmate-route-status"
          style={{
            position: "relative", zIndex: 900, display: "block", boxSizing: "border-box",
            width: "100%", background: "#f8fafc", padding: "10px 12px",
            margin: "4px 0 10px", border: "1px solid #e5e7eb", borderRadius: 8,
            fontSize: 13, lineHeight: 1.65, whiteSpace: "normal",
            overflowWrap: "break-word", wordBreak: "normal", color: "#344054",
            fontFamily: "Arial, sans-serif", letterSpacing: "normal", textTransform: "none",
          }}
        >
          <strong style={{ display: "block", marginBottom: 4 }}>Route status</strong>
          <span style={{ display: "block" }}>{routeStatus}</span>
          <span style={{ display: "block", marginTop: 4 }}>Next stop: <strong>{bus301Stops[nextStopIndex]?.name || "—"}</strong></span>
          <span style={{ display: "block", marginTop: 4 }}>Demo simulation only — no live GPS connected.</span>
        </div>
      )}
    </div>
  );
}

function formatTime(time) {
  if (!time) return "Not provided";
  const value = String(time);
  return value.length === 4 ? `${value.slice(0, 2)}:${value.slice(2)}` : value;
}

export default function App() {
  const [city, setCity] = useState("Tumkur");
  const [start, setStart] = useState("Tumkur");
  const [dest, setDest] = useState("Nittur");
  const [screen, setScreen] = useState(1);
  const [selected, setSelected] = useState(null);
  const [language, setLanguage] = useState("English");
  const [menu, setMenu] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [trackingProgress, setTrackingProgress] = useState(0);
  const [trackingStopIndex, setTrackingStopIndex] = useState(0);
  const handleTrackingProgress = useCallback((progress, stopIndex) => {
    setTrackingProgress(progress);
    setTrackingStopIndex(stopIndex);
  }, []);

  const routes = cityData[city] || cityData.Tumkur;
  const stops = useMemo(
    () => [...new Set(routes.flatMap((route) => [route.from, route.to, ...stopsFor(route)]))],
    [routes]
  );

  const matching = routes.filter((route) =>
    route.from === start ||
    route.to === dest ||
    route.route.toLowerCase().includes(start.toLowerCase()) ||
    route.route.toLowerCase().includes(dest.toLowerCase())
  );
  const list = matching.length ? matching : routes;

  const chooseCity = (value) => {
    setCity(value);
    setStart(cityData[value][0].from);
    setDest(cityData[value][0].to);
    setScreen(1);
    setSelected(null);
  };

  const t = language === "Kannada"
    ? { dashboard: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್", start: "ಪ್ರಾರಂಭದ ನಿಲ್ದಾಣ", dest: "ಗಮ್ಯಸ್ಥಾನ", ok: "ಬಸ್ ಹುಡುಕಿ", timetable: "ಬಸ್ ವೇಳಾಪಟ್ಟಿ", buses: "ಮಾರ್ಗದ ಬಸ್‌ಗಳು", details: "ಬಸ್ ವಿವರಗಳು" }
    : { dashboard: "Dashboard", start: "Starting stop", dest: "Destination", ok: "Find buses", timetable: "City Bus Timetable", buses: "Route Bus Details", details: "Bus Details" };

  return (
    <div className="app">
      <header>
        <button className="hamb" onClick={() => setMenu((open) => !open)} aria-label="Toggle menu">☰</button>
        <div className="brand-mark">B</div>
        <div>
          <div className="brand">BUSMATE</div>
          <div className="tag">NEVER GUESS. TRACK YOUR BUS.</div>
        </div>
        <div className="header-right"><span className="live-dot" /> DEMO MODE</div>
      </header>

      {menu && (
        <aside className="sidebar">
          <button onClick={() => { setScreen(1); setMenu(false); }}>{t.dashboard}</button>
          <label>Language</label>
          <select value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option>English</option>
            <option>Kannada</option>
          </select>
          <p className="muted small">BUSMATE · City buses only</p>
        </aside>
      )}

      <main>
        <div className="eyebrow">SMART CITIES &amp; MOBILITY <span>•</span> CITY BUS TRACKING</div>
        <div className="heading-row">
          <div>
            <h1>{screen === 1 ? t.dashboard : screen === 2 ? t.buses : t.details}</h1>
            <p className="sub">Find your bus, follow its route, and plan your journey.</p>
          </div>
          <div className="stepper">
            <span className={screen === 1 ? "active" : ""}>01 <small>SEARCH</small></span><i />
            <span className={screen === 2 ? "active" : ""}>02 <small>BUSES</small></span><i />
            <span className={screen === 3 ? "active" : ""}>03 <small>TRACK</small></span>
          </div>
        </div>

        {screen === 1 && (
          <>
            <section className="search-card">
              <div className="card-title">
                <span className="icon">⌖</span>
                <div><h2>Plan your journey</h2><p>Select your city and bus stops to get started.</p></div>
              </div>
              <div className="form-grid">
                <label>City
                  <select value={city} onChange={(event) => chooseCity(event.target.value)}>
                    {Object.keys(cityData).map((name) => <option key={name}>{name}</option>)}
                  </select>
                </label>
                <label>{t.start}
                  <select value={start} onChange={(event) => setStart(event.target.value)}>
                    {stops.map((stop) => <option key={stop}>{stop}</option>)}
                  </select>
                </label>
                <button className="swap" title="Swap stops" onClick={() => { setStart(dest); setDest(start); }}>⇅</button>
                <label>{t.dest}
                  <select value={dest} onChange={(event) => setDest(event.target.value)}>
                    {stops.map((stop) => <option key={stop}>{stop}</option>)}
                  </select>
                </label>
                <button className="primary" onClick={() => setScreen(2)}>{t.ok} <span>→</span></button>
              </div>
              <div className="search-foot">
                <span>◷ Estimated fare varies by route</span>
                <button className="text-btn" onClick={() => document.getElementById("timetable")?.scrollIntoView({ behavior: "smooth" })}>Update timetable ↗</button>
              </div>
            </section>

            <div className="stats">
              <div className="stat"><span className="stat-icon blue">▣</span><div><small>SELECTED CITY</small><strong>{city}</strong></div></div>
              <div className="stat"><span className="stat-icon green">↗</span><div><small>AVAILABLE ROUTES</small><strong>{routes.length} <em>demo routes</em></strong></div></div>
              <div className="stat"><span className="stat-icon orange">◷</span><div><small>NEXT STEP</small><strong>Find your bus</strong></div></div>
            </div>

            <section className="table-card" id="timetable">
              <div className="section-head">
                <div><h2>{t.timetable}</h2><p>Supplied route and timetable data for {city}. Missing fields are marked.</p></div>
                <span className="pill">{routes.length} RECORDS</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>BUS NO.</th><th>ROUTE</th><th>TIME</th><th>DISTANCE</th><th>FARE*</th><th /></tr></thead>
                  <tbody>
                    {routes.map((route, index) => (
                      <tr key={`${route.no}-${route.time}-${index}`}>
                        <td><span className="bus-number">{route.no}</span></td>
                        <td className="route-cell">{route.route}</td>
                        <td>{formatTime(route.time)}</td>
                        <td>{route.kmLabel ?? route.km}{route.km !== null ? " km" : ""}</td>
                        <td>Not provided</td>
                        <td><button className="row-btn" onClick={() => { setSelected(route); setStart(route.from); setDest(route.to); setScreen(2); }}>View →</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="note">Data source: information supplied for this BUSMATE project. “Not provided” means the original data did not include that field. Route geometry and fares require verification.</div>
            </section>
          </>
        )}

        {screen === 2 && (
          <>
            <div className="backline"><button className="back" onClick={() => setScreen(1)}>← Back to dashboard</button><span>{city} / {start} → {dest}</span></div>
            <div className="split">
              <section className="table-card bus-list">
                <div className="section-head"><div><h2>Available buses</h2><p>Select a bus to view its route and simulated movement.</p></div><span className="pill">{list.length} FOUND</span></div>
                {list.map((route, index) => (
                  <div className="bus-row" key={`${route.no}-${index}`}>
                    <div className="bus-badge">{route.no}</div>
                    <div className="bus-info">
                      <strong>{route.route}</strong>
                      <span>◷ {formatTime(route.time)} <i>•</i> {route.kmLabel ?? route.km}{route.km !== null ? " km" : ""}</span>
                      <small>Location: simulated demo position</small>
                    </div>
                    <button className="primary compact" onClick={() => { setSelected(route); setScreen(3); }}>Track →</button>
                  </div>
                ))}
              </section>
              <section className="table-card map-card">
                <div className="section-head"><div><h2>Route map</h2><p>Preview of the selected city.</p></div><button className="text-btn" onClick={() => setExpanded((value) => !value)}>{expanded ? "Collapse" : "Expand"} ↗</button></div>
                <MapView city={city} bus={selected || list[0]} expanded={expanded} />
                <div
                  className="busmate-map-legend"
                  style={{
                    display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 6,
                    boxSizing: "border-box", width: "100%", padding: "12px 14px", marginTop: 10,
                    lineHeight: 1.6, whiteSpace: "normal", overflowWrap: "break-word",
                    fontFamily: "Arial, sans-serif", fontSize: 13, letterSpacing: "normal",
                    textTransform: "none", color: "#243247", background: "#f8fafc",
                    border: "1px solid #e1e7ef", borderRadius: 10,
                  }}
                >
                  <strong style={{ display: "block" }}>Map legend</strong>
                  <span style={{ display: "block" }}>Blue line: planned route</span>
                  <span style={{ display: "block" }}>Green line: route already travelled in this simulation</span>
                  <span style={{ display: "block" }}>🚌 Bus icon: simulated bus position, not live GPS</span>
                </div>
              </section>
            </div>
          </>
        )}

        {screen === 3 && selected && (
          <>
            <div className="backline"><button className="back" onClick={() => setScreen(2)}>← Back to buses</button><span>Bus {selected.no} / {city}</span></div>
            <div className="detail-grid">
              <section className="table-card">
                <div className="section-head"><div><h2>Route timeline</h2><p>{selected.route}</p></div><span className="bus-number">{selected.no}</span></div>
                <div className="timeline">
                  {stopsFor(selected).map((stop, index, allStops) => {
                    const currentIndex = String(selected.no) === "301"
                      ? Math.min(allStops.length - 1, trackingStopIndex)
                      : Math.min(allStops.length - 1, Math.floor(trackingProgress * Math.max(1, allStops.length - 1)));
                    const stopState = index < currentIndex ? "passed" : index === currentIndex ? "current" : "upcoming";
                    const stopLabel = index === 0
                      ? "Starting point"
                      : index === allStops.length - 1
                        ? "Destination"
                        : stopState === "passed"
                          ? "Passed"
                          : stopState === "current"
                            ? "Bus is near this section"
                            : "Upcoming stop";
                    return (
                      <div className={`stop ${stopState}`} key={`${stop}-${index}`} style={{ display: "grid", gridTemplateColumns: "14px minmax(0, 1fr)", alignItems: "start", columnGap: 10, rowGap: 4, padding: "12px 10px", margin: "0 0 8px", borderRadius: 10, background: stopState === "current" ? "#edf4ff" : stopState === "passed" ? "#f0fbf6" : "#ffffff", border: stopState === "current" ? "1px solid #9fc2ff" : "1px solid #e7ebf0", boxSizing: "border-box", fontFamily: "Arial, sans-serif", letterSpacing: "normal", textTransform: "none", whiteSpace: "normal", overflowWrap: "break-word" }}>
                        <span className="stop-dot" style={{ display: "block", width: 10, height: 10, borderRadius: "50%", marginTop: 5 }} />
                        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}><strong style={{ display: "block", fontSize: 14, lineHeight: 1.4, overflowWrap: "break-word" }}>{stop}</strong><small style={{ display: "block", fontSize: 12, lineHeight: 1.5, color: "#536174" }}>{stopLabel}</small>
                        <time style={{ display: "block", fontSize: 11, lineHeight: 1.4, color: "#667085", marginTop: 2 }}>
                          {stopState === "passed"
                            ? "Passed"
                            : stopState === "current"
                              ? `${Math.round(trackingProgress * 100)}% route progress`
                              : index === 0
                                ? formatTime(selected.time)
                                : "Upcoming"}
                        </time></div>
                      </div>
                    );
                  })}
                </div>
                <div className="note">Arrival times are not connected to a live timetable in this prototype.</div>
              </section>
              <section className="table-card map-card">
                <div className="section-head"><div><h2>Track your bus</h2><p>Bus {selected.no} · simulated movement</p></div><button className="text-btn" onClick={() => setExpanded((value) => !value)}>{expanded ? "Collapse" : "Expand"} ↗</button></div>
                <MapView city={city} bus={selected} expanded={expanded} onProgress={handleTrackingProgress} />
                <div className="info-grid">
                  <div><small>LOCATION MODE</small><strong>Simulation</strong></div>
                  <div><small>ROUTE PROGRESS</small><strong>See map controls</strong></div>
                  <div><small>TRAVEL TIME</small><strong>{selected.km !== null ? `~${Math.round(selected.km * 3)} min (rough)` : "Not provided"}</strong></div>
                  <div><small>ESTIMATED FARE</small><strong>Not provided</strong></div>
                </div>
                <div className="note">Demo mode: no physical bus GPS is connected.</div>
              </section>
            </div>
          </>
        )}

        <footer><span>© 2026 BUSMATE</span><span>Built for smarter city mobility <b>•</b> Hackathon prototype</span></footer>
      </main>
    </div>
  );
}
