/**
 * Fetches live data from the BearCase backend and merges it onto the
 * editorial baseline. Works identically for the Express dev server
 * (localhost:3000) and Vercel serverless functions (/api/*).
 */

async function fetchUniverse() {
  try {
    const res = await fetch("/api/universe", {
      headers: { "Accept": "application/json" },
      cache: "no-store"
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} · ${body.slice(0, 200)}`);
    }
    return await res.json();
  } catch (e) {
    window.__BEARCASE_FETCH_ERR = e.message;
    console.warn("BearCase /api/universe failed:", e.message);
    return null;
  }
}

async function refreshCandidates() {
  const live = await fetchUniverse();
  if (!live) {
    window.LIVE_MODE = false;
    return window.CANDIDATES;
  }
  window.LIVE_MODE = true;
  window.LIVE_FETCHED_AT = live.fetchedAt;
  window.LIVE_COUNT = live.liveCount || 0;

  const byTicker = Object.fromEntries(live.candidates.map(c => [c.ticker, c]));
  const merged = window.CANDIDATES.map(base => byTicker[base.ticker]
    ? { ...base, ...byTicker[base.ticker] }
    : base);
  window.CANDIDATES = merged;
  return merged;
}

function setLiveIndicator(state, label, tooltip) {
  const dot  = document.getElementById("liveDot");
  const text = document.getElementById("liveText");
  const wrap = document.getElementById("liveStatus");
  if (!dot || !text || !wrap) return;
  dot.classList.remove("stale");
  if (state === "live")    { text.textContent = label || "Live"; }
  else if (state === "stale") { dot.classList.add("stale"); text.textContent = label || "Offline"; }
  else                     { text.textContent = label || "Connecting…"; }
  if (tooltip) wrap.setAttribute("title", tooltip);
}

window.refreshCandidates = refreshCandidates;
window.setLiveIndicator  = setLiveIndicator;
