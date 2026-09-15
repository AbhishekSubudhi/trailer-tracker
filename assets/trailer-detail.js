// ---------------------------------------------------------------------------
// Page 3: Individual Trailer Tracking
// ---------------------------------------------------------------------------

const STAGE_KEYS = ["inspection", "loading", "dispatch", "inTransit", "arrived", "unloading", "released", "returned"];
const STAGE_LABEL = {
  inspection: "Inspection (Trailer Health)",
  loading: "Loading",
  dispatch: "Dispatched",
  inTransit: "In-Transit",
  arrived: "Arrived Destination",
  unloading: "Unloading",
  released: "Trailer Released",
  returned: "Return / Reposition"
};
const SUBSTATUS_TO_STAGE = {
  "Inspection Pending": "inspection", "Inspection Done": "inspection",
  "Loading": "loading", "Dispatch": "dispatch",
  "On Time": "inTransit", "Delayed": "inTransit", "Exception": "inTransit",
  "Arrived Destination": "arrived", "Unloading": "unloading", "Trailer Released": "released",
  "Return": "returned", "Reposition": "returned"
};

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const id = (params.get("id") || "").toUpperCase();
  const trailer = TRAILERS.find(t => t.id === id);
  const root = document.getElementById("detail-content");

  if (!trailer) {
    root.innerHTML = `
      <div class="panel">
        <div class="empty-state">
          ${navIcon("alert-triangle")}
          <div style="font-weight:700;margin-top:6px">Trailer not found</div>
          <div style="margin-top:4px">No trailer matches ID "${id || "(none)"}"</div>
          <div style="margin-top:14px"><a class="link" href="trailers.html">← Back to all trailers</a></div>
        </div>
      </div>`;
    return;
  }

  renderDetail(trailer);
});

function stageDone(trailer, key) {
  return !!trailer.stages[key].time;
}

function currentStageKey(trailer) {
  return SUBSTATUS_TO_STAGE[trailer.subStatus] || null;
}

function onTimeStatus(trailer) {
  if (trailer.totalDelay === 0) return { label: "On Time", color: "#15803d", bg: "#e3f9ea" };
  const severe = trailer.subStatus === "Exception" || trailer.totalDelay > 120;
  return {
    label: `Delayed · ${fmtDuration(trailer.totalDelay)}`,
    color: severe ? "#c22a2a" : "#a5670a",
    bg: severe ? "#fde8e8" : "#fef3d9"
  };
}

function renderDetail(trailer) {
  const root = document.getElementById("detail-content");
  const driver = mockDriver(trailer.id);
  const ontime = onTimeStatus(trailer);
  const curKey = currentStageKey(trailer);
  const curIdx = STAGE_KEYS.indexOf(curKey);
  const distance = trailer.destination !== "NA" ? haversineKm("Noida", trailer.destination) : null;
  const initials = driver.name.split(" ").map(w => w[0]).join("");

  root.innerHTML = `
    <div style="margin-bottom:12px">
      <a href="trailers.html" class="link" style="font-size:12.5px">← All trailers</a>
    </div>

    <div class="panel">
      <div class="detail-header">
        <div>
          <div class="detail-id-row">
            <div class="detail-id">${trailer.id}</div>
            ${statusBadge(trailer.status, trailer.subStatus)}
          </div>
          <div class="detail-meta">
            <span>${trailer.type} · ${trailer.size} · Capacity ${fmtNum(trailer.capacity)} kg</span>
            <span>Order ID: <b style="color:var(--text)">${trailer.orderId || "—"}</b></span>
            <span>Current location: <b style="color:var(--text)">${trailer.currentLocationFinal}</b></span>
          </div>
        </div>
        <div class="ontime-badge" style="background:${ontime.bg};color:${ontime.color}">
          <span class="dot"></span>${ontime.label}
        </div>
      </div>
      <div class="status-strip">
        <span>Last updated: <b>${fmtDateTime(trailer.lastUpdated)}</b> (${timeAgo(trailer.lastUpdated)})</span>
        ${distance ? `<span>·</span><span>Approx. route distance: <b>${fmtNum(distance)} km</b> (Noida → ${trailer.destination})</span>` : ""}
      </div>

      <div class="detail-grid" style="padding:0 20px 20px">
        <div class="panel timeline" style="border-radius:10px">
          <div class="panel-title" style="margin-bottom:14px">Stage History</div>
          ${STAGE_KEYS.map((key, i) => {
            const stage = trailer.stages[key];
            const done = stageDone(trailer, key);
            const isCurrent = i === curIdx;
            const isPending = !done && !isCurrent;
            let dotClass = "pending";
            if (done && !isCurrent) dotClass = "done";
            if (isCurrent) dotClass = stage.delay > 0 || trailer.subStatus === "Delayed" || trailer.subStatus === "Exception" ? "delayed" : "current";
            return `
              <div class="tl-item ${done ? "done" : ""} ${isPending ? "tl-pending" : ""}">
                <div class="tl-marker-wrap">
                  <div class="tl-dot ${dotClass}"></div>
                  ${i < STAGE_KEYS.length - 1 ? '<div class="tl-line"></div>' : ""}
                </div>
                <div class="tl-content">
                  <div class="tl-title-row">
                    <span class="tl-title">${STAGE_LABEL[key]}</span>
                    ${isCurrent ? '<span class="badge" style="background:#dbeafe;color:#1d4ed8;border-color:#bfdbfe;font-size:9.5px;padding:1px 7px">CURRENT</span>' : ""}
                    ${stage.delay > 0 ? `<span class="delay-tag delay-bad" style="font-size:9.5px">+${stage.delay} min delay</span>` : ""}
                  </div>
                  <div class="tl-time">${done ? fmtDateTime(stage.time) : (isCurrent ? "In progress" : "Pending")}</div>
                  ${stage.location ? `<div class="tl-loc">${stage.location}</div>` : ""}
                </div>
              </div>`;
          }).join("")}
        </div>

        <div class="detail-col-stack">
          <div class="panel" style="border-radius:10px">
            <div class="panel-title-row"><div class="panel-title">Load / Trip Details</div></div>
            <div class="panel-body">
              ${trailer.orderId ? `
                <div class="kv-list">
                  <div class="kv-row"><span class="k">Order ID</span><span class="v">${trailer.orderId}</span></div>
                  <div class="kv-row"><span class="k">Current load</span><span class="v">${fmtNum(trailer.currentLoad)} kg</span></div>
                  <div class="kv-row"><span class="k">Trailer capacity</span><span class="v">${fmtNum(trailer.capacity)} kg</span></div>
                  <div class="kv-row"><span class="k">Utilization</span><span class="v">${Math.round((trailer.currentLoad / trailer.capacity) * 100)}%</span></div>
                  <div class="kv-row"><span class="k">Origin</span><span class="v">Noida Yard</span></div>
                  <div class="kv-row"><span class="k">Destination</span><span class="v">${trailer.destination}</span></div>
                  <div class="kv-row"><span class="k">Approx. distance</span><span class="v">${distance ? fmtNum(distance) + " km" : "—"}</span></div>
                  <div class="kv-row"><span class="k">Trailer type / size</span><span class="v">${trailer.type} · ${trailer.size}</span></div>
                </div>
              ` : `
                <div class="empty-state" style="padding:26px 10px">
                  ${navIcon("package")}
                  <div style="margin-top:6px">No active trip</div>
                  <div style="font-size:12px;margin-top:2px">Trailer is available in the Noida yard</div>
                </div>
              `}
            </div>
          </div>

          ${trailer.orderId && distance ? `
          <div class="panel route-map-panel">
            <div class="panel-title-row"><div class="panel-title">Route Map</div><span style="font-size:11px;color:var(--text-muted)">Noida → ${trailer.destination}</span></div>
            <div id="route-map" class="mini-map"></div>
          </div>` : ""}
        </div>

        <div class="panel" style="border-radius:10px;display:flex;flex-direction:column">
          <div class="panel-title-row"><div class="panel-title">Driver Details</div></div>
          <div class="panel-body">
            ${trailer.orderId ? `
              <div class="driver-card">
                <div class="driver-avatar">${initials}</div>
                <div>
                  <div class="driver-name">${driver.name}</div>
                  <div class="driver-rating">★ ${driver.rating} rating · ${driver.experienceYears} yrs experience</div>
                </div>
              </div>
              <div class="kv-list">
                <div class="kv-row"><span class="k">Phone</span><span class="v">${driver.phone}</span></div>
                <div class="kv-row"><span class="k">License no.</span><span class="v">${driver.license}</span></div>
                <div class="kv-row"><span class="k">Vehicle plate</span><span class="v">${driver.vehicleNo}</span></div>
              </div>
              <div style="margin-top:10px;font-size:10.5px;color:var(--text-faint)">* Sample driver data — not present in source dataset.</div>
            ` : `
              <div class="empty-state" style="padding:26px 10px">
                ${navIcon("truck")}
                <div style="margin-top:6px">No driver assigned</div>
                <div style="font-size:12px;margin-top:2px">Driver is assigned once a trip begins</div>
              </div>
            `}
          </div>
        </div>
      </div>
    </div>
  `;

  if (trailer.orderId && distance && typeof L !== "undefined") {
    initRouteMap(trailer);
  }
}

function initRouteMap(trailer) {
  const origin = CITY_COORDS["Noida"];
  const dest = CITY_COORDS[trailer.destination];
  if (!origin || !dest) return;

  const map = L.map("route-map", { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, touchZoom: false });
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", { maxZoom: 18 }).addTo(map);

  const originIcon = L.divIcon({ className: "", html: `<div class="trailer-badge" style="width:16px;height:16px;background:#1e2033;border-width:2px"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });
  const destIcon = L.divIcon({ className: "", html: `<div class="trailer-badge" style="width:16px;height:16px;background:${STATUS_COLOR[trailer.status]};border-width:2px"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });

  L.marker(origin, { icon: originIcon }).addTo(map).bindTooltip("Noida Yard", { permanent: false });
  L.marker(dest, { icon: destIcon }).addTo(map).bindTooltip(trailer.destination, { permanent: false });
  L.polyline([origin, dest], { color: STATUS_COLOR[trailer.status], weight: 2.5, dashArray: "6 6", opacity: 0.8 }).addTo(map);

  map.fitBounds(L.latLngBounds([origin, dest]), { padding: [28, 28] });
}
