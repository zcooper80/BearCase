/**
 * Fetches live data from the BearCase backend and merges it into the static
 * candidate universe. Falls back silently to baseline editorial data if the
 * backend is offline (e.g. when opened directly as file://).
 */

async function fetchUniverse() {
  try {
    const res = await fetch("/api/universe", { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error("Backend " + res.status);
    return await res.json();
  } catch (e) {
    console.warn("Live data unavailable, using editorial fallback:", e.message);
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

  // Merge onto base by ticker
  const byTicker = Object.fromEntries(live.candidates.map(c => [c.ticker, c]));
  const merged = window.CANDIDATES.map(base => byTicker[base.ticker]
    ? { ...base, ...byTicker[base.ticker] }
    : base);
  window.CANDIDATES = merged;
  return merged;
}

function setLiveIndicator(state, label) {
  const dot  = document.getElementById("liveDot");
  const text = document.getElementById("liveText");
  if (!dot || !text) return;
  dot.classList.remove("stale");
  if (state === "live")    { text.textContent = label || "Live"; }
  else if (state === "stale") { dot.classList.add("stale"); text.textContent = label || "Offline"; }
  else                     { text.textContent = label || "Connecting…"; }
}

window.refreshCandidates = refreshCandidates;
window.setLiveIndicator  = setLiveIndicator;
