// ---------------------------------------------------------------------------
// Page: Trailer Utilization
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;
const MONTH_DAYS = 30;
const MONTH_END = NOW_ANCHOR;
const MONTH_START = new Date(MONTH_END - MONTH_DAYS * 24 * 3600 * 1000);
const UNDERUTIL_THRESHOLD = 0.85;

let state = {
  search: "",
  type: "",
  location: "",
  lowOnly: false,
  rangeDays: MONTH_DAYS,
  rangeLabel: "Full month",
  sortKey: "utilization",
  sortDir: "asc",
  page: 1
};

const PRIORITY_TIME_COLUMNS = [
  { key: "availableTime", label: "Available Time (h)" },
  { key: "productiveTime", label: "Productive Time (h)" }
];

const REST_TIME_COLUMNS = [
  { key: "movingTime", label: "Moving Time (h)" },
  { key: "loadingTime", label: "Loading Time (h)" },
  { key: "unloadingTime", label: "Unloading Time (h)" },
  { key: "idleTime", label: "Idle Time (h)" },
  { key: "emptyMovement", label: "Empty Movement (h)" },
  { key: "maintenanceTime", label: "Maintenance (h)" }
];

const COLUMNS = [
  { key: "id", label: "Trailer ID", sortable: true },
  { key: "type", label: "Type", sortable: true },
  { key: "size", label: "Size", sortable: true },
  { key: "location", label: "Current Locn.", sortable: true },
  { key: "utilization", label: "Utilization", sortable: true },
  ...PRIORITY_TIME_COLUMNS.map(c => ({ ...c, sortable: true })),
  ...REST_TIME_COLUMNS.map(c => ({ ...c, sortable: true }))
];

document.addEventListener("DOMContentLoaded", () => {
  buildHeader();
  buildFilterOptions();
  renderDateSlicer();
  bindControls();
  render();
});

function scale(hours) {
  return Math.round(hours * (state.rangeDays / MONTH_DAYS) * 10) / 10;
}

// -------------------- Date slicer (day granularity, within the 1-month window) --------------------
function toDateInputValue(d) {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function renderDateSlicer() {
  const slot = document.getElementById("date-slicer");
  slot.innerHTML = `
    <div class="date-slicer">
      <button class="date-slicer-btn" id="date-slicer-btn">
        ${navIcon("calendar")}
        <span id="date-slicer-label">Full month</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="date-slicer-panel" id="date-slicer-panel" hidden>
        <div class="dsp-label">Quick range (of the trailing month)</div>
        <div class="dsp-presets">
          <button data-days="30" class="active">Full month</button>
          <button data-days="21">Last 21 days</button>
          <button data-days="14">Last 14 days</button>
          <button data-days="7">Last 7 days</button>
          <button data-days="1">Last 24 hours</button>
        </div>
        <div class="dsp-label">Custom range</div>
        <div class="dsp-custom">
          <label>From<input type="date" id="date-from" min="${toDateInputValue(MONTH_START)}" max="${toDateInputValue(MONTH_END)}"></label>
          <label>To<input type="date" id="date-to" min="${toDateInputValue(MONTH_START)}" max="${toDateInputValue(MONTH_END)}"></label>
          <button class="btn-primary-sm" id="date-apply">Apply</button>
        </div>
        <div style="margin-top:10px;font-size:10.5px;color:var(--text-faint)">
          Data covers ${toDateInputValue(MONTH_START)} to ${toDateInputValue(MONTH_END)}. Hours are assumed uniformly distributed across the month and scaled to the selected range.
        </div>
      </div>
    </div>
  `;

  document.getElementById("date-from").value = toDateInputValue(MONTH_START);
  document.getElementById("date-to").value = toDateInputValue(MONTH_END);

  const btn = document.getElementById("date-slicer-btn");
  const panel = document.getElementById("date-slicer-panel");
  btn.addEventListener("click", (e) => { e.stopPropagation(); panel.hidden = !panel.hidden; });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) panel.hidden = true;
  });

  panel.querySelectorAll(".dsp-presets button").forEach(b => {
    b.addEventListener("click", () => {
      panel.querySelectorAll(".dsp-presets button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      const days = parseFloat(b.dataset.days);
      state.rangeDays = days;
      state.rangeLabel = b.textContent;
      document.getElementById("date-slicer-label").textContent = b.textContent;
      const from = new Date(MONTH_END - days * 24 * 3600 * 1000);
      document.getElementById("date-from").value = toDateInputValue(from);
      document.getElementById("date-to").value = toDateInputValue(MONTH_END);
      panel.hidden = true;
      render();
    });
  });

  document.getElementById("date-apply").addEventListener("click", () => {
    const fromVal = document.getElementById("date-from").value;
    const toVal = document.getElementById("date-to").value;
    if (!fromVal || !toVal) return;
    const from = new Date(fromVal);
    const to = new Date(toVal);
    const days = Math.max(0.5, Math.min(MONTH_DAYS, (to - from) / (24 * 3600 * 1000) + 1));
    state.rangeDays = days;
    state.rangeLabel = `${fromVal} → ${toVal}`;
    document.getElementById("date-slicer-label").textContent = `${days.toFixed(0)}-day custom range`;
    panel.querySelectorAll(".dsp-presets button").forEach(x => x.classList.remove("active"));
    panel.hidden = true;
    render();
  });
}

// -------------------- KPI row --------------------
function renderKpiRow() {
  const row = document.getElementById("util-kpi-row");
  const list = UTILIZATION;
  const n = list.length || 1;
  const totalProductive = list.reduce((s, u) => s + scale(u.productiveTime), 0);
  const totalAvailable = list.reduce((s, u) => s + scale(u.availableTime), 0);
  const avgProductive = totalProductive / n;
  const avgAvailable = totalAvailable / n;
  const overall = totalAvailable ? Math.round((totalProductive / totalAvailable) * 1000) / 10 : 0;
  const underCount = list.filter(u => u.utilization < UNDERUTIL_THRESHOLD).length;

  const cards = [
    {
      label: "Overall Utilization", icon: "activity",
      value: `${overall}%`, color: overall >= 90 ? "#0f9e8e" : overall >= 85 ? "#b97400" : "#e5484d",
      sub: `Across all ${list.length} trailers`
    },
    {
      label: `Underutilized (< ${Math.round(UNDERUTIL_THRESHOLD * 100)}%)`, icon: "alert-triangle",
      value: underCount, color: "#e5484d",
      sub: `${Math.round((underCount / n) * 100)}% of fleet`
    },
    {
      label: "Avg. Productive Time", icon: "zap",
      value: `${fmtNum(Math.round(avgProductive * 10) / 10)} h`, color: "#5b8def",
      sub: `Total: ${fmtNum(Math.round(totalProductive))} h (${state.rangeLabel})`
    },
    {
      label: "Avg. Available Time", icon: "clock",
      value: `${fmtNum(Math.round(avgAvailable * 10) / 10)} h`, color: "#14b8a6",
      sub: `Total: ${fmtNum(Math.round(totalAvailable))} h (${state.rangeLabel})`
    }
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

// -------------------- Table header / filters --------------------
function buildHeader() {
  const row = document.getElementById("thead-row");
  row.innerHTML = COLUMNS.map(c =>
    `<th class="${c.sortable ? "sortable" : ""}" data-key="${c.key}">${c.label}${c.sortable ? '<span class="sort-arrow">↕</span>' : ""}</th>`
  ).join("");
  row.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      else { state.sortKey = key; state.sortDir = "asc"; }
      state.page = 1;
      render();
    });
  });
}

function buildFilterOptions() {
  const typeSel = document.getElementById("filter-type");
  [...new Set(UTILIZATION.map(u => u.type))].sort().forEach(t => {
    const opt = document.createElement("option");
    opt.value = t; opt.textContent = t;
    typeSel.appendChild(opt);
  });
  const locSel = document.getElementById("filter-location");
  [...new Set(UTILIZATION.map(u => u.location))].sort().forEach(l => {
    const opt = document.createElement("option");
    opt.value = l; opt.textContent = l;
    locSel.appendChild(opt);
  });
}

function bindControls() {
  document.getElementById("search-input").addEventListener("input", (e) => { state.search = e.target.value; state.page = 1; render(); });
  document.getElementById("filter-type").addEventListener("change", (e) => { state.type = e.target.value; state.page = 1; render(); });
  document.getElementById("filter-location").addEventListener("change", (e) => { state.location = e.target.value; state.page = 1; render(); });
  document.getElementById("filter-low").addEventListener("click", (e) => {
    state.lowOnly = !state.lowOnly;
    e.target.classList.toggle("active", state.lowOnly);
    state.page = 1; render();
  });
  document.getElementById("btn-reset").addEventListener("click", () => {
    state = { search: "", type: "", location: "", lowOnly: false, rangeDays: MONTH_DAYS, rangeLabel: "Full month", sortKey: "utilization", sortDir: "asc", page: 1 };
    document.getElementById("search-input").value = "";
    document.getElementById("filter-type").value = "";
    document.getElementById("filter-location").value = "";
    document.getElementById("filter-low").classList.remove("active");
    document.getElementById("date-slicer-label").textContent = "Full month";
    document.querySelectorAll(".dsp-presets button").forEach(b => b.classList.toggle("active", b.dataset.days === "30"));
    document.getElementById("date-from").value = "";
    document.getElementById("date-to").value = "";
    render();
  });
}

// -------------------- Filter / sort / render --------------------
function getFiltered() {
  const q = state.search.trim().toLowerCase();
  return UTILIZATION.filter(u => {
    if (state.type && u.type !== state.type) return false;
    if (state.location && u.location !== state.location) return false;
    if (state.lowOnly && u.utilization >= UNDERUTIL_THRESHOLD) return false;
    if (q && !u.id.toLowerCase().includes(q)) return false;
    return true;
  });
}

function getSorted(list) {
  const { sortKey, sortDir } = state;
  return [...list].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (typeof av === "string") av = av.toLowerCase();
    if (typeof bv === "string") bv = bv.toLowerCase();
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
}

function utilTone(u) {
  if (u >= 0.9) return { cls: "delay-ok", color: "#0f9e8e" };
  if (u >= UNDERUTIL_THRESHOLD) return { cls: "delay-mid", color: "#b97400" };
  return { cls: "delay-bad", color: "#e5484d" };
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
    tbody.innerHTML = `<tr><td colspan="${COLUMNS.length}"><div class="empty-state">No trailers match these filters.</div></td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map(u => {
      const tone = utilTone(u.utilization);
      return `
      <tr>
        <td><a class="link" href="trailer.html?id=${u.id}">${u.id}</a></td>
        <td>${u.type}</td>
        <td>${u.size}</td>
        <td>${u.location}</td>
        <td><span class="delay-tag ${tone.cls}">${Math.round(u.utilization * 1000) / 10}%</span></td>
        ${PRIORITY_TIME_COLUMNS.map(c => `<td>${fmtNum(scale(u[c.key]))}</td>`).join("")}
        ${REST_TIME_COLUMNS.map(c => `<td>${fmtNum(scale(u[c.key]))}</td>`).join("")}
      </tr>`;
    }).join("");
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
