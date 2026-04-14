/**
 * BearCase application controller
 * Wires inputs to scoring/portfolio/render pipeline.
 */

const state = {
  pool: 1000,
  horizon: "medium",
  multiplier: 2,
  riskProfile: "balanced",
  aiWeight: 40
};

const POOLS = [500, 1000, 2000, 5000, 10000, 25000, 50000, 100000];

function readState() {
  state.pool        = parseInt(document.getElementById("pool").value, 10);
  state.horizon     = document.getElementById("horizon").value;
  state.multiplier  = parseInt(document.getElementById("multiplier").value, 10);
  state.aiWeight    = parseInt(document.getElementById("aiWeight").value, 10);
  // riskProfile is driven by active button
  const activeBtn = document.querySelector(".risk-btn.active");
  if (activeBtn) state.riskProfile = activeBtn.dataset.risk;
}

function run() {
  readState();
  const scored = scoreUniverse(window.CANDIDATES, {
    horizon:     state.horizon,
    aiWeightPct: state.aiWeight,
    riskProfile: state.riskProfile
  });
  const port = buildPortfolio(scored, {
    pool:        state.pool,
    riskProfile: state.riskProfile,
    multiplier:  state.multiplier
  });
  const poolScaling = scaleAcrossPools(scored, POOLS, {
    riskProfile: state.riskProfile,
    multiplier:  state.multiplier
  });

  renderSummary(port, scored);
  renderPortfolioTable(port);
  renderBreakdown(port);
  renderRiskPlan(port, poolScaling);
  renderUniverse(scored);
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
  document.querySelectorAll(".risk-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".risk-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      run();
    });
  });
  document.getElementById("runAnalysis").addEventListener("click", run);
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  run();
});
