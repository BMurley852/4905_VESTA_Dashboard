/**
 * dashboard.js — Shared utilities used across all pages.
 */

// ── API helpers ────────────────────────────────────────────────────────
async function apiFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== "ok") throw new Error(json.message || "API error");
  return json.data;
}

// ── Value formatting ───────────────────────────────────────────────────
function formatValue(value, fieldConfig) {
  if (value === null || value === undefined) return "—";

  const fmt = fieldConfig?.fmt ?? "text";
  const unit = fieldConfig?.unit ?? "";

  if (fmt === "percent" || fmt === "number") {
    const num = parseFloat(value);
    if (isNaN(num)) return String(value);
    return num.toLocaleString(undefined, { maximumFractionDigits: 1 }) + unit;
  }
  if (fmt === "date") {
    try { return new Date(value).toLocaleDateString(); } catch { return value; }
  }
  return String(value) + (unit ? " " + unit : "");
}

// ── Threshold CSS class ────────────────────────────────────────────────
function thresholdClass(value, fieldConfig) {
  const thresholds = fieldConfig?.thresholds;
  if (!thresholds) return "";
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  if (num < thresholds.fail) return "cell-danger";
  if (num < thresholds.warn) return "cell-warn";
  return "cell-pass";
}

// ── Score-card tier ────────────────────────────────────────────────────
function scoreTier(value, fieldConfig) {
  const thresholds = fieldConfig?.thresholds;
  if (!thresholds) return "";
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  if (num < thresholds.fail) return "fail";
  if (num < thresholds.warn) return "warn";
  return "pass";
}

// ── Status badge ───────────────────────────────────────────────────────
function statusBadge(status) {
  const map = {
    pass: "badge-pass", passed: "badge-pass",
    warn: "badge-warn", warning: "badge-warn", pending: "badge-warn",
    fail: "badge-fail", failed: "badge-fail",
  };
  const cls = map[(status || "").toLowerCase()] ?? "badge-warn";
  return `<span class="badge ${cls}">${status ?? "?"}</span>`;
}

// ── Comparison selection (localStorage-backed) ─────────────────────────
const CompareSelection = {
  KEY: "compare_ids",
  get() {
    try { return JSON.parse(sessionStorage.getItem(this.KEY) || "[]"); }
    catch { return []; }
  },
  set(ids) { sessionStorage.setItem(this.KEY, JSON.stringify(ids)); },
  add(id) {
    const ids = this.get();
    if (!ids.includes(id)) ids.push(id);
    this.set(ids);
  },
  remove(id) { this.set(this.get().filter(x => x !== id)); },
  has(id) { return this.get().includes(id); },
  clear() { this.set([]); },
};

// ── Chart colour palette ───────────────────────────────────────────────
const CHART_COLORS = [
  "#4f86c6","#e07b39","#4caf7d","#b05ccc",
  "#d94f4f","#f0c040","#4dc9c9","#a0a0a0",
];

Chart.defaults.color = "#7a8ba8";
Chart.defaults.borderColor = "#2a3347";
Chart.defaults.font.family = "'DM Sans', sans-serif";
