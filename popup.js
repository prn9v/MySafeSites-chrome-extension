// popup.js
const BASE_URL = "https://my-safe-sites-website-blocker.vercel.app"; // ← CHANGE THIS

// ── On popup open ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await renderStatus();
  setupListeners();
});

// ── Render current status ──────────────────────────────────────────────────
async function renderStatus() {
  const status = await sendMessage({ type: "STATUS" });

  const toggleEl     = document.getElementById("enable-toggle");
  const toggleLabel  = document.getElementById("toggle-label");
  const loggedInView = document.getElementById("logged-in-view");
  const loggedOutView= document.getElementById("logged-out-view");

  toggleEl.checked = status.enabled;
  toggleLabel.textContent = status.enabled ? "On" : "Off";

  if (!status.loggedIn) {
    loggedOutView.style.display = "block";
    loggedInView.style.display  = "none";
    return;
  }

  loggedInView.style.display  = "block";
  loggedOutView.style.display = "none";

  // Status badge
  const statusBadge = document.getElementById("status-badge");
  statusBadge.textContent = status.enabled ? "Active" : "Paused";
  statusBadge.className   = `badge ${status.enabled ? "badge-on" : "badge-off"}`;

  // Count badge
  document.getElementById("count-badge").textContent = status.count;

  // Sites list
  const { sites } = await chrome.storage.local.get("sites");
  renderSitesList(sites || []);
}

function renderSitesList(sites) {
  const list = document.getElementById("sites-list");

  if (!sites.length) {
    list.innerHTML = `<div class="empty">No sites blocked yet.<br/>Add some on your dashboard.</div>`;
    return;
  }

  list.innerHTML = sites
    .map(
      (s) => `
      <div class="site-item">
        <span class="dot"></span>
        ${escapeHtml(s.domain)}
      </div>`
    )
    .join("");
}

// ── Event listeners ────────────────────────────────────────────────────────
function setupListeners() {
  // Enable / disable toggle
  document.getElementById("enable-toggle").addEventListener("change", async (e) => {
    const label = document.getElementById("toggle-label");
    label.textContent = e.target.checked ? "On" : "Off";
    await sendMessage({ type: e.target.checked ? "ENABLE" : "DISABLE" });
    await renderStatus();
  });

  // Sync now button
  document.getElementById("refresh-btn").addEventListener("click", async () => {
    const btn = document.getElementById("refresh-btn");
    btn.textContent = "Syncing...";
    btn.disabled = true;
    await sendMessage({ type: "SYNC" });
    await renderStatus();
    btn.textContent = "↻ Sync Now";
    btn.disabled = false;
  });

  // Dashboard button
  document.getElementById("dashboard-btn").addEventListener("click", () => {
    chrome.tabs.create({ url: `${BASE_URL}/dashboard` });
  });

  // Login button (logged-out view)
  document.getElementById("login-btn")?.addEventListener("click", () => {
    chrome.tabs.create({ url: `${BASE_URL}/login` });
  });

  // Retry sync button (logged-out view)
  document.getElementById("sync-btn")?.addEventListener("click", async () => {
    await sendMessage({ type: "SYNC" });
    await renderStatus();
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────
function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res) => resolve(res || {}));
  });
}

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}