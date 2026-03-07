/**
 * sessions.js — Session search page.
 */

const searchInput = document.getElementById("sessionSearch");
const searchBtn   = document.getElementById("searchBtn");
const resultsEl   = document.getElementById("searchResults");

searchBtn.addEventListener("click", runSearch);
searchInput.addEventListener("keydown", e => { if (e.key === "Enter") runSearch(); });

async function runSearch() {
  const q = searchInput.value.trim();
  if (!q) return;

  resultsEl.innerHTML = `<p class="table-loading">Searching…</p>`;
  try {
    const results = await apiFetch(`/api/sessions?q=${encodeURIComponent(q)}`);
    renderResults(results);
  } catch (err) {
    resultsEl.innerHTML = `<p style="color:var(--danger);padding:.75rem 0">Error: ${err.message}</p>`;
  }
}

function renderResults(results) {
  if (!results.length) {
    resultsEl.innerHTML = `<p class="table-loading">No sessions found.</p>`;
    return;
  }

  resultsEl.innerHTML = `
    <div class="table-wrap" style="margin-top:1rem">
      <table class="table">
        <thead>
          <tr>
            <th>Email</th>
            <th>User ID</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${results.map(r => `
            <tr>
              <td>${r.email ?? "—"}</td>
              <td class="mono" style="font-size:.8rem">${r.user_id ?? r._doc_id}</td>
              <td>
                <a href="/sessions/${encodeURIComponent(r._doc_id)}"
                   class="btn btn-outline" style="padding:.25rem .6rem;font-size:.78rem">
                  View flow
                </a>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}
