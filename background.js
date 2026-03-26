// background.js
const BASE_URL = "https://my-safe-sites-website-blocker.vercel.app"; // ← CHANGE THIS

const BLOCK_THRESHOLD = 50; // maliciousScore >= this → hard block page
const CACHE_TTL = 10 * 60 * 1000; // cache results for 10 min per domain
const CHECK_CACHE = new Map(); // domain → { result, timestamp }

// ── Entry points ───────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => syncBlockedSites());
chrome.runtime.onStartup.addListener(()   => syncBlockedSites());

function isBaseUrl(url) {
  try {
    const target = new URL(url);
    const base = new URL(BASE_URL);
    return target.hostname === base.hostname;
  } catch {
    return false;
  }
}

// Fire on every completed page load
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab.url || !tab.url.startsWith("http")) return;

  if (isBaseUrl(tab.url)) return;

  chrome.storage.local.get("enabled", ({ enabled }) => {
    if (enabled === false) return;
    checkUrlSafety(tabId, tab.url);
  });
});

// Messages from popup.js / content.js
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "SYNC")       { syncBlockedSites().then(() => sendResponse({ ok: true })); return true; }
  if (msg.type === "ENABLE")     { setEnabled(true).then(() => sendResponse({ ok: true }));   return true; }
  if (msg.type === "DISABLE")    { setEnabled(false).then(() => sendResponse({ ok: true }));  return true; }
  if (msg.type === "STATUS")     { getStatus().then(sendResponse);                            return true; }
  if (msg.type === "GET_RESULT") { sendResponse(CHECK_CACHE.get(msg.domain) || null);         return false; }
});

// ── Safety check ───────────────────────────────────────────────────────────

async function checkUrlSafety(tabId, url) {
  if (isBaseUrl(url)) return;
  try {
    const domain = new URL(url).hostname;
    if (!domain) return;

    // Use cache if fresh
    const cached = CHECK_CACHE.get(domain);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      handleSafetyResult(tabId, url, cached.result);
      return;
    }

    const res = await fetch(`${BASE_URL}/api/safety`, {
      method:      "POST",
      credentials: "include",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({ url }),
    });

    if (!res.ok) return;

    const result = await res.json();
    CHECK_CACHE.set(domain, { result, timestamp: Date.now() });
    handleSafetyResult(tabId, url, result);

  } catch (err) {
    console.error("Safety check failed:", err);
  }
}

function handleSafetyResult(tabId, url, result) {
  if (!result) return;

  // Tell content.js to show the safety badge on the page
  chrome.tabs.sendMessage(tabId, {
    type: "SAFETY_RESULT",
    result,
  }).catch(() => {});

  // Hard block if dangerous
  if (result.danger && result.maliciousScore >= BLOCK_THRESHOLD) {
    chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL(
        `blocked.html?url=${encodeURIComponent(url)}&msg=${encodeURIComponent(result.message)}&score=${result.maliciousScore}`
      ),
    });
  }
}

// ── Blocked sites (existing) ───────────────────────────────────────────────

async function syncBlockedSites() {
  try {
    const { enabled } = await chrome.storage.local.get("enabled");
    const res = await fetch(`${BASE_URL}/api/blocklist`, { credentials: "include" });

    if (!res.ok) {
      await clearAllRules();
      await chrome.storage.local.set({ loggedIn: false, sites: [] });
      return;
    }

    const { sites = [] } = await res.json();
    await chrome.storage.local.set({ loggedIn: true, sites });
    if (enabled !== false) await applyRules(sites);
  } catch (err) {
    console.error("Sync failed:", err);
  }
}

async function applyRules(sites) {
  await clearAllRules();
  if (!sites.length) return;
  const rules = sites.map((site, i) => ({
    id: i + 1, priority: 1,
    action: { type: "redirect", redirect: { extensionPath: `/blocked.html?domain=${encodeURIComponent(site.domain)}` } },
    condition: { urlFilter: `||${site.domain}^`, resourceTypes: ["main_frame"] },
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [], addRules: rules });
}

async function clearAllRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const ids = existing.map((r) => r.id);
  if (ids.length) await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ids, addRules: [] });
}

async function setEnabled(value) {
  await chrome.storage.local.set({ enabled: value });
  if (value) { const { sites } = await chrome.storage.local.get("sites"); await applyRules(sites || []); }
  else await clearAllRules();
}

async function getStatus() {
  const data = await chrome.storage.local.get(["enabled", "loggedIn", "sites"]);
  return { enabled: data.enabled !== false, loggedIn: data.loggedIn ?? false, count: (data.sites || []).length };
}