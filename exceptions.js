// ---------------------------------------------------------------------------
// Page: Exception Management
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;
const CRITICAL_THRESHOLD_MIN = 300; // 5h+
const HANDLING_STORAGE_KEY = "fleetview_exception_handling";

const HANDLING_META = {
  open: { label: "Open", color: "#c22a2a", bg: "#fde8e8" },
  investigating: { label: "Investigating", color: "#a5670a", bg: "#fef3d9" },
  resolved: { label: "Resolved", color: "#158a4c", bg: "#e3f9ea" }
};

function loadHandling() {
  try {
    return JSON.parse(localStorage.getItem(HANDLING_STORAGE_KEY)) || {};
  } catch (e) { return {}; }
}
function saveHandling(map) {
  try { localStorage.setItem(HANDLING_STORAGE_KEY, JSON.stringify(map)); } catch (e) {}
}
function getHandling(trailerId) {
  return handlingMap[trailerId] || "open";
}
function setHandling(trailerId, value) {
  handlingMap[trailerId] = value;
  saveHandling(handlingMap);
}

let handlingMap = loadHandling();

const EXCEPTIONS = TRAILERS.filter(t => t.subStatus === "Exception").map(t => ({
  ...t,
  exceptionType: mockExceptionType(t.id)
}));

let state = {
  search: "",
  type: "",
  handling: "",
  criticalOnly: false,
  sortKey: "totalDelay",
  sortDir: "desc",
  page: 1
};

const COLUMNS = [
  { key: "id", label: "Trailer ID", sortable: true },
  { key: "type", label: "Type / Size", sortable: false },
  { key: "route", label: "Route", sortable: false },
  { key: "exceptionType", label: "Exception Type", sortable: true },
  { key: "totalDelay", label: "Delay", sortable: true },
  { key: "currentLocationFinal", label: "Current Location", sortable: true },
  { key: "lastUpdated", label: "Last Updated", sortable: true },
  { key: "handling", label: "Handling Status", sortable: false }
];

document.addEventListener("DOMContentLoaded", () => {
  buildHeader();
  buildFilterOptions();
  bindControls();
  render();
});

// -------------------- KPI row --------------------
function renderKpiRow() {
  const row = document.getElementById("exc-kpi-row");
  const total = EXCEPTIONS.length;
  const critical = EXCEPTIONS.filter(e => e.totalDelay >= CRITICAL_THRESHOLD_MIN).length;
  const avgDelay = total ? Math.round(EXCEPTIONS.reduce((s, e) => s + e.totalDelay, 0) / total) : 0;
  const openCount = EXCEPTIONS.filter(e => getHandling(e.id) === "open").length;

  const cards = [
    { label: "Total Exceptions", icon: "alert-triangle", value: total, color: "#c22a2a", sub: "Currently flagged fleet-wide" },
    { label: `Critical (≥ ${fmtDuration(CRITICAL_THRESHOLD_MIN)})`, icon: "zap", value: critical, color: "#c22a2a", sub: `${total ? Math.round((critical / total) * 100) : 0}% of exceptions` },
    { label: "Avg. Delay", icon: "clock", value: fmtDuration(avgDelay), color: "#a5670a", sub: "Across all exceptions" },
    { label: "Still Open", icon: "flag", value: openCount, color: "#6d5df6", sub: `${total - openCount} being worked or resolved` }
  ];

  row.innerHTML = cards.map(c => `
    <div class="panel kpi-card kpi-card-flat" style="cursor:default">
      <div class="kpi-card-body">
        <div class="kpi-label">${c.label}</div>
        <div class="kpi-value" style="color:${c.color}">${c.value}</div>
        <div class="kpi-subvalue">${c.sub}</div>
      </div>
      <div class="kpi-icon-badge" style="background:${c.color}1a;color:${c.color}">${navIcon(c.icon)}</div>
    </div>`).join("");
}

// -------------------- Header / filters --------------------
function buildHeader() {
  const row = document.getElementById("thead-row");
  row.innerHTML = COLUMNS.map(c =>
    `<th class="${c.sortable ? "sortable" : ""}" data-key="${c.key}">${c.label}${c.sortable ? '<span class="sort-arrow">↕</span>' : ""}</th>`
  ).join("");
  row.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      else { state.sortKey = key; state.sortDir = key === "totalDelay" ? "desc" : "asc"; }
      state.page = 1;
      render();
    });
  });
}

function buildFilterOptions() {
  const typeSel = document.getElementById("filter-type");
  EXCEPTION_TYPES.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t; opt.textContent = t;
    typeSel.appendChild(opt);
  });
}

function bindControls() {
  document.getElementById("search-input").addEventListener("input", (e) => { state.search = e.target.value; state.page = 1; render(); });
  document.getElementById("filter-type").addEventListener("change", (e) => { state.type = e.target.value; state.page = 1; render(); });
  document.getElementById("filter-handling").addEventListener("change", (e) => { state.handling = e.target.value; state.page = 1; render(); });
  document.getElementById("filter-critical").addEventListener("click", (e) => {
    state.criticalOnly = !state.criticalOnly;
    e.target.classList.toggle("active", state.criticalOnly);
    state.page = 1; render();
  });
  document.getElementById("btn-reset").addEventListener("click", () => {
    state = { search: "", type: "", handling: "", criticalOnly: false, sortKey: "totalDelay", sortDir: "desc", page: 1 };
    document.getElementById("search-input").value = "";
    document.getElementById("filter-type").value = "";
    document.getElementById("filter-handling").value = "";
    document.getElementById("filter-critical").classList.remove("active");
    render();
  });
}

// -------------------- Filter / sort / render --------------------
function getFiltered() {
  const q = state.search.trim().toLowerCase();
  return EXCEPTIONS.filter(e => {
    if (state.type && e.exceptionType !== state.type) return false;
    if (state.handling && getHandling(e.id) !== state.handling) return false;
    if (state.criticalOnly && e.totalDelay < CRITICAL_THRESHOLD_MIN) return false;
    if (q && !e.id.toLowerCase().includes(q)) return false;
    return true;
  });
}

function getSorted(list) {
  const { sortKey, sortDir } = state;
  return [...list].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (sortKey === "lastUpdated") { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
    if (typeof av === "string") av = av.toLowerCase();
    if (typeof bv === "string") bv = bv.toLowerCase();
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
}

function render() {
  renderKpiRow();
  const filtered = getFiltered();
  const sorted = getSorted(filtered);

  document.querySelectorAll("#thead-row th").forEach(th => {
    const arrow = th.querySelector(".sort-arrow");
    if (!arrow) return;
    arrow.textContent = th.dataset.key === state.sortKey ? (state.sortDir === "asc" ? "↑" : "↓") : "↕";
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  if (state.page > totalPages) state.page = totalPages;
  const start = (state.page - 1) * PAGE_SIZE;
  const pageItems = sorted.slice(start, start + PAGE_SIZE);

  const tbody = document.getElementById("table-body");
  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${COLUMNS.length}"><div class="empty-state">${EXCEPTIONS.length === 0 ? "No exceptions right now — fleet is running clean." : "No exceptions match these filters."}</div></td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map(e => {
      const handling = getHandling(e.id);
      const critical = e.totalDelay >= CRITICAL_THRESHOLD_MIN;
      return `
      <tr class="${handling === "resolved" ? "row-resolved" : ""}">
        <td><a class="link" href="trailer.html?id=${e.id}">${e.id}</a></td>
        <td>${e.type} · ${e.size}</td>
        <td>Noida → ${e.destination}</td>
        <td>${e.exceptionType}</td>
        <td><span class="delay-tag ${critical ? "delay-bad" : "delay-mid"}">${fmtDuration(e.totalDelay)}</span></td>
        <td>${e.currentLocationFinal}</td>
        <td title="${fmtDateTime(e.lastUpdated)}">${timeAgo(e.lastUpdated)}</td>
        <td>
          <select class="select handling-select" data-id="${e.id}" style="background:${HANDLING_META[handling].bg};color:${HANDLING_META[handling].color};font-weight:700;border-color:transparent">
            <option value="open" ${handling === "open" ? "selected" : ""}>Open</option>
            <option value="investigating" ${handling === "investigating" ? "selected" : ""}>Investigating</option>
            <option value="resolved" ${handling === "resolved" ? "selected" : ""}>Resolved</option>
          </select>
        </td>
      </tr>`;
    }).join("");

    tbody.querySelectorAll(".handling-select").forEach(sel => {
      sel.addEventListener("change", (e) => {
        setHandling(e.target.dataset.id, e.target.value);
        render();
      });
    });
  }

  renderPagination(totalPages, sorted.length, start, pageItems.length);
}

function renderPagination(totalPages, totalItems, start, shown) {
  document.getElementById("pagination-info").textContent =
    totalItems === 0 ? "No results" : `Showing ${start + 1}–${start + shown} of ${totalItems}`;

  const btns = document.getElementById("pagination-btns");
  let html = `<button ${state.page === 1 ? "disabled" : ""} data-go="prev">‹ Prev</button>`;
  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - state.page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  pages.forEach(p => {
    if (p === "…") html += `<button disabled>…</button>`;
    else html += `<button class="${p === state.page ? "active" : ""}" data-go="${p}">${p}</button>`;
  });
  html += `<button ${state.page === totalPages ? "disabled" : ""} data-go="next">Next ›</button>`;
  btns.innerHTML = html;

  btns.querySelectorAll("button[data-go]").forEach(b => {
    b.addEventListener("click", () => {
      const go = b.dataset.go;
      if (go === "prev") state.page = Math.max(1, state.page - 1);
      else if (go === "next") state.page = Math.min(totalPages, state.page + 1);
      else state.page = parseInt(go, 10);
      render();
      document.querySelector(".table-scroll").scrollTop = 0;
    });
  });
}
