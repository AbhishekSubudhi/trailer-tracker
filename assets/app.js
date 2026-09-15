// ---------------------------------------------------------------------------
// Shared utilities: nav, status colors, city coords, formatting, mock drivers
// ---------------------------------------------------------------------------

const STATUS_COLOR = {
  "Available": "#14b8a6",
  "Assigned": "#f5a623",
  "In-Transit": "#5b8def"
};

const SUBSTATUS_COLOR = {
  "Inspection Pending": "#a3a8b3",
  "Inspection Done": "#14b8a6",
  "Loading": "#f5a623",
  "Dispatch": "#f5a623",
  "Unloading": "#f5a623",
  "Trailer Released": "#5b8def",
  "Return": "#5b8def",
  "Reposition": "#5b8def",
  "Arrived Destination": "#5b8def",
  "On Time": "#14b8a6",
  "Delayed": "#b97400",
  "Exception": "#e5484d"
};

const STATUS_ORDER = ["Available", "Assigned", "In-Transit"];
const SUBSTATUS_BY_STATUS = {
  "Available": ["Inspection Pending", "Inspection Done"],
  "Assigned": ["Loading", "Dispatch", "Unloading", "Trailer Released", "Return", "Reposition", "Arrived Destination"],
  "In-Transit": ["On Time", "Delayed", "Exception"]
};

// Approximate city coordinates (lat, lon) for the corridor cities present in the data
const CITY_COORDS = {
  "Noida": [28.5355, 77.3910],
  "Greater Noida": [28.4744, 77.5040],
  "Gurugram": [28.4595, 77.0266],
  "Manesar": [28.3540, 76.9345],
  "Neemrana": [27.9857, 76.3854],
  "Mathura": [27.4924, 77.6737],
  "Agra": [27.1767, 78.0081],
  "Etawah": [26.7855, 79.0154],
  "Kannauj": [27.0524, 79.9153],
  "Kanpur": [26.4499, 80.3319],
  "Jhansi": [25.4484, 78.5685],
  "Gwalior": [26.2183, 78.1828],
  "Sagar": [23.8388, 78.7378],
  "Prayagraj": [25.4358, 81.8463],
  "Varanasi": [25.3176, 82.9739],
  "Jaipur": [26.9124, 75.7873],
  "Ajmer": [26.4499, 74.6399],
  "Udaipur": [24.5854, 73.7125],
  "Shahpura": [25.6602, 74.9198],
  "Himmatnagar": [23.5981, 72.9634],
  "Ahmedabad": [23.0225, 72.5714],
  "Hyderabad": [17.3850, 78.4867],
  "Adilabad": [19.6640, 78.5320],
  "Nizamabad": [18.6725, 78.0941],
  "Nagpur": [21.1458, 79.0882],
  "Kolkata": [22.5726, 88.3639],
  "Asansol": [23.6739, 86.9524],
  "Dhanbad": [23.7957, 86.4304],
  "Lucknow": [26.8467, 80.9462]
};

const MAP_BOUNDS = { latMin: 16, latMax: 29.8, lonMin: 71, lonMax: 90 };

function projectCity(city, w, h) {
  const coord = CITY_COORDS[city];
  if (!coord) return null;
  const [lat, lon] = coord;
  const x = (lon - MAP_BOUNDS.lonMin) / (MAP_BOUNDS.lonMax - MAP_BOUNDS.lonMin) * w;
  const y = h - (lat - MAP_BOUNDS.latMin) / (MAP_BOUNDS.latMax - MAP_BOUNDS.latMin) * h;
  return [x, y];
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  const opts = { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" };
  return d.toLocaleString("en-IN", opts);
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const NOW_ANCHOR = new Date("2026-01-22T09:00:00"); // fixed "now" anchor matching the dataset's timeframe

function timeAgo(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  const now = NOW_ANCHOR;
  const diffMs = now - d;
  const mins = Math.round(diffMs / 60000);
  if (mins < 0) return fmtDateTime(iso);
  if (mins < 60) return mins + " min ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + " hr ago";
  const days = Math.round(hrs / 24);
  return days + " day" + (days > 1 ? "s" : "") + " ago";
}

function fmtNum(n) {
  if (n === null || n === undefined || n === "") return "—";
  return Number(n).toLocaleString("en-IN");
}

function statusBadge(status, subStatus) {
  const color = STATUS_COLOR[status] || "#70757e";
  return (status ? `<span class="badge" style="background:${color}1a;color:${color};border-color:${color}40">${status}</span>` : "") +
    (subStatus ? `<span class="badge badge-sub" style="background:${(SUBSTATUS_COLOR[subStatus] || "#70757e")}1a;color:${SUBSTATUS_COLOR[subStatus] || "#70757e"};border-color:${(SUBSTATUS_COLOR[subStatus] || "#70757e")}40">${subStatus}</span>` : "");
}

function subStatusBadge(subStatus) {
  const color = SUBSTATUS_COLOR[subStatus] || "#70757e";
  return `<span class="badge" style="background:${color}1a;color:${color};border-color:${color}40">${subStatus}</span>`;
}

// Deterministic pseudo-random generator seeded by string, so the same trailer
// always gets the same mock driver / plate across page loads.
function seededRand(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function () {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

const FIRST_NAMES = ["Rajesh", "Suresh", "Amit", "Vikram", "Sanjay", "Manoj", "Deepak", "Ravi", "Anil", "Naveen", "Pankaj", "Ashok", "Vinod", "Rakesh", "Sunil", "Mahesh", "Yogesh", "Dinesh", "Arun", "Sandeep"];
const LAST_NAMES = ["Kumar", "Singh", "Sharma", "Yadav", "Verma", "Mishra", "Gupta", "Pandey", "Chauhan", "Rathore", "Tiwari", "Saini"];

function mockDriver(trailerId) {
  const rand = seededRand(trailerId + "-driver");
  const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
  const phone = "9" + Math.floor(100000000 + rand() * 899999999);
  const license = "DL" + (10 + Math.floor(rand() * 89)) + Math.floor(1000000000 + rand() * 8999999999).toString().slice(0, 11);
  const exp = (3 + Math.floor(rand() * 18));
  const rating = (3.6 + rand() * 1.4).toFixed(1);
  const vehicleNo = "UP" + (10 + Math.floor(rand() * 79)) + " " + String.fromCharCode(65 + Math.floor(rand() * 26)) + String.fromCharCode(65 + Math.floor(rand() * 26)) + " " + Math.floor(1000 + rand() * 8999);
  return { name: `${first} ${last}`, phone: "+91 " + phone, license, experienceYears: exp, rating, vehicleNo };
}

function haversineKm(city1, city2) {
  const c1 = CITY_COORDS[city1], c2 = CITY_COORDS[city2];
  if (!c1 || !c2) return null;
  const R = 6371;
  const dLat = (c2[0] - c1[0]) * Math.PI / 180;
  const dLon = (c2[1] - c1[1]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(c1[0] * Math.PI / 180) * Math.cos(c2[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

const EXCEPTION_TYPES = ["Trailer Separation", "Mechanical Issue", "Tracking Issue", "Other"];

function mockExceptionType(trailerId) {
  const rand = seededRand(trailerId + "-exception");
  return EXCEPTION_TYPES[Math.floor(rand() * EXCEPTION_TYPES.length)];
}

function isDelayed(trailer) {
  return trailer.subStatus === "Delayed" || trailer.subStatus === "Exception" || trailer.totalDelay > 60;
}

function fmtDuration(mins) {
  if (!mins || mins <= 0) return "0 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ---------------------------------------------------------------------------
// Topbar (shared across all pages)
// ---------------------------------------------------------------------------
function renderTopbar() {
  const bar = document.getElementById("topbar");
  if (!bar) return;
  bar.innerHTML = `
    <a href="index.html" class="tb-brand">
      <div class="tb-brand-mark">FV</div>
      <div>
        <div class="tb-brand-text">FleetView</div>
        <div class="tb-brand-sub">Noida Yard Control Tower</div>
      </div>
    </a>
    <form class="tb-search" id="tb-search-form">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input type="text" id="tb-search-input" placeholder="Search trailer ID, order ID, destination…" autocomplete="off">
    </form>
    <div class="tb-right">
      <div class="tb-icon-btn" title="Notifications">
        ${navIcon("bell")}
        <span class="dot-badge"></span>
      </div>
      <div class="tb-user">
        <div class="tb-avatar">FM</div>
        <div>
          <div class="tb-user-name">Fleet Manager</div>
          <div class="tb-user-role">Noida Operations</div>
        </div>
      </div>
    </div>
  `;
  const form = document.getElementById("tb-search-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = document.getElementById("tb-search-input").value.trim();
    window.location.href = "trailers.html" + (q ? `?q=${encodeURIComponent(q)}` : "");
  });
}

// ---------------------------------------------------------------------------
// Sidebar navigation (shared across all pages)
// ---------------------------------------------------------------------------
function renderNav(activePage) {
  const items = [
    { key: "summary", label: "Summary", href: "index.html", icon: "layout-dashboard", enabled: true },
    { key: "trailers", label: "Trailer View", href: "trailers.html", icon: "truck", enabled: true },
    { key: "orders", label: "Order View", href: "orders.html", icon: "package", enabled: true },
    { key: "utilization", label: "Utilization", href: "utilization.html", icon: "bar-chart-3", enabled: true },
    { key: "exceptions", label: "Exceptions", href: "exceptions.html", icon: "alert-triangle", enabled: true }
  ];
  const nav = document.getElementById("sidebar-nav");
  if (!nav) return;

  const active = typeof TRAILERS !== "undefined" ? TRAILERS.filter(t => t.status !== "Available").length : 0;
  const total = typeof TRAILERS !== "undefined" ? TRAILERS.length : 500;
  const pct = total ? Math.round((active / total) * 100) : 0;

  nav.innerHTML = `
    <div class="nav-section-label">Navigate</div>
    <div class="nav-items">
      ${items.map(it => `
        <a class="nav-item ${it.key === activePage ? "active" : ""} ${it.enabled ? "" : "disabled"}"
           href="${it.enabled ? it.href : "#"}" ${it.enabled ? "" : 'title="Coming soon" onclick="return false;"'}>
          <span class="nav-icon">${navIcon(it.icon)}</span>
          <span>${it.label}</span>
          ${it.enabled ? "" : '<span class="soon">Soon</span>'}
        </a>`).join("")}
    </div>
    <div class="nav-widget">
      <div class="nav-widget-top">
        <div class="nav-widget-icon">${navIcon("bar-chart-3")}</div>
        <div class="nav-widget-title">Fleet Utilization</div>
      </div>
      <div class="nav-widget-track"><div class="nav-widget-fill" style="width:${pct}%"></div></div>
      <div class="nav-widget-caption"><b>${active}</b> of ${total} trailers on active duty (${pct}%)</div>
    </div>
  `;
}

function navIcon(name) {
  const icons = {
    "layout-dashboard": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
    "truck": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="14" height="11" rx="1"/><path d="M15 9h4l3 3v5h-7z"/><circle cx="6" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></svg>',
    "package": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
    "bar-chart-3": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></svg>',
    "alert-triangle": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    "bell": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>',
    "calendar": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    "check-circle": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>',
    "navigation": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>',
    "flag": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22V15"/></svg>',
    "activity": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    "clock": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    "zap": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>'
  };
  return icons[name] || "";
}

document.addEventListener("DOMContentLoaded", () => {
  const active = document.body.getAttribute("data-page");
  renderTopbar();
  renderNav(active);
});
