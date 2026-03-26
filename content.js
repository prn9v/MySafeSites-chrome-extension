// content.js
// Injected into every page by Chrome — shows safety badge bottom-right

let badgeEl = null;

// Listen for safety result sent from background.js
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SAFETY_RESULT") {
    showBadge(msg.result);
  }
});

function showBadge(result) {
  // Remove existing badge if any
  if (badgeEl) {
    badgeEl.remove();
    badgeEl = null;
  }

  const { score, maliciousScore, message, danger } = result;

  // ── Build badge element ────────────────────────
  badgeEl = document.createElement("div");
  badgeEl.id = "__mss_badge__";

  // Determine color tier
  let tier = "safe";
  if (maliciousScore >= 50)      tier = "danger";
  else if (maliciousScore >= 20) tier = "warning";

  // Inject scoped styles once
  if (!document.getElementById("__mss_styles__")) {
    const style = document.createElement("style");
    style.id = "__mss_styles__";
    style.textContent = `
      #__mss_badge__ {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        border-radius: 12px;
        padding: 10px 14px;
        min-width: 210px;
        max-width: 270px;
        font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
        font-size: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        animation: __mss_in 0.3s ease;
        border: 1px solid;
      }
      @keyframes __mss_in {
        from { opacity:0; transform:translateY(10px); }
        to   { opacity:1; transform:translateY(0); }
      }
      #__mss_badge__.safe    { background:#052e16; border-color:#14532d; color:#86efac; }
      #__mss_badge__.warning { background:#451a03; border-color:#7c2d12; color:#fdba74; }
      #__mss_badge__.danger  { background:#450a0a; border-color:#7f1d1d; color:#fca5a5; }

      .__mss_header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
        font-weight: 600;
      }
      .__mss_logo { display:flex; align-items:center; gap:6px; }
      .__mss_close {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        opacity: 0.7;
        color: inherit;
        padding: 0;
      }
      .__mss_close:hover { opacity: 1; }

      .__mss_label {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        margin-bottom: 4px;
        opacity: 0.85;
      }
      .__mss_bar_bg {
        background: rgba(255,255,255,0.1);
        border-radius: 4px;
        height: 5px;
        overflow: hidden;
        margin-bottom: 6px;
      }
      .__mss_bar_fill {
        height: 100%;
        border-radius: 4px;
        background: currentColor;
        transition: width 0.5s ease;
      }
      .__mss_msg { font-size: 11px; opacity: 0.85; line-height: 1.4; }
    `;
    document.head.appendChild(style);
  }

  badgeEl.className = tier;

  badgeEl.innerHTML = `
    <div class="__mss_header">
      <div class="__mss_logo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        MySafeSites
      </div>
      <button class="__mss_close" id="__mss_close_btn__">×</button>
    </div>

    <div class="__mss_label">
      <span>Safety Score</span>
      <strong>${score}%</strong>
    </div>
    <div class="__mss_bar_bg">
      <div class="__mss_bar_fill" style="width:${score}%"></div>
    </div>

    <div class="__mss_msg">${message || ""}</div>
  `;

  document.body.appendChild(badgeEl);

  // Close button — addEventListener, not onclick
  document.getElementById("__mss_close_btn__").addEventListener("click", () => {
    badgeEl?.remove();
    badgeEl = null;
  });

  // Auto-hide safe badges after 4 seconds
  if (!danger) {
    setTimeout(() => {
      if (badgeEl) {
        badgeEl.style.opacity = "0";
        badgeEl.style.transition = "opacity 0.5s";
        setTimeout(() => { badgeEl?.remove(); badgeEl = null; }, 500);
      }
    }, 4000);
  }
}