/**
 * compare.js — Side-by-side subject comparison.
 */

let allSubjectsCache = [];
let selectedIds      = new Set(CompareSelection.get());
let fieldConfig      = {};   // populated from /api/config

// Pre-seed from URL params (set by Flask template)
if (PRELOADED_IDS?.length) {
  PRELOADED_IDS.forEach(id => {
    selectedIds.add(id);
    CompareSelection.add(id);
  });
}

const searchInput     = document.getElementById("subjectSearch");
const autocompleteBox = document.getElementById("autocompleteBox");
const selectedChips   = document.getElementById("selectedChips");
const loadBtn         = document.getElementById("loadCompareBtn");

// ── Bootstrap ──────────────────────────────────────────────────────────
(async () => {
  try {
    [allSubjectsCache, fieldConfig] = await Promise.all([
      apiFetch("/api/subjects?limit=500"),
      apiFetch("/api/config"),
    ]);
    renderChips();
    if (selectedIds.size >= 2) await runComparison();
  } catch (err) {
    console.error(err);
  }
})();

// ── Field helpers ──────────────────────────────────────────────────────
function numericFields() {
  return Object.entries(fieldConfig)
    .filter(([, cfg]) => cfg.fmt === "number" || cfg.fmt === "percent")
    .map(([key, cfg]) => ({ key, label: cfg.label, unit: cfg.unit }));
}

// ── Autocomplete ───────────────────────────────────────────────────────
searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) { autocompleteBox.classList.add("hidden"); return; }

  const matches = allSubjectsCache
    .filter(s => {
      const id    = String(s._doc_id);
      const email = String(s.email || "");
      return (id.toLowerCase().includes(q) || email.toLowerCase().includes(q))
        && !selectedIds.has(id);
    })
    .slice(0, 8);

  if (!matches.length) { autocompleteBox.classList.add("hidden"); return; }

  autocompleteBox.innerHTML = matches.map(s => {
    const id    = String(s._doc_id);
    const label = s.email ? `${s.email} (${id.slice(0, 8)}…)` : id;
    return `<div class="ac-item" data-id="${id}">${label}</div>`;
  }).join("");
  autocompleteBox.classList.remove("hidden");

  autocompleteBox.querySelectorAll(".ac-item").forEach(el => {
    el.addEventListener("click", () => {
      addSubject(el.dataset.id);
      searchInput.value = "";
      autocompleteBox.classList.add("hidden");
    });
  });
});

document.addEventListener("click", e => {
  if (!autocompleteBox.contains(e.target) && e.target !== searchInput)
    autocompleteBox.classList.add("hidden");
});

// ── Chip management ────────────────────────────────────────────────────
function addSubject(id) {
  selectedIds.add(id);
  CompareSelection.add(id);
  renderChips();
}

function removeSubject(id) {
  selectedIds.delete(id);
  CompareSelection.remove(id);
  renderChips();
}

function renderChips() {
  selectedChips.innerHTML = [...selectedIds].map(id => `
    <div class="chip">
      ${id}
      <button class="chip-remove" data-id="${id}" title="Remove">×</button>
    </div>`).join("");

  selectedChips.querySelectorAll(".chip-remove").forEach(btn => {
    btn.addEventListener("click", () => removeSubject(btn.dataset.id));
  });

  loadBtn.disabled = selectedIds.size < 2;
}

// ── Load comparison ────────────────────────────────────────────────────
loadBtn.addEventListener("click", runComparison);

async function runComparison() {
  if (selectedIds.size < 2) return;
  try {
    const ids  = [...selectedIds].map(id => `ids=${encodeURIComponent(id)}`).join("&");
    const data = await apiFetch(`/api/compare?${ids}`);
    renderBarChart(data);
    renderCompareTable(data);
    document.getElementById("chartSection").style.display = "";
    document.getElementById("tableSection").style.display = "";
  } catch (err) {
    alert("Error loading comparison: " + err.message);
  }
}

// ── Bar chart ──────────────────────────────────────────────────────────
let compareChartInstance = null;

function renderBarChart(subjects) {
  const fields = numericFields();
  if (!fields.length) return;

  const labels = fields.map(f => f.label);

  const datasets = subjects.map((s, i) => ({
    label: s.email || s._doc_id,
    data:  fields.map(f => {
      const v = parseFloat(s[f.key]);
      return isNaN(v) ? null : v;
    }),
    backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + "cc",
    borderColor:     CHART_COLORS[i % CHART_COLORS.length],
    borderWidth: 1,
    borderRadius: 4,
  }));

  const units  = [...new Set(fields.map(f => f.unit).filter(Boolean))];
  const yLabel = units.length === 1 ? units[0] : "";

  const ctx = document.getElementById("compareChart").getContext("2d");
  if (compareChartInstance) compareChartInstance.destroy();

  compareChartInstance = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    options: {
      plugins: {
        legend: { labels: { color: "#dce3f0" } },
      },
      scales: {
        x: { grid: { color: "#2a3347" } },
        y: {
          beginAtZero: true,
          grid: { color: "#2a3347" },
          title: yLabel ? { display: true, text: yLabel, color: "#7a8ba8" } : { display: false },
          ticks: { color: "#7a8ba8" },
        },
      },
    },
  });
}

// ── Compare table ──────────────────────────────────────────────────────
function renderCompareTable(subjects) {
  const allKeys = Object.keys(subjects[0]).filter(k => !k.startsWith("_"));
  const head    = document.getElementById("compareHead");
  const body    = document.getElementById("compareBody");

  head.innerHTML = `<tr>
    <th>Field</th>
    ${subjects.map(s => `<th>${s.email || s._doc_id}</th>`).join("")}
  </tr>`;

  body.innerHTML = allKeys.map(field => {
    const cfg    = fieldConfig[field] ?? {};
    const values = subjects.map(s => s[field]);

    // Green-highlight the highest numeric value across subjects
    const nums    = values.map(v => parseFloat(v));
    const allNums = nums.every(n => !isNaN(n));
    const maxVal  = allNums ? Math.max(...nums) : null;

    return `<tr>
      <td>${cfg.label ?? field.replace(/_/g, " ")}</td>
      ${values.map((val, i) => {
        let cls = thresholdClass(val, cfg);
        if (allNums && nums[i] === maxVal && subjects.length > 1) cls = "cell-pass";
        return `<td class="${cls}">${
          val == null ? "—" : String(val) + (cfg.unit ? " " + cfg.unit : "")
        }</td>`;
      }).join("")}
    </tr>`;
  }).join("");
}
