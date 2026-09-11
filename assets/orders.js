// ---------------------------------------------------------------------------
// Page: Orders View
// ---------------------------------------------------------------------------

const REVIEW_THRESHOLD = 80; // top-recommendation accuracy below this needs manual review
const PAGE_SIZE = 25;

const SCORING_LOGIC = [
  { rule: "Candidate pool", detail: "Only trailers with Status = Available are considered." },
  { rule: "Weight feasibility (hard rule)", detail: "Capacity − Current Load must be ≥ Order Weight." },
  { rule: "Trailer type match", detail: "35% of score — exact type match scores 100; compatible substitutes score lower." },
  { rule: "Capacity / order weight fit", detail: "30% — favors feasible trailers with efficient capacity utilization and a safety buffer." },
  { rule: "Order volume fit", detail: "15% — size converted to a proxy volume (20ft=40, 32ft=60, 40ft=80, 45ft=90)." },
  { rule: "Current trailer load impact", detail: "10% — a lower current-load ratio scores higher." },
  { rule: "Order priority", detail: "5% — P1 = 100, P2 = 80, P3 = 60." },
  { rule: "Readiness / recency", detail: "5% — Inspection Done and a more recent last-updated time score higher." },
  { rule: "Type substitution", detail: "Dry Van prefers Reefer, and Container prefers Flatbed, when no exact-type trailer is available." },
  { rule: "Accuracy display", detail: "Top 3 candidates are ranked independently and shown to 1 decimal place." }
];

let state = {
  search: "",
  type: "",
  destination: "",
  priority: "",
  reviewOnly: false,
  dateFrom: null,
  dateTo: null,
  datePreset: "all",
  sortKey: "createdAt",
  sortDir: "desc",
  page: 1
};

const COLUMNS = [
  { key: "id", label: "Order ID", sortable: true },
  { key: "createdAt", label: "Order Time", sortable: true },
  { key: "type", label: "Type", sortable: true },
  { key: "weight", label: "Weight (kg)", sortable: true },
  { key: "destination", label: "Destination", sortable: true },
  { key: "distance", label: "Distance (km)", sortable: true },
  { key: "priority", label: "Priority", sortable: true },
  { key: "rec", label: "Recommended Trailers", sortable: false }
];

document.addEventListener("DOMContentLoaded", () => {
  buildHeader();
  buildFilterOptions();
  renderDateSlicer();
  bindControls();
  bindScoringModal();
  render();
});

function getRecs(orderId) {
  return ORDER_RECOMMENDATIONS[orderId] || [];
}

function topAccuracy(orderId) {
  const recs = getRecs(orderId);
  return recs.length ? recs[0].accuracy : null;
}

function needsReview(order) {
  const acc = topAccuracy(order.id);
  return acc === null || acc < REVIEW_THRESHOLD;
}

// -------------------- Date/time slicer --------------------
function presetRange(preset) {
  const now = NOW_ANCHOR;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "today": return [startOfToday, now];
    case "24h": return [new Date(now - 24 * 3600 * 1000), now];
    case "3d": return [new Date(now - 3 * 24 * 3600 * 1000), now];
    case "7d": return [new Date(now - 7 * 24 * 3600 * 1000), now];
    case "14d": return [new Date(now - 14 * 24 * 3600 * 1000), now];
    default: return [null, null];
  }
}

function toLocalInputValue(d) {
  if (!d) return "";
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function renderDateSlicer() {
  const slot = document.getElementById("date-slicer");
  slot.innerHTML = `
    <div class="date-slicer">
      <button class="date-slicer-btn" id="date-slicer-btn">
        ${navIcon("calendar")}
        <span id="date-slicer-label">All time</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="date-slicer-panel" id="date-slicer-panel" hidden>
        <div class="dsp-label">Quick range</div>
        <div class="dsp-presets">
          <button data-preset="all" class="active">All time</button>
          <button data-preset="today">Today</button>
          <button data-preset="24h">Last 24 hours</button>
          <button data-preset="3d">Last 3 days</button>
          <button data-preset="7d">Last 7 days</button>
          <button data-preset="14d">Last 14 days</button>
        </div>
        <div class="dsp-label">Custom range</div>
        <div class="dsp-custom">
          <label>From<input type="datetime-local" id="date-from"></label>
          <label>To<input type="datetime-local" id="date-to"></label>
          <button class="btn-primary-sm" id="date-apply">Apply</button>
        </div>
      </div>
    </div>
  `;

  const btn = document.getElementById("date-slicer-btn");
  const panel = document.getElementById("date-slicer-panel");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
  });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) panel.hidden = true;
  });

  panel.querySelectorAll(".dsp-presets button").forEach(b => {
    b.addEventListener("click", () => {
      panel.querySelectorAll(".dsp-presets button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      const preset = b.dataset.preset;
      const [from, to] = presetRange(preset);
      state.dateFrom = from; state.dateTo = to; state.datePreset = preset; state.page = 1;
      document.getElementById("date-from").value = toLocalInputValue(from);
      document.getElementById("date-to").value = toLocalInputValue(to);
      document.getElementById("date-slicer-label").textContent =
        preset === "all" ? "All time" : b.textContent;
      panel.hidden = true;
      render();
    });
  });

  document.getElementById("date-apply").addEventListener("click", () => {
    const fromVal = document.getElementById("date-from").value;
    const toVal = document.getElementById("date-to").value;
    state.dateFrom = fromVal ? new Date(fromVal) : null;
    state.dateTo = toVal ? new Date(toVal) : null;
    state.datePreset = "custom";
    state.page = 1;
    panel.querySelectorAll(".dsp-presets button").forEach(x => x.classList.remove("active"));
    document.getElementById("date-slicer-label").textContent =
      (state.dateFrom || state.dateTo) ? "Custom range" : "All time";
    panel.hidden = true;
    render();
  });
}

// -------------------- KPI row --------------------
function renderKpiRow() {
  const row = document.getElementById("orders-kpi-row");
  const inRange = getDateFiltered(ORDERS);
  const available = TRAILERS.filter(t => t.status === "Available").length;
  const byPriority = { P1: 0, P2: 0, P3: 0 };
  inRange.forEach(o => byPriority[o.priority]++);
  const priorityColors = { P1: "#dc2626", P2: "#e08c1a", P3: "#16a34a" };
  const priorityLabels = { P1: "P1 · Urgent", P2: "P2 · Standard", P3: "P3 · Flexible" };

  const cards = [
    { key: "available", label: "Available Trailers", value: available, color: "#2f7de1", icon: "check-circle", clickable: "link" },
    { key: "all", label: "New Orders", value: inRange.length, color: "#6d5df6", icon: "package", clickable: "filter" },
    { key: "P1", label: priorityLabels.P1, value: byPriority.P1, color: priorityColors.P1, icon: "flag", clickable: "filter" },
    { key: "P2", label: priorityLabels.P2, value: byPriority.P2, color: priorityColors.P2, icon: "flag", clickable: "filter" },
    { key: "P3", label: priorityLabels.P3, value: byPriority.P3, color: priorityColors.P3, icon: "flag", clickable: "filter" }
  ];

  row.innerHTML = cards.map(c => {
    const isActive = (c.key === "all" && !state.priority) || (c.key === state.priority);
    return `
    <div class="panel kpi-card kpi-card-flat ${isActive ? "open" : ""}" data-kpi="${c.key}" data-mode="${c.clickable}">
      <div class="kpi-card-body">
        <div class="kpi-label">${c.label}</div>
        <div class="kpi-value">${c.value}</div>
      </div>
      <div class="kpi-icon-badge" style="background:${c.color}1a;color:${c.color}">${navIcon(c.icon)}</div>
    </div>`;
  }).join("");

  row.querySelectorAll(".kpi-card").forEach(card => {
    card.addEventListener("click", () => {
      const mode = card.dataset.mode;
      if (mode === "link") { window.location.href = "trailers.html?status=Available"; return; }
      const key = card.dataset.kpi;
      if (key === "all") state.priority = "";
      else state.priority = state.priority === key ? "" : key;
      state.page = 1;
      render();
    });
  });
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
      else { state.sortKey = key; state.sortDir = key === "createdAt" ? "desc" : "asc"; }
      state.page = 1;
      render();
    });
  });
}

function buildFilterOptions() {
  const typeSel = document.getElementById("filter-type");
  [...new Set(ORDERS.map(o => o.type))].sort().forEach(t => {
    const opt = document.createElement("option");
    opt.value = t; opt.textContent = t;
    typeSel.appendChild(opt);
  });

  const destSel = document.getElementById("filter-destination");
  [...new Set(ORDERS.map(o => o.destination))].sort().forEach(d => {
    const opt = document.createElement("option");
    opt.value = d; opt.textContent = d;
    destSel.appendChild(opt);
  });
}

function bindControls() {
  document.getElementById("search-input").addEventListener("input", (e) => {
    state.search = e.target.value; state.page = 1; render();
  });
  document.getElementById("filter-type").addEventListener("change", (e) => {
    state.type = e.target.value; state.page = 1; render();
  });
  document.getElementById("filter-destination").addEventListener("change", (e) => {
    state.destination = e.target.value; state.page = 1; render();
  });
  document.getElementById("filter-review").addEventListener("click", (e) => {
    state.reviewOnly = !state.reviewOnly;
    e.target.classList.toggle("active", state.reviewOnly);
    state.page = 1; render();
  });
  document.getElementById("btn-reset").addEventListener("click", () => {
    state = { search: "", type: "", destination: "", priority: "", reviewOnly: false, dateFrom: null, dateTo: null, datePreset: "all", sortKey: "createdAt", sortDir: "desc", page: 1 };
    document.getElementById("search-input").value = "";
    document.getElementById("filter-type").value = "";
    document.getElementById("filter-destination").value = "";
    document.getElementById("filter-review").classList.remove("active");
    document.getElementById("date-slicer-label").textContent = "All time";
    document.querySelectorAll(".dsp-presets button").forEach(b => b.classList.toggle("active", b.dataset.preset === "all"));
    document.getElementById("date-from").value = "";
    document.getElementById("date-to").value = "";
    render();
  });
}

function bindScoringModal() {
  const modal = document.getElementById("scoring-modal");
  const body = document.getElementById("scoring-modal-body");
  body.innerHTML = `
    <div class="kv-list">
      ${SCORING_LOGIC.map(s => `
        <div class="kv-row" style="align-items:flex-start">
          <span class="k" style="white-space:normal;max-width:170px">${s.rule}</span>
          <span class="v" style="font-weight:500;text-align:left;max-width:340px">${s.detail}</span>
        </div>`).join("")}
    </div>
    <div style="margin-top:12px;font-size:11px;color:var(--text-faint)">Candidates are limited to trailers currently marked Available in the Noida yard.</div>
  `;
  document.getElementById("btn-scoring-info").addEventListener("click", () => modal.classList.add("show"));
  document.getElementById("scoring-modal-close").addEventListener("click", () => modal.classList.remove("show"));
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("show"); });
}

// -------------------- Filtering / sorting / rendering --------------------
function getDateFiltered(list) {
  return list.filter(o => {
    const t = new Date(o.createdAt);
    if (state.dateFrom && t < state.dateFrom) return false;
    if (state.dateTo && t > state.dateTo) return false;
    return true;
  });
}

function getFiltered() {
  const q = state.search.trim().toLowerCase();
  return getDateFiltered(ORDERS).filter(o => {
    if (state.type && o.type !== state.type) return false;
    if (state.destination && o.destination !== state.destination) return false;
    if (state.priority && o.priority !== state.priority) return false;
    if (state.reviewOnly && !needsReview(o)) return false;
    if (q && !o.id.toLowerCase().includes(q)) return false;
    return true;
  });
}

function getSorted(list) {
  const { sortKey, sortDir } = state;
  return [...list].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (sortKey === "createdAt") { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
    if (typeof av === "string") av = av.toLowerCase();
    if (typeof bv === "string") bv = bv.toLowerCase();
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
}

function priorityBadge(p) {
  const colors = { P1: "#dc2626", P2: "#e08c1a", P3: "#16a34a" };
  const c = colors[p] || "#64748b";
  return `<span class="badge" style="background:${c}1a;color:${c};border-color:${c}40">${p}</span>`;
}

function recommendationCell(orderId) {
  const recs = getRecs(orderId);
  if (recs.length === 0) return `<span style="color:var(--text-faint)">No match available</span>`;
  return `<div class="rec-chips">` + recs.map((r, i) => {
    const tone = r.accuracy >= 90 ? "rec-high" : r.accuracy >= REVIEW_THRESHOLD ? "rec-mid" : "rec-low";
    return `<a class="rec-chip ${tone}" href="trailer.html?id=${r.trailerId}" title="Rank ${i + 1} match">${r.trailerId} <b>${r.accuracy}%</b></a>`;
  }).join("") + `</div>`;
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
    tbody.innerHTML = `<tr><td colspan="${COLUMNS.length}"><div class="empty-state">No orders match these filters.</div></td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map(o => `
      <tr class="${needsReview(o) ? "row-flag" : ""}">
        <td><span style="font-weight:700">${o.id}</span>${needsReview(o) ? '<span class="badge" style="background:#fde8e8;color:#c22a2a;border-color:#f8c6c6;margin-left:6px">Review</span>' : ""}</td>
        <td title="${fmtDateTime(o.createdAt)}">${timeAgo(o.createdAt)}</td>
        <td>${o.type}</td>
        <td>${fmtNum(o.weight)}</td>
        <td>${o.destination}</td>
        <td>${fmtNum(o.distance)}</td>
        <td>${priorityBadge(o.priority)}</td>
        <td>${recommendationCell(o.id)}</td>
      </tr>`).join("");
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
