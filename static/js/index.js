/**
 * index.js — Overview page logic.
 * Fetches all subjects and stats, renders table + distribution chart.
 */

let allSubjects = [];
let filteredSubjects = [];
let selectedIds = new Set(CompareSelection.get());

// Sort state — tracks active column and direction
let sortState = { col: null, dir: "asc" };

const searchEl   = document.getElementById("search");
const compareBtn = document.getElementById("compareBtn");
const tableHead  = document.getElementById("tableHead");
const tableBody  = document.getElementById("tableBody");
const statsBar   = document.getElementById("statsBar");

// ── Bootstrap ──────────────────────────────────────────────────────────
(async () => {
  await Promise.all([loadSubjects(), loadStats()]);
})();

async function loadSubjects() {
  try {
    allSubjects = await apiFetch(`/api/subjects`);
    filteredSubjects = allSubjects;
    renderTable(filteredSubjects);
    renderDistChart(allSubjects);
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="99" class="table-loading">
      Error loading data: ${err.message}</td></tr>`;
  }
}

async function loadStats() {
  try {
    const stats = await apiFetch("/api/stats");
    statsBar.innerHTML = "";
    for (const [field, s] of Object.entries(stats)) {
      statsBar.insertAdjacentHTML("beforeend", `
        <div class="stat-card">
          <div class="stat-label">${s.label}</div>
          <div class="stat-value mono">${s.mean}${s.unit}</div>
          <div class="stat-sub">Mean · n=${s.count} · σ=${s.stdev}</div>
        </div>`);
    }
  } catch { /* stats are non-critical */ }
}

// ── Client-side sort ───────────────────────────────────────────────────
function sortSubjects(subjects, col, dir) {
  return [...subjects].sort((a, b) => {
    let av = a[col], bv = b[col];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const an = parseFloat(av), bn = parseFloat(bv);
    if (!isNaN(an) && !isNaN(bn)) return dir === "asc" ? an - bn : bn - an;
    av = String(av).toLowerCase();
    bv = String(bv).toLowerCase();
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ?  1 : -1;
    return 0;
  });
}

// ── Table rendering ────────────────────────────────────────────────────
function renderTable(subjects) {
  if (!subjects.length) {
    tableHead.innerHTML = "";
    tableBody.innerHTML = `<tr><td colspan="99" class="table-loading">No subjects found.</td></tr>`;
    return;
  }

  const cols = Object.keys(subjects[0]).filter(k => !k.startsWith("_"));

  tableHead.innerHTML = `<tr>
    <th><input type="checkbox" id="selectAll" /></th>
    ${cols.map(c => {
      const isActive = sortState.col === c;
      const arrow = isActive ? (sortState.dir === "asc" ? " ↑" : " ↓") : "";
      const activeClass = isActive ? " th-active" : "";
      return `<th class="th-sortable${activeClass}" data-col="${c}">
        ${c.replace(/_/g, " ")}${arrow}
      </th>`;
    }).join("")}
    <th></th>
  </tr>`;

  tableBody.innerHTML = subjects.map(s => `
    <tr>
      <td><input type="checkbox" class="row-check" data-id="${s.subject_id || s._doc_id}"
          ${selectedIds.has(String(s.subject_id || s._doc_id)) ? "checked" : ""} /></td>
      ${cols.map(c => {
        const raw = s[c];
        const val = raw ?? "—";
        return `<td class="${thresholdClass(raw, {})}">${
          c === "status" ? statusBadge(val) : val
        }</td>`;
      }).join("")}
      <td><a href="/subject/${encodeURIComponent(s.subject_id || s._doc_id)}"
             class="btn btn-outline" style="padding:.25rem .6rem;font-size:.78rem">View</a></td>
    </tr>`).join("");

  attachTableEvents();
}

function attachTableEvents() {
  // Checkbox: select all
  document.getElementById("selectAll")?.addEventListener("change", function () {
    document.querySelectorAll(".row-check").forEach(cb => {
      cb.checked = this.checked;
      updateSelection(cb.dataset.id, this.checked);
    });
  });

  document.querySelectorAll(".row-check").forEach(cb => {
    cb.addEventListener("change", () => updateSelection(cb.dataset.id, cb.checked));
  });

  // Column header sort
  tableHead.querySelectorAll(".th-sortable").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (sortState.col === col) {
        sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
      } else {
        sortState.col = col;
        sortState.dir = "asc";
      }
      renderTable(sortSubjects(filteredSubjects, sortState.col, sortState.dir));
    });
  });
}

function updateSelection(id, checked) {
  if (checked) selectedIds.add(id);
  else selectedIds.delete(id);
  CompareSelection.set([...selectedIds]);
  compareBtn.disabled = selectedIds.size < 2;
}

// ── Distribution chart ────────────────────────────────────────────────
function renderDistChart(subjects) {
  const scores = subjects
    .map(s => parseFloat(s.score))
    .filter(n => !isNaN(n));

  if (!scores.length) return;

  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const binCount = 10;
  const binSize  = (max - min) / binCount || 1;
  const bins     = Array(binCount).fill(0);

  scores.forEach(s => {
    const bucket = Math.min(binCount - 1, Math.floor((s - min) / binSize));
    bins[bucket]++;
  });

  const labels = bins.map((_, i) => {
    const lo = (min + i * binSize).toFixed(1);
    const hi = (min + (i + 1) * binSize).toFixed(1);
    return `${lo}–${hi}`;
  });

  const ctx = document.getElementById("distChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Subjects",
        data: bins,
        backgroundColor: CHART_COLORS[0] + "cc",
        borderColor: CHART_COLORS[0],
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "#2a3347" } },
        y: { grid: { color: "#2a3347" }, beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

// ── Controls ───────────────────────────────────────────────────────────
searchEl.addEventListener("input", () => {
  const q = searchEl.value.toLowerCase();
  filteredSubjects = q
    ? allSubjects.filter(s => JSON.stringify(s).toLowerCase().includes(q))
    : allSubjects;
  const sorted = sortState.col
    ? sortSubjects(filteredSubjects, sortState.col, sortState.dir)
    : filteredSubjects;
  renderTable(sorted);
});

compareBtn.addEventListener("click", () => {
  const ids = [...selectedIds].map(id => `ids=${encodeURIComponent(id)}`).join("&");
  window.location.href = `/compare?${ids}`;
});
