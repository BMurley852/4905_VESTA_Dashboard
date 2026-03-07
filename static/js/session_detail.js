/**
 * session_detail.js — Decision-flow detail page for a single session document.
 */

const TXN_TYPE_LABELS = {
  legit:          "Legitimate",
  dupChargeHard:  "Duplicate Charge (Hard)",
  dupChargeEasy:  "Duplicate Charge (Easy)",
  overchargeHard: "Overcharge (Hard)",
  overchargeEasy: "Overcharge (Easy)",
};

function txnTypeLabel(t) { return TXN_TYPE_LABELS[t] ?? t?.replace(/([A-Z])/g, " $1") ?? "Unknown"; }
function fmtCurrency(n)  { return n == null ? "—" : "$" + parseFloat(n).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}); }
function fmtTime(iso)    { return iso ? new Date(iso).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", second:"2-digit"}) : ""; }

// ── Bootstrap ──────────────────────────────────────────────────────────
(async () => {
  try {
    const data = await apiFetch(`/api/sessions/${encodeURIComponent(SESSION_DOC_ID)}`);
    renderHeader(data);
    renderOverallCards(data);
    renderRooms(data);
  } catch (err) {
    document.getElementById("sessionTitle").textContent = "Error loading session";
    document.getElementById("roomSections").innerHTML =
      `<p style="color:var(--danger)">${err.message}</p>`;
  }
})();

// ── Header ─────────────────────────────────────────────────────────────
function renderHeader(data) {
  document.getElementById("sessionTitle").textContent = data.email ?? data.user_id ?? SESSION_DOC_ID;
  document.getElementById("sessionMeta").textContent  = data.user_id ?? "";
}

// ── Overall score cards ────────────────────────────────────────────────
function renderOverallCards(data) {
  let totalEvtCorrect = 0, totalEvt = 0, totalTxnCorrect = 0, totalTxn = 0;

  for (const s of data.sessions) {
    totalEvtCorrect += s.score.events_correct;
    totalEvt        += s.score.events_total;
    totalTxnCorrect += s.score.txns_correct;
    totalTxn        += s.score.txns_total;
  }

  const totalCorrect = totalEvtCorrect + totalTxnCorrect;
  const totalItems   = totalEvt + totalTxn;

  document.getElementById("overallCards").innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Overall Score</div>
      <div class="stat-value mono">${totalCorrect}<span style="font-size:1rem;color:var(--text-dim)"> / ${totalItems}</span></div>
      <div class="stat-sub">${totalItems ? Math.round(totalCorrect/totalItems*100) : 0}% correct</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Events</div>
      <div class="stat-value mono">${totalEvtCorrect}<span style="font-size:1rem;color:var(--text-dim)"> / ${totalEvt}</span></div>
      <div class="stat-sub">Emails &amp; alerts</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Transactions</div>
      <div class="stat-value mono">${totalTxnCorrect}<span style="font-size:1rem;color:var(--text-dim)"> / ${totalTxn}</span></div>
      <div class="stat-sub">Bank charges</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Rooms Completed</div>
      <div class="stat-value mono">${data.sessions.filter(s => !s.incomplete).length}</div>
      <div class="stat-sub">of 4</div>
    </div>`;
}

// ── Rooms ──────────────────────────────────────────────────────────────
function renderRooms(data) {
  const container = document.getElementById("roomSections");
  container.innerHTML = data.sessions.map(renderRoom).join("");
}

function renderRoom(session) {
  const balChange = session.end_bal != null && session.start_bal != null
    ? session.end_bal - session.start_bal : null;
  const balClass  = balChange == null ? "" : balChange >= 0 ? "cell-pass" : "cell-danger";
  const balSign   = balChange >= 0 ? "+" : "";

  const { events_correct, events_total, txns_correct, txns_total } = session.score;
  const roomScore = events_correct + txns_correct;
  const roomTotal = events_total + txns_total;

  return `
    <div class="card room-card${session.incomplete ? " room-incomplete" : ""}">
      <div class="room-header">
        <div class="room-title-group">
          <span class="room-badge">${session.room_code}</span>
          <h2 class="room-name">${session.room_name}</h2>
          ${session.incomplete ? `<span class="fi-tag tag-scam">Incomplete</span>` : ""}
        </div>
        <div class="room-stats">
          <span class="room-stat">
            <span class="stat-label">Balance</span>
            ${fmtCurrency(session.start_bal)} → <span class="${balClass}">${fmtCurrency(session.end_bal)}</span>
            ${balChange != null ? `<span class="${balClass}">(${balSign}${fmtCurrency(balChange)})</span>` : ""}
          </span>
          <span class="room-stat">
            <span class="stat-label">Score</span>
            <strong>${roomScore} / ${roomTotal}</strong>
          </span>
        </div>
      </div>

      <div class="flow">
        ${session.rounds.map(r => renderRound(r)).join("")}
      </div>
    </div>`;
}

function renderRound(round) {
  const parts = [];

  if (round.buy && round.buy.item) {
    parts.push(renderPurchase(round.buy));
  }

  for (const evt of round.events) {
    parts.push(renderEvent(evt));
  }
  for (const txn of round.transactions) {
    parts.push(renderTransaction(txn));
  }

  if (!parts.length) return "";

  const label = round.id ? `Round ${round.id}` : "Session Items";
  return `
    <div class="flow-group">
      <div class="flow-group-label">${label}</div>
      ${parts.join("")}
    </div>`;
}

// ── Flow items ─────────────────────────────────────────────────────────
function renderPurchase(buy) {
  return `
    <div class="flow-item fi-purchase">
      <div class="fi-icon">🛒</div>
      <div class="fi-body">
        <div class="fi-title">${buy.item}</div>
        <div class="fi-meta">
          <span class="fi-tag tag-purchase">Purchase</span>
          <span>${fmtCurrency(buy.cost)}</span>
          ${buy.time ? `<span class="fi-time">${fmtTime(buy.time)}</span>` : ""}
        </div>
      </div>
    </div>`;
}

function renderEvent(evt) {
  const correct   = evt.pnt === 1 || evt.pnt === "1";
  const isScam    = evt.type === "scam";
  const responded = evt.resp ?? "—";

  // Correct = responded correctly (approved legit OR denied scam)
  const outcomeClass = correct ? "fi-correct" : "fi-incorrect";
  const outcomeIcon  = correct ? "✓" : "✗";

  return `
    <div class="flow-item fi-event ${outcomeClass}">
      <div class="fi-icon">📧</div>
      <div class="fi-body">
        <div class="fi-title">${evt.name ?? "Unknown event"}</div>
        <div class="fi-meta">
          <span class="fi-tag ${isScam ? "tag-scam" : "tag-legit"}">${isScam ? "Scam" : "Legit"}</span>
          ${evt.lvl ? `<span class="fi-tag tag-diff-${evt.lvl}">${evt.lvl}</span>` : ""}
          <span class="fi-resp">${responded.toUpperCase()}</span>
          <span class="fi-outcome">${outcomeIcon}</span>
          ${evt.time ? `<span class="fi-time">${fmtTime(evt.time)}</span>` : ""}
        </div>
      </div>
    </div>`;
}

function renderTransaction(txn) {
  const correct      = txn.pnt === 1 || txn.pnt === "1";
  const isLegit      = txn.type === "legit";
  const outcomeClass = correct ? "fi-correct" : "fi-incorrect";
  const outcomeIcon  = correct ? "✓" : "✗";

  return `
    <div class="flow-item fi-txn ${outcomeClass}">
      <div class="fi-icon">💳</div>
      <div class="fi-body">
        <div class="fi-title">${txn.desc ?? "Transaction"}</div>
        <div class="fi-meta">
          <span class="fi-tag ${isLegit ? "tag-legit" : "tag-scam"}">${txnTypeLabel(txn.type)}</span>
          <span class="mono" style="font-size:.85rem">${fmtCurrency(txn.amt)}</span>
          ${txn.bal != null ? `<span class="fi-dim">bal: ${fmtCurrency(txn.bal)}</span>` : ""}
          <span class="fi-resp">${(txn.resp ?? "—").toUpperCase()}</span>
          <span class="fi-outcome">${outcomeIcon}</span>
          ${txn.time ? `<span class="fi-time">${fmtTime(txn.time)}</span>` : ""}
        </div>
      </div>
    </div>`;
}
