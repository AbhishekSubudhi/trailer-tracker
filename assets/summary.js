// ---------------------------------------------------------------------------
// Page 1: Summary / Landing page
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  renderHeroStats();
  renderAlertBanner();
  renderKpiRow();
  renderOrderSummary();
  renderMap();
  renderDelayedPanel();
  renderFleetMixPanel();
  renderPerformancePanel();
});

// -------------------- Hero stats --------------------
function renderHeroStats() {
  const slot = document.getElementById("hero-stats");
  const active = TRAILERS.filter(t => t.status !== "Available").length;
  const exceptions = TRAILERS.filter(t => t.subStatus === "Exception").length;
  const pct = Math.round((active / TRAILERS.length) * 100);
  slot.innerHTML = `
    <div class="hero-stat"><div class="hero-stat-value">${TRAILERS.length}</div><div class="hero-stat-label">Total Trailers</div></div>
    <div class="hero-stat"><div class="hero-stat-value">${pct}%</div><div class="hero-stat-label">Utilization</div></div>
    <div class="hero-stat"><div class="hero-stat-value">${exceptions}</div><div class="hero-stat-label">Exceptions</div></div>
  `;
}

function countBy(list, keyFn) {
  const map = {};
  list.forEach(item => {
    const k = keyFn(item);
    map[k] = (map[k] || 0) + 1;
  });
  return map;
}

// -------------------- Alert banner --------------------
function renderAlertBanner() {
  const exceptions = TRAILERS.filter(t => t.subStatus === "Exception").length;
  const delayed = TRAILERS.filter(t => t.subStatus === "Delayed").length;
  const slot = document.getElementById("alert-slot");
  if (exceptions + delayed === 0) return;
  slot.innerHTML = `
    <div class="alert-banner">
      ${navIcon("alert-triangle")}
      <span><b>${exceptions}</b> trailer${exceptions !== 1 ? "s" : ""} flagged as <b>Exception</b> and
      <b>${delayed}</b> currently <b>Delayed</b> in-transit — review in
      <a href="trailers.html?status=In-Transit" class="link">Trailer View</a>.</span>
    </div>`;
}

// -------------------- KPI cards --------------------
const STATUS_ICON = { "Available": "check-circle", "Assigned": "package", "In-Transit": "navigation" };

function renderKpiRow() {
  const row = document.getElementById("kpi-row");
  row.innerHTML = STATUS_ORDER.map(status => {
    const subList = SUBSTATUS_BY_STATUS[status];
    const trailersInStatus = TRAILERS.filter(t => t.status === status);
    const color = STATUS_COLOR[status];
    const subCounts = countBy(trailersInStatus, t => t.subStatus);
    const pct = Math.round((trailersInStatus.length / TRAILERS.length) * 100);
    return `
      <div class="panel kpi-card" data-status="${status}">
        <svg class="kpi-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        <div class="kpi-card-body">
          <div class="kpi-label">${status}</div>
          <div class="kpi-value">${trailersInStatus.length}</div>
          <div class="kpi-progress">
            <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${pct}%;background:${color}"></div></div>
            <div class="kpi-progress-label">${pct}% of fleet</div>
          </div>
        </div>
        <div class="kpi-icon-badge" style="background:${color}1a;color:${color}">${navIcon(STATUS_ICON[status])}</div>
        <div class="kpi-sub-list">
          ${subList.map(sub => {
            const c = subCounts[sub] || 0;
            const subColor = SUBSTATUS_COLOR[sub];
            return `<a class="kpi-sub-row" href="trailers.html?status=${encodeURIComponent(status)}&sub=${encodeURIComponent(sub)}" style="text-decoration:none;color:inherit">
              <span class="kpi-sub-name"><span class="dot" style="background:${subColor}"></span>${sub}</span>
              <span class="kpi-sub-count">${c}</span>
            </a>`;
          }).join("")}
        </div>
      </div>`;
  }).join("");

  row.querySelectorAll(".kpi-card").forEach(card => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".kpi-sub-list")) return;
      card.classList.toggle("open");
    });
  });
}

// -------------------- Order summary (new orders pool) --------------------
// Framed around what a fleet manager actually needs to triage the incoming
// queue: how urgent it is, how much needs a human look, and — the key
// operational question — whether there's enough of the right trailer type
// sitting idle right now to actually cover this demand.
function renderOrderSummary() {
  const panel = document.getElementById("order-summary-panel");
  const total = ORDERS.length;
  const byPriority = countBy(ORDERS, o => o.priority);
  const byType = countBy(ORDERS, o => o.type);
  const byDest = countBy(ORDERS, o => o.destination);
  const totalWeight = ORDERS.reduce((s, o) => s + o.weight, 0);
  const avgDistance = Math.round(ORDERS.reduce((s, o) => s + o.distance, 0) / total);
  const topDest = Object.entries(byDest).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const REVIEW_THRESHOLD = 80;
  const recs = typeof ORDER_RECOMMENDATIONS !== "undefined" ? ORDER_RECOMMENDATIONS : null;
  const needsReview = recs
    ? ORDERS.filter(o => { const r = recs[o.id] || []; return r.length === 0 || r[0].accuracy < REVIEW_THRESHOLD; }).length
    : null;

  const availByType = countBy(TRAILERS.filter(t => t.status === "Available"), t => t.type);
  const types = Object.keys(byType).sort((a, b) => byType[b] - byType[a]);

  panel.innerHTML = `
    <div class="panel-title-row">
      <div class="panel-title">New Order Summary</div>
      <a href="orders.html" class="link" style="font-size:12px">View all →</a>
    </div>
    <div class="panel-body">
      <div class="stat-line"><span>Urgent (P1)</span><span class="n" style="color:#e5484d">${fmtNum(byPriority.P1 || 0)}</span></div>
      ${needsReview !== null ? `<div class="stat-line"><span>Needs manual review</span><span class="n" style="color:#b97400">${fmtNum(needsReview)}</span></div>` : ""}
      <div class="stat-line"><span>Total weight (pool)</span><span class="n">${fmtNum(totalWeight)} kg</span></div>
      <div class="stat-line"><span>Avg. distance</span><span class="n">${fmtNum(avgDistance)} km</span></div>
      <div class="stat-line"><span>Unique destinations</span><span class="n">${Object.keys(byDest).length}</span></div>

      <div style="margin-top:16px;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--text-muted)">Trailer availability vs demand</div>
      <div style="margin-top:2px;font-size:10.5px;color:var(--text-faint)">Idle in the yard right now vs. orders needing that type</div>
      <div class="coverage-list" style="margin-top:8px">
        ${types.map(type => {
          const needed = byType[type];
          const avail = availByType[type] || 0;
          return `<div class="coverage-row">
            <span class="coverage-type">${type}</span>
            <span class="coverage-mid">${needed} orders</span>
            <span class="coverage-avail ${avail === 0 ? "critical" : ""}">${avail} available now</span>
          </div>`;
        }).join("")}
      </div>

      <div style="margin-top:16px;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--text-muted)">Top 3 destinations</div>
      <div style="margin-top:6px">
        ${topDest.map(([city, c]) => `<div class="stat-line"><span>${city}</span><span class="n">${c}</span></div>`).join("")}
      </div>
    </div>
  `;
}

// -------------------- Map view (Leaflet + CartoDB Positron basemap) --------------------
let mapActiveStatus = null; // null = All, else "Available" | "Assigned" | "In-Transit"
let leafletMap = null;
let markerLayer = null;

function renderMap() {
  const panel = document.getElementById("map-panel");

  const tabs = [{ status: null, label: "All" }, ...STATUS_ORDER.map(s => ({ status: s, label: s }))];

  panel.innerHTML = `
    <div class="panel-title-row">
      <div class="panel-title">Trailer Location Map</div>
      <span style="font-size:11.5px;color:var(--text-muted)">click a marker for details</span>
    </div>
    <div class="map-tabs" id="map-tabs">
      ${tabs.map(t => {
        const count = t.status ? TRAILERS.filter(x => x.status === t.status).length : TRAILERS.length;
        return `<div class="map-tab ${t.status === mapActiveStatus ? "active" : ""}" data-status="${t.status || ""}">
          ${t.status ? `<span class="dot" style="background:${STATUS_COLOR[t.status]}"></span>` : ""}
          ${t.label}<span class="count-chip">${count}</span>
        </div>`;
      }).join("")}
    </div>
    <div class="leaflet-map-wrap">
      <div id="leaflet-map"></div>
      <div class="map-floating-legend">
        ${STATUS_ORDER.map(s => `<span><span class="dot" style="background:${STATUS_COLOR[s]}"></span>${s}</span>`).join("")}
      </div>
    </div>
  `;

  document.getElementById("map-tabs").querySelectorAll(".map-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      mapActiveStatus = tab.dataset.status || null;
      document.querySelectorAll("#map-tabs .map-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      drawMapMarkers();
    });
  });

  initLeafletMap();
  drawMapMarkers();
}

function initLeafletMap() {
  leafletMap = L.map("leaflet-map", {
    zoomControl: true,
    scrollWheelZoom: false,
    attributionControl: true
  }).setView([24.6, 79.5], 5);

  // Esri's free, key-less "World Street Map" — colorful terrain/roads/labels like
  // classic OpenStreetMap, without OSM's own tile servers actively blocking this
  // app under their tile usage policy (403 "Access blocked").
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
    attribution: '&copy; <a href="https://www.esri.com">Esri</a>, HERE, Garmin, FAO, NOAA, USGS, OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(leafletMap);

  markerLayer = L.layerGroup().addTo(leafletMap);

  // Re-enable scroll zoom only once the user interacts with the map (avoids hijacking page scroll)
  leafletMap.on("focus", () => leafletMap.scrollWheelZoom.enable());
  leafletMap.on("blur", () => leafletMap.scrollWheelZoom.disable());
}

function badgeIcon(count, color, size) {
  const px = size || (count > 20 ? 34 : count > 5 ? 28 : 22);
  const fontSize = px > 28 ? 12.5 : px > 24 ? 11.5 : 10;
  return L.divIcon({
    className: "",
    html: `<div class="trailer-badge" style="width:${px}px;height:${px}px;font-size:${fontSize}px;background:${color}">${count}</div>`,
    iconSize: [px, px],
    iconAnchor: [px / 2, px / 2]
  });
}

function drawMapMarkers() {
  if (!markerLayer) return;
  markerLayer.clearLayers();

  const list = mapActiveStatus ? TRAILERS.filter(t => t.status === mapActiveStatus) : TRAILERS;

  const groups = {};
  list.forEach(t => {
    const city = t.currentLocationFinal || t.location;
    if (!groups[city]) groups[city] = [];
    groups[city].push(t);
  });

  Object.entries(groups).forEach(([city, trailersAtCity]) => {
    const coord = CITY_COORDS[city];
    if (!coord) return;
    const n = trailersAtCity.length;

    // Dominant status color for this cluster (or the active filter's color)
    const color = mapActiveStatus ? STATUS_COLOR[mapActiveStatus] : dominantStatusColor(trailersAtCity);

    const marker = L.marker(coord, { icon: badgeIcon(n, color) });

    const sample = trailersAtCity.slice(0, 6);
    const more = n - sample.length;
    const popupHtml = `
      <div class="map-popup-title">${city} <span style="color:#70757e;font-weight:600">· ${n} trailer${n !== 1 ? "s" : ""}</span></div>
      <div class="map-popup-list">
        ${sample.map(t => `<a href="trailer.html?id=${t.id}">${t.id} <span style="color:#a3a8b3">— ${t.status} · ${t.subStatus}</span></a>`).join("")}
      </div>
      ${more > 0 ? `<div class="map-popup-more">+${more} more at this location</div>` : ""}
    `;
    marker.bindPopup(popupHtml, { maxWidth: 260 });
    marker.addTo(markerLayer);
  });
}

function dominantStatusColor(list) {
  const counts = {};
  list.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
  let best = null, bestN = -1;
  Object.entries(counts).forEach(([status, n]) => { if (n > bestN) { best = status; bestN = n; } });
  return STATUS_COLOR[best] || "#70757e";
}

// -------------------- Delayed / exception trailers panel --------------------
function renderDelayedPanel() {
  const panel = document.getElementById("delayed-panel");
  const flagged = TRAILERS.filter(t => t.status === "In-Transit" && (t.subStatus === "Delayed" || t.subStatus === "Exception"))
    .sort((a, b) => b.totalDelay - a.totalDelay)
    .slice(0, 8);

  panel.innerHTML = `
    <div class="panel-title-row">
      <div class="panel-title">Delayed & Exception Trailers</div>
      <a href="trailers.html?status=In-Transit&sub=Delayed" class="link" style="font-size:12px">View all →</a>
    </div>
    <div class="panel-body table-scroll" style="padding:6px 10px">
      ${flagged.length === 0 ? `<div class="empty-state">No delayed trailers right now.</div>` : `
      <table>
        <thead><tr><th>Trailer</th><th>Route</th><th>Sub Status</th><th>Delay</th><th>Last Update</th></tr></thead>
        <tbody>
          ${flagged.map(t => `
            <tr onclick="window.location.href='trailer.html?id=${t.id}'" style="cursor:pointer">
              <td><span class="link">${t.id}</span></td>
              <td>Noida → ${t.destination}</td>
              <td>${subStatusBadge(t.subStatus)}</td>
              <td><span class="delay-tag delay-bad">${fmtDuration(t.totalDelay)}</span></td>
              <td>${timeAgo(t.lastUpdated)}</td>
            </tr>`).join("")}
        </tbody>
      </table>`}
    </div>
  `;
}

// -------------------- Fleet mix panel --------------------
function renderFleetMixPanel() {
  const panel = document.getElementById("fleet-mix-panel");
  const byType = countBy(TRAILERS, t => t.type);
  const bySize = countBy(TRAILERS, t => t.size);
  const total = TRAILERS.length;
  const typeColors = { Flatbed: "#14b8a6", Reefer: "#5b8def", Container: "#5b8def", "Dry Van": "#f5a623" };

  panel.innerHTML = `
    <div class="panel-title-row">
      <div class="panel-title">Fleet Composition</div>
      <span style="font-size:11.5px;color:var(--text-muted)">${total} trailers</span>
    </div>
    <div class="panel-body">
      <div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--text-muted)">By type</div>
      <div class="mini-bars" style="margin-top:8px">
        ${Object.entries(byType).map(([type, c]) => {
          const pct = Math.round((c / total) * 100);
          return `<div class="mini-bar-row">
            <div class="mini-bar-label"><span>${type}</span><span>${c} (${pct}%)</span></div>
            <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${pct}%;background:${typeColors[type]}"></div></div>
          </div>`;
        }).join("")}
      </div>
      <div style="margin-top:16px;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--text-muted)">By size</div>
      <div class="mini-bars" style="margin-top:8px">
        ${Object.entries(bySize).sort().map(([size, c]) => {
          const pct = Math.round((c / total) * 100);
          return `<div class="mini-bar-row">
            <div class="mini-bar-label"><span>${size}</span><span>${c} (${pct}%)</span></div>
            <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${pct}%;background:#70757e"></div></div>
          </div>`;
        }).join("")}
      </div>
    </div>
  `;
}

// -------------------- Performance snapshot panel --------------------
function renderPerformancePanel() {
  const panel = document.getElementById("performance-panel");
  const inTransit = TRAILERS.filter(t => t.status === "In-Transit");
  const onTime = inTransit.filter(t => t.subStatus === "On Time").length;
  const onTimePct = inTransit.length ? Math.round((onTime / inTransit.length) * 100) : 0;
  const delayedTrailers = TRAILERS.filter(t => t.totalDelay > 0);
  const avgDelay = delayedTrailers.length
    ? Math.round(delayedTrailers.reduce((s, t) => s + t.totalDelay, 0) / delayedTrailers.length)
    : 0;
  const exceptions = TRAILERS.filter(t => t.subStatus === "Exception").length;
  const avgUtil = Math.round(
    TRAILERS.filter(t => t.currentLoad > 0).reduce((s, t) => s + (t.currentLoad / t.capacity), 0) /
    Math.max(1, TRAILERS.filter(t => t.currentLoad > 0).length) * 100
  );

  const rows = [
    { label: "On-time in-transit", value: `${onTimePct}%`, color: onTimePct >= 60 ? "#0f9e8e" : "#e5484d" },
    { label: "Avg. delay (delayed trailers)", value: fmtDuration(avgDelay), color: "#b97400" },
    { label: "Active exceptions", value: exceptions, color: "#e5484d" },
    { label: "Avg. load utilization", value: `${avgUtil}%`, color: "#3f6fd8" }
  ];

  panel.innerHTML = `
    <div class="panel-title-row">
      <div class="panel-title">Performance Snapshot</div>
    </div>
    <div class="panel-body">
      ${rows.map(r => `
        <div class="stat-line">
          <span>${r.label}</span>
          <span class="n" style="color:${r.color}">${r.value}</span>
        </div>`).join("")}
      <div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--border);font-size:11.5px;color:var(--text-muted)">
        Based on live status of all 500 trailers in the Noida corridor.
      </div>
    </div>
  `;
}
