/**
 * BearCase Render Layer
 * Renders scored candidates, constructed portfolio, and risk plan into the DOM.
 */

const FACTOR_META = {
  valuation: { label: "Valuation Extremes",     color: "var(--c1)" },
  quality:   { label: "Business-Quality Decay", color: "var(--c2)" },
  balance:   { label: "Balance-Sheet Stress",   color: "var(--c3)" },
  filings:   { label: "Filing Red Flags",       color: "var(--c4)" },
  technical: { label: "Technical Breakdown",    color: "var(--c5)" },
  shortInt:  { label: "Short-Interest Trend",   color: "var(--c6)" },
  macro:     { label: "Macro / Sector",         color: "var(--c7)" },
  aiRisk:    { label: "AI-Automation Risk",     color: "var(--c8)" }
};

const fmt$ = n => n >= 1000
  ? "$" + Math.round(n).toLocaleString()
  : "$" + n.toFixed(2);
const fmtPct = n => (n * 100).toFixed(1) + "%";

function renderSummary(port, scored) {
  const el = document.getElementById("summary");
  const topName = port.positions[0] || {};
  el.innerHTML = `
    <div class="summary-card">
      <div class="label">Capital At Work</div>
      <div class="value">${fmt$(port.capitalAtWork)}</div>
      <div class="sub">${fmt$(port.marginReserve)} held as reserve buffer</div>
    </div>
    <div class="summary-card negative">
      <div class="label">Defined Max Loss</div>
      <div class="value">${fmt$(port.totalMaxLoss)}</div>
      <div class="sub">${((port.totalMaxLoss / port.pool) * 100).toFixed(1)}% of starting pool</div>
    </div>
    <div class="summary-card">
      <div class="label">Effective Notional</div>
      <div class="value">${fmt$(port.totalNotional)}</div>
      <div class="sub">${port.leverage.toFixed(2)}× gross leverage</div>
    </div>
    <div class="summary-card">
      <div class="label">Positions</div>
      <div class="value">${port.positions.length}</div>
      <div class="sub">${port.riskProfile.toUpperCase()} · ${port.multiplier}× risk</div>
    </div>
    <div class="summary-card">
      <div class="label">Top Conviction</div>
      <div class="value">${topName.ticker || "—"}</div>
      <div class="sub">Score ${(topName._score || 0).toFixed(2)} / 10</div>
    </div>
  `;
}

function renderPortfolioTable(port) {
  const el = document.getElementById("portfolio");
  const rows = port.positions.map(p => {
    const instr = instructionString(p);
    const scoreCls = p._score >= 6.5 ? "high" : p._score >= 4.5 ? "med" : "low";
    return `
      <tr>
        <td><span class="ticker">${p.ticker}</span><br>
            <span class="pos-instr">${p.company}</span></td>
        <td>${p.sector}</td>
        <td><span class="score-pill ${scoreCls}">${p._score.toFixed(2)}</span></td>
        <td>${fmtPct(p.weight)}</td>
        <td>${fmt$(p.capital)}</td>
        <td>${p.vehicle.kind.replace("-", " ")}</td>
        <td class="pos-instr">${instr}</td>
        <td>${fmt$(p.maxLossDollars)}</td>
      </tr>`;
  }).join("");

  el.innerHTML = `
    <div class="section-title">Recommended Short Portfolio</div>
    <table class="portfolio-table">
      <thead><tr>
        <th>Ticker</th><th>Sector</th><th>Score</th><th>Weight</th>
        <th>Capital</th><th>Vehicle</th><th>Position Instruction</th><th>Max Loss</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:var(--muted);font-size:12px;margin-top:10px;">
      ${port.profile.description}
    </p>
  `;
}

function instructionString(p) {
  switch (p.vehicle.kind) {
    case "short":
      return `Short ${p.shares} sh @ ~${fmt$(p.price)} · stop ${fmt$(p.stopPrice)}`;
    case "short+put":
      return `Short ${p.shares} sh + buy 1 OTM put hedge`;
    case "put":
      return `Buy ${p.contracts} × ~90 DTE ATM puts @ ~${fmt$(p.premiumPerContract / 100)}/sh`;
    case "put-spread":
      return `Buy ${p.contracts} × ATM put, sell equal OTM put — debit spread`;
    case "put-otm":
      return `Buy ${p.contracts} × deep-OTM puts (≤0.20 delta)`;
    default: return "—";
  }
}

function renderBreakdown(port) {
  const el = document.getElementById("breakdown");
  const cards = port.positions.map(p => {
    const factors = Object.keys(FACTOR_META).map(k => {
      const meta = FACTOR_META[k];
      const v = p[k];
      return `
        <div class="factor">
          <div class="f-name">${meta.label}</div>
          <div class="f-bar"><div class="f-fill"
            style="width:${v * 10}%;background:${meta.color};"></div></div>
          <div class="f-val"><strong>${v}/10</strong></div>
        </div>`;
    }).join("");

    const thesis = p.thesis.map(t => `<li>${t}</li>`).join("");
    const catalysts = p.catalysts.join(" · ");

    return `
      <div class="stock-card">
        <div class="stock-card-head">
          <div>
            <div class="title"><span class="ticker">${p.ticker}</span>
              <span style="color:var(--muted);font-weight:400;margin-left:8px;">${p.sector}</span></div>
            <div class="company">${p.company} · ref. price ${fmt$(p.price)}</div>
          </div>
          <div class="alloc">
            <div class="num">${fmt$(p.capital)}</div>
            <div class="lbl">Allocation (${fmtPct(p.weight)})</div>
          </div>
        </div>

        <div class="factor-grid">${factors}</div>

        <div class="bear-thesis">
          <h4>Bear Thesis — why this name, now</h4>
          <ul>${thesis}</ul>
          <div style="font-size:11px;color:var(--muted);margin-top:8px;">
            Catalysts to monitor: ${catalysts}
          </div>
        </div>

        <div class="trade-instr">
          <div class="row"><span class="k">Vehicle</span>
            <span class="v">${p.vehicle.kind} · ${p.vehicle.leverage}× effective</span></div>
          <div class="row"><span class="k">Instruction</span>
            <span class="v">${instructionString(p)}</span></div>
          <div class="row"><span class="k">Reference price</span>
            <span class="v">${fmt$(p.price)}</span></div>
          <div class="row"><span class="k">Stop / invalidation</span>
            <span class="v">${fmt$(p.stopPrice)} (+${(port.profile.stopLossPct*100).toFixed(0)}%)</span></div>
          <div class="row"><span class="k">Max defined loss</span>
            <span class="v">${fmt$(p.maxLossDollars)}</span></div>
          <div class="row"><span class="k">Effective notional</span>
            <span class="v">${fmt$(p.effectiveNotional)}</span></div>
          <div class="row"><span class="k">Squeeze risk / Beta</span>
            <span class="v">${p.squeezeRisk}/10 · β ${p.beta}</span></div>
        </div>

        ${p.squeezeRisk >= 7 ? `
          <div class="risk-warn">
            <strong>⚠ Elevated squeeze risk.</strong> ${p.vehicle.note}
          </div>` : p.vehicle.note ? `
          <div class="risk-warn" style="border-color:var(--info);background:rgba(96,165,250,0.06);">
            ${p.vehicle.note}
          </div>` : ``}
      </div>`;
  }).join("");

  el.innerHTML = `<div class="section-title">Per-Name Analysis</div>${cards}`;
}

function renderRiskPlan(port, poolScaling) {
  const el = document.getElementById("risk-plan");
  const scalingRows = poolScaling.map(r => `
    <tr>
      <td>${fmt$(r.pool)}</td>
      <td>${fmt$(r.capitalAtWork)}</td>
      <td>${fmt$(r.notional)}</td>
      <td>${r.leverage.toFixed(2)}×</td>
      <td>${fmt$(r.maxLoss)}</td>
      <td>${r.positions}</td>
      <td><span class="ticker">${r.topPick}</span></td>
    </tr>
  `).join("");

  el.innerHTML = `
    <div class="section-title">Risk Plan & Cross-Pool Breakdown</div>
    <div class="risk-plan">
      <h3 style="color:var(--accent-2);">Risk Management Rules</h3>
      <div class="grid">
        <div class="cell"><h4>Hard Stop</h4>
          <p>Exit any position on a ${(port.profile.stopLossPct*100).toFixed(0)}% adverse move
             from entry. Shorts don't have unlimited patience.</p></div>
        <div class="cell"><h4>Reserve Buffer</h4>
          <p>${(port.profile.marginReserve*100).toFixed(0)}% of capital held back for
             margin calls, adds on weakness, and volatility events.</p></div>
        <div class="cell"><h4>Event Blackout</h4>
          <p>Close or hedge the ~2 trading days ahead of earnings / investor days
             unless the thesis is explicitly an earnings short.</p></div>
        <div class="cell"><h4>Squeeze Protocol</h4>
          <p>Any name with squeeze-risk ≥ 7 uses puts or put spreads only.
             Never naked-short a high-SI%-of-float name.</p></div>
        <div class="cell"><h4>Correlation Cap</h4>
          <p>No more than 2 positions in a single sub-sector. Short books are
             prone to hidden net-long-factor exposure.</p></div>
        <div class="cell"><h4>Unwind Trigger</h4>
          <p>Close the whole book if aggregate mark-to-market drawdown exceeds
             ${(port.profile.stopLossPct*100*1.5).toFixed(0)}% of starting capital.</p></div>
      </div>
    </div>

    <div style="margin-top:18px;">
      <h3 style="color:var(--accent-2);font-size:13px;letter-spacing:1.5px;
         text-transform:uppercase;">Same Portfolio Strategy Across Starting Pools</h3>
      <table class="portfolio-table">
        <thead><tr>
          <th>Starting Pool</th><th>Capital At Work</th><th>Notional</th>
          <th>Leverage</th><th>Max Loss</th><th># Positions</th><th>Top Pick</th>
        </tr></thead>
        <tbody>${scalingRows}</tbody>
      </table>
      <p style="color:var(--muted);font-size:11px;margin-top:8px;">
        Leverage and position count are preserved across pool sizes — what
        changes is per-name dollar sizing. Below ~$2,000, options overshoot
        minimum contract granularity; a cash short or 1-contract put is
        typically the only workable vehicle.
      </p>
    </div>
  `;
}

function renderUniverse(scored) {
  const el = document.getElementById("universe");
  const rows = scored.map(c => {
    const cls = c._score >= 6.5 ? "high" : c._score >= 4.5 ? "med" : "low";
    const pct = (c._score / 10) * 100;
    return `
      <tr>
        <td><span class="ticker">${c.ticker}</span></td>
        <td>${c.company}</td>
        <td>${c.sector}</td>
        <td><span class="score-pill ${cls}">${c._score.toFixed(2)}</span></td>
        <td><span class="bar"><span style="width:${pct}%"></span></span></td>
        <td>${c.aiRisk}/10</td>
        <td>${c.squeezeRisk}/10</td>
      </tr>`;
  }).join("");
  el.innerHTML = `
    <div class="section-title">Full Ranked Universe (${scored.length} names)</div>
    <table class="universe-table">
      <thead><tr>
        <th>Ticker</th><th>Company</th><th>Sector</th><th>Score</th>
        <th>Conviction</th><th>AI Risk</th><th>Squeeze Risk</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

if (typeof window !== "undefined") {
  window.renderSummary        = renderSummary;
  window.renderPortfolioTable = renderPortfolioTable;
  window.renderBreakdown      = renderBreakdown;
  window.renderRiskPlan       = renderRiskPlan;
  window.renderUniverse       = renderUniverse;
}
