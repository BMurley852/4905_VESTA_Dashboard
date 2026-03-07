/**
 * subject.js — Detail page for a single subject.
 */

(async () => {
  try {
    const [data, fieldConfig] = await Promise.all([
      apiFetch(`/api/subjects/${encodeURIComponent(SUBJECT_ID)}`),
      apiFetch("/api/config"),
    ]);
    renderScoreCards(data, fieldConfig);
    renderDetailList(data, fieldConfig);
    renderBreakdown(data, fieldConfig);
  } catch (err) {
    document.getElementById("scoreCards").innerHTML =
      `<p style="color:var(--danger)">Error: ${err.message}</p>`;
  }
})();

// ── Score cards ────────────────────────────────────────────────────────
function renderScoreCards(data, fieldConfig) {
  const numericFields = Object.entries(fieldConfig)
    .filter(([, cfg]) => cfg.fmt === "number" || cfg.fmt === "percent");

  const container = document.getElementById("scoreCards");

  container.innerHTML = numericFields.map(([field, cfg]) => {
    const val = data[field];
    if (val === undefined || val === null) return "";
    const num  = parseFloat(val);
    const tier = scoreTier(num, cfg);
    const display = isNaN(num) ? val : num.toLocaleString();
    return `
      <div class="score-card ${tier}">
        <div class="sc-label">${cfg.label}</div>
        <div class="sc-value mono">${display}<small style="font-size:.9rem">${cfg.unit ? " " + cfg.unit : ""}</small></div>
      </div>`;
  }).join("");
}

// ── Detail list ────────────────────────────────────────────────────────
function renderDetailList(data, fieldConfig) {
  const numericKeys = new Set(
    Object.entries(fieldConfig)
      .filter(([, cfg]) => cfg.fmt === "number" || cfg.fmt === "percent")
      .map(([k]) => k)
  );

  const dl = document.getElementById("detailList");

  dl.innerHTML = Object.entries(data)
    .filter(([k]) => !k.startsWith("_") && !numericKeys.has(k))
    .map(([k, v]) => {
      const label = fieldConfig[k]?.label ?? k.replace(/_/g, " ");
      return `
        <dt>${label}</dt>
        <dd>${k === "status" ? statusBadge(v) : (v ?? "—")}</dd>`;
    })
    .join("");
}

// ── Category breakdown chart ───────────────────────────────────────────
function renderBreakdown(data, fieldConfig) {
  const numericFields = Object.entries(fieldConfig)
    .filter(([, cfg]) => cfg.fmt === "number" || cfg.fmt === "percent")
    .map(([key, cfg]) => ({ key, label: cfg.label, val: parseFloat(data[key]) }))
    .filter(f => !isNaN(f.val));

  if (!numericFields.length) {
    document.querySelector(".two-col .card:last-child").style.display = "none";
    return;
  }

  const ctx = document.getElementById("radarChart").getContext("2d");

  const labels = numericFields.map(f => f.label);
  const values = numericFields.map(f => f.val);

  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: CHART_COLORS.slice(0, values.length).map(c => c + "cc"),
        borderColor: CHART_COLORS.slice(0, values.length),
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: "#2a3347" } },
        y: { grid: { color: "#2a3347" } },
      },
    },
  });
}

// ── Add to comparison ──────────────────────────────────────────────────
const addBtn = document.getElementById("addToCompareBtn");
const id     = addBtn?.dataset.id;

function syncBtn() {
  if (!addBtn) return;
  const inSet = CompareSelection.has(id);
  addBtn.textContent = inSet ? "✓ In comparison" : "Add to comparison";
  addBtn.className   = inSet ? "btn btn-primary" : "btn btn-outline";
}
syncBtn();

addBtn?.addEventListener("click", () => {
  if (CompareSelection.has(id)) CompareSelection.remove(id);
  else CompareSelection.add(id);
  syncBtn();
});
