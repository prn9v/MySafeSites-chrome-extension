// blocked.js
// Separate file required by Chrome CSP — no inline scripts allowed in extensions

const BASE_URL = "https://my-safe-sites-website-blocker.vercel.app"; // ← CHANGE THIS

const params = new URLSearchParams(window.location.search);
const domain = params.get("domain");
const url    = params.get("url");
const msg    = params.get("msg");
const score  = parseInt(params.get("score") || "0");

// Work out what to display in the URL badge
let display = "this site";
if (domain) {
  display = domain;
} else if (url) {
  try { display = new URL(decodeURIComponent(url)).hostname; } catch { display = url; }
}

document.getElementById("url-badge").textContent = display;
document.title = `Blocked: ${display} – MySafeSites`;

if (score > 0) {
  // ── AI-triggered block ─────────────────────────
  document.getElementById("icon-wrap").className   = "icon-wrap danger";
  document.getElementById("reason-tag").textContent = "⚠️ AI Threat Detected";
  document.getElementById("reason-tag").className  = "reason-tag ai";
  document.getElementById("title").textContent     = "Dangerous Site Detected";
  document.getElementById("desc").textContent      =
    "Our AI model flagged this site as potentially harmful. It may be a phishing, spoofing, or malware site.";

  // Show score meter
  document.getElementById("score-section").style.display = "block";
  document.getElementById("score-number").textContent    = `${score}%`;
  document.getElementById("meter-fill").style.width      = `${score}%`;

  if (msg) {
    document.getElementById("ai-msg").textContent = decodeURIComponent(msg);
  }

} else {
  // ── Manual block list ──────────────────────────
  document.getElementById("icon-wrap").className   = "icon-wrap blocked";
  document.getElementById("reason-tag").textContent = "🚫 On Block List";
  document.getElementById("reason-tag").className  = "reason-tag manual";
}

// ── Button listeners ───────────────────────────────
// FIX: addEventListener instead of onclick="" inline handlers
document.getElementById("btn-back").addEventListener("click", () => {
  history.back();
});

document.getElementById("btn-dashboard").addEventListener("click", () => {
  chrome.tabs.create({ url: `${BASE_URL}/dashboard` });
});