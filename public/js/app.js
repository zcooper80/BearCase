/**
 * BearCase application controller.
 */

const state = {
  pool: 1000, horizon: "medium", multiplier: 2,
  riskProfile: "balanced", aiWeight: 40
};
const POOLS = [500, 1000, 2000, 5000, 10000, 25000, 50000, 100000];

function readState() {
  state.pool       = parseInt(document.getElementById("pool").value, 10);
  state.horizon    = document.getElementById("horizon").value;
  state.multiplier = parseInt(document.getElementById("multiplier").value, 10);
  state.aiWeight   = parseInt(document.getElementById("aiWeight").value, 10);
  const active = document.querySelector(".segmented button.active");
  if (active) state.riskProfile = active.dataset.risk;
}

function run() {
  readState();
  const scored = scoreUniverse(window.CANDIDATES, {
    horizon: state.horizon, aiWeightPct: state.aiWeight, riskProfile: state.riskProfile
  });
  const port = buildPortfolio(scored, {
    pool: state.pool, riskProfile: state.riskProfile, multiplier: state.multiplier
  });
  const scaling = scaleAcrossPools(scored, POOLS, {
    riskProfile: state.riskProfile, multiplier: state.multiplier
  });

  renderSummary(port);
  renderPortfolioTable(port);
  renderBreakdown(port);
  renderRiskPlan(port, scaling);
  renderUniverse(scored);
}

function showLoading() {
  document.getElementById("summary").innerHTML = `
    <div class="loading"><span class="spinner"></span>Fetching live market data…</div>`;
}

async function refreshAndRun() {
  showLoading();
  setLiveIndicator("loading", "Fetching…");
  await refreshCandidates();
  const anyLive = window.CANDIDATES.some(c => c._live && c._live.price != null);
  const liveCount = window.LIVE_COUNT || 0;
  if (window.LIVE_MODE && anyLive) {
    const when = window.LIVE_FETCHED_AT
      ? new Date(window.LIVE_FETCHED_AT).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})
      : "now";
    setLiveIndicator("live", `Live · ${liveCount}/${window.CANDIDATES.length} · ${when}`);
  } else if (window.LIVE_MODE) {
    // Backend reachable but upstream (Yahoo/SEC) gave nothing live.
    // Pull meta from one candidate to surface the real error.
    const sample = window.CANDIDATES.find(c => c._meta?.errors?.length);
    const why = sample?._meta?.errors?.[0]?.err || "upstream providers blocked";
    setLiveIndicator("stale", "Live provider blocked · baseline", `Upstream: ${why}`);
  } else {
    const why = window.__BEARCASE_FETCH_ERR || "backend unreachable";
    setLiveIndicator("stale", "API unreachable · baseline", why);
  }
  run();
}

function bindEvents() {
  document.getElementById("pool").addEventListener("change", run);
  document.getElementById("horizon").addEventListener("change", run);
  document.getElementById("aiWeight").addEventListener("input", e => {
    document.getElementById("aiWeightVal").textContent = e.target.value + "%";
    run();
  });
  document.getElementById("multiplier").addEventListener("input", e => {
    document.getElementById("multVal").textContent = e.target.value + "×";
    run();
  });
  document.querySelectorAll("#riskSeg button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#riskSeg button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      run();
    });
  });
  document.getElementById("runAnalysis").addEventListener("click", run);
  document.getElementById("refreshBtn").addEventListener("click", refreshAndRun);
  document.getElementById("themeToggle").addEventListener("click", toggleTheme);
}

function toggleTheme() {
  const root = document.documentElement;
  const cur = root.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem("bearcase-theme", next);
}

function initTheme() {
  const saved = localStorage.getItem("bearcase-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
}

document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  bindEvents();
  // First render with editorial data, then enrich with live
  run();
  await refreshAndRun();
});
