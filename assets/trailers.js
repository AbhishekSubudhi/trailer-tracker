// ---------------------------------------------------------------------------
// Page 2: Consolidated Trailer View
// ---------------------------------------------------------------------------

const COLUMNS = [
  { key: "id", label: "Trailer ID", sortable: true, width: 9 },
  { key: "type", label: "Type", sortable: true, width: 7 },
  { key: "size", label: "Size", sortable: true, width: 6 },
  { key: "capacity", label: "Capacity", sortable: true, width: 8 },
  { key: "location", label: "Location", sortable: true, width: 9 },
  { key: "status", label: "Status", sortable: true, width: 8 },
  { key: "subStatus", label: "Sub Status", sortable: true, width: 10 },
  { key: "currentLoad", label: "Load (kg)", sortable: true, width: 8 },
  { key: "destination", label: "Destination", sortable: true, width: 8 },
  { key: "orderId", label: "Order ID", sortable: false, width: 8 },
  { key: "totalDelay", label: "Delay", sortable: true, width: 7 },
  { key: "lastUpdated", label: "Updated", sortable: true, width: 10 }
];

const PAGE_SIZE = 25;

let state = {
  search: "",
  status: "",
  sub: "",
  type: "",
  sortKey: "id",
  sortDir: "asc",
  page: 1
};

document.addEventListener("DOMContentLoaded", () => {
  applyUrlParams();
  buildHeader();
  buildFilterOptions();
  bindControls();
  render();
});

function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("status")) state.status = params.get("status");
  if (params.get("sub")) state.sub = params.get("sub");
  if (params.get("q")) state.search = params.get("q");
}

function buildHeader() {
  const row = document.getElementById("thead-row");
  row.innerHTML = COLUMNS.map(c =>
    `<th class="${c.sortable ? "sortable" : ""}" data-key="${c.key}" title="${c.label}">${c.label}${c.sortable ? '<span class="sort-arrow">↕</span>' : ""}</th>`
  ).join("");
  row.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDir = "asc";
      }
      state.page = 1;
      render();
    });
  });
}

function buildFilterOptions() {
  const statusSel = document.getElementById("filter-status");
  STATUS_ORDER.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s; opt.textContent = s;
    statusSel.appendChild(opt);
  });
  statusSel.value = state.status;

  const typeSel = document.getElementById("filter-type");
  [...new Set(TRAILERS.map(t => t.type))].sort().forEach(t => {
    const opt = document.createElement("option");
    opt.value = t; opt.textContent = t;
    typeSel.appendChild(opt);
  });

  refreshSubOptions();
  document.getElementById("filter-sub").value = state.sub;
  document.getElementById("search-input").value = state.search;
}

function refreshSubOptions() {
  const subSel = document.getElementById("filter-sub");
  subSel.innerHTML = '<option value="">All Sub Statuses</option>';
  const subs = state.status ? SUBSTATUS_BY_STATUS[state.status] : Object.values(SUBSTATUS_BY_STATUS).flat();
  [...new Set(subs)].forEach(s => {
    const opt = document.createElement("option");
    opt.value = s; opt.textContent = s;
    subSel.appendChild(opt);
  });
}

function bindControls() {
  document.getElementById("search-input").addEventListener("input", (e) => {
    state.search = e.target.value;
    state.page = 1;
    render();
  });
  document.getElementById("filter-status").addEventListener("change", (e) => {
    state.status = e.target.value;
    state.sub = "";
    state.page = 1;
    refreshSubOptions();
    render();
  });
  document.getElementById("filter-sub").addEventListener("change", (e) => {
    state.sub = e.target.value;
    state.page = 1;
    render();
  });
  document.getElementById("filter-type").addEventListener("change", (e) => {
    state.type = e.target.value;
    state.page = 1;
    render();
  });
  document.getElementById("btn-reset").addEventListener("click", () => {
    state = { search: "", status: "", sub: "", type: "", sortKey: "id", sortDir: "asc", page: 1 };
    document.getElementById("search-input").value = "";
    document.getElementById("filter-status").value = "";
    document.getElementById("filter-type").value = "";
    refreshSubOptions();
    document.getElementById("filter-sub").value = "";
    render();
  });
}

function getFiltered() {
  const q = state.search.trim().toLowerCase();
  return TRAILERS.filter(t => {
    if (state.status && t.status !== state.status) return false;
    if (state.sub && t.subStatus !== state.sub) return false;
    if (state.type && t.type !== state.type) return false;
    if (q) {
      const hay = `${t.id} ${t.orderId} ${t.destination} ${t.location}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function getSorted(list) {
  const { sortKey, sortDir } = state;
  const sorted = [...list].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (typeof av === "string") av = av.toLowerCase();
    if (typeof bv === "string") bv = bv.toLowerCase();
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
  return sorted;
}

function render() {
  const filtered = getFiltered();
  const sorted = getSorted(filtered);
  document.getElementById("filtered-count").textContent = filtered.length;

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
    tbody.innerHTML = pageItems.map(t => `
      <tr>
        <td><a class="link" href="trailer.html?id=${t.id}">${t.id}</a></td>
        <td>${t.type}</td>
        <td>${t.size}</td>
        <td title="${fmtNum(t.capacity)} kg">${fmtNum(t.capacity)}</td>
        <td title="${t.location}">${t.location}</td>
        <td>${statusBadge(t.status)}</td>
        <td>${subStatusBadge(t.subStatus)}</td>
        <td>${t.currentLoad ? fmtNum(t.currentLoad) : "—"}</td>
        <td title="${t.destination === "NA" ? "" : t.destination}">${t.destination === "NA" ? "—" : t.destination}</td>
        <td title="${t.orderId || ""}">${t.orderId || "—"}</td>
        <td>${t.totalDelay > 0 ? `<span class="delay-tag ${t.totalDelay > 60 ? "delay-bad" : "delay-mid"}">${fmtDuration(t.totalDelay)}</span>` : `<span class="delay-tag delay-ok">On time</span>`}</td>
        <td title="${fmtDateTime(t.lastUpdated)}">${timeAgo(t.lastUpdated)}</td>
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
