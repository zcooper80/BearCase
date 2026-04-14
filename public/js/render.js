/**
 * BearCase Render Layer — Apple-style UI.
 */

const FACTOR_META = {
  valuation: { label: "Valuation",         color: "var(--accent)" },
  quality:   { label: "Business Quality",  color: "var(--orange)" },
  balance:   { label: "Balance Sheet",     color: "var(--yellow)" },
  filings:   { label: "Filings / Gov.",    color: "var(--teal)" },
  technical: { label: "Technical",         color: "var(--green)" },
  shortInt:  { label: "Short Interest",    color: "var(--blue)" },
  macro:     { label: "Macro / Sector",    color: "var(--indigo)" },
  aiRisk:    { label: "AI Disruption",     color: "var(--pink)" }
};

const fmt$ = n => n == null ? "—" : (n >= 1000
  ? "$" + Math.round(n).toLocaleString()
  : "$" + Number(n).toFixed(2));
const fmtPct = n => n == null ? "—" : (n * 100).toFixed(1) + "%";
const fmtBig = n => {
  if (n == null) return "—";
  if (Math.abs(n) >= 1e12) return "$" + (n/1e12).toFixed(2) + "T";
  if (Math.abs(n) >= 1e9)  return "$" + (n/1e9).toFixed(2)  + "B";
  if (Math.abs(n) >= 1e6)  return "$" + (n/1e6).toFixed(1)  + "M";
  return "$" + Math.round(n).toLocaleString();
};
const fmtNum = (n, d = 2) => n == null ? "—" : Number(n).toFixed(d);

function renderSummary(port) {
  const el = document.getElementById("summary");
  const top = port.positions[0] || {};
  const lossPct = (port.totalMaxLoss / port.pool) * 100;
  el.innerHTML = `
    <div class="metric fade-in">
      <div class="m-label">Capital Deployed</div>
      <div class="m-value">${fmt$(port.capitalAtWork)}</div>
      <div class="m-sub">${fmt$(port.marginReserve)} held in reserve</div>
    </div>
    <div class="metric fade-in accent">
      <div class="m-label">Max Defined Loss</div>
      <div class="m-value">${fmt$(port.totalMaxLoss)}</div>
      <div class="m-sub">${lossPct.toFixed(1)}% of starting pool</div>
    </div>
    <div class="metric fade-in">
      <div class="m-label">Effective Notional</div>
      <div class="m-value">${fmt$(port.totalNotional)}</div>
      <div class="m-sub">${port.leverage.toFixed(2)}× gross leverage</div>
    </div>
    <div class="metric fade-in">
      <div class="m-label">Positions</div>
      <div class="m-value">${port.positions.length}</div>
      <div class="m-sub">${port.riskProfile} · ${port.multiplier}× risk</div>
    </div>
    <div class="metric fade-in">
      <div class="m-label">Top Conviction</div>
      <div class="m-value" style="font-size:24px;">${top.ticker || "—"}</div>
      <div class="m-sub">Score ${(top._score || 0).toFixed(2)} / 10</div>
    </div>
  `;
}

function renderPortfolioTable(port) {
  const el = document.getElementById("portfolio");
  const rows = port.positions.map(p => {
    const cls = p._score >= 6.5 ? "high" : p._score >= 4.5 ? "med" : "low";
    const livePrice = p._live?.price ?? p.price;
    return `
      <tr>
        <td>
          <div class="ticker">${p.ticker}</div>
          <div class="company-sub">${p.company}</div>
        </td>
        <td><span class="pill neutral">${p.sector}</span></td>
        <td><span class="pill ${cls}">${p._score.toFixed(2)}</span></td>
        <td>${fmtPct(p.weight)}</td>
        <td>${fmt$(p.capital)}</td>
        <td>${fmt$(livePrice)}</td>
        <td><span class="pill neutral">${p.vehicle.kind.replace(/-/g," ")}</span></td>
        <td style="color:var(--accent);font-weight:600;">${fmt$(p.maxLossDollars)}</td>
      </tr>`;
  }).join("");

  el.innerHTML = `
    <div class="section-h">
      <h2>Recommended Portfolio</h2>
      <span class="sub">${port.profile.description}</span>
    </div>
    <div class="card" style="padding:0;overflow:hidden;">
      <table class="ptable">
        <thead><tr>
          <th>Ticker</th><th>Sector</th><th>Score</th><th>Weight</th>
          <th>Capital</th><th>Price</th><th>Vehicle</th><th>Max Loss</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function liveChips(p) {
  const live = p._live;
  if (!live) return "";
  const chips = [];
  const changeDir = (live.distFromMA200Pct != null && live.distFromMA200Pct < 0) ? "down" : "up";
  if (live.price != null) chips.push(`<span class="chip"><strong>${fmt$(live.price)}</strong> live price</span>`);
  if (live.marketCap != null) chips.push(`<span class="chip">Market cap <strong>${fmtBig(live.marketCap)}</strong></span>`);
  if (live.peTrailing != null) chips.push(`<span class="chip">P/E <strong>${fmtNum(live.peTrailing,1)}</strong></span>`);
  if (live.priceToSales != null) chips.push(`<span class="chip">P/S <strong>${fmtNum(live.priceToSales,1)}</strong></span>`);
  if (live.evEbitda != null) chips.push(`<span class="chip">EV/EBITDA <strong>${fmtNum(live.evEbitda,1)}</strong></span>`);
  if (live.grossMargins != null) chips.push(`<span class="chip">Gross margin <strong>${fmtPct(live.grossMargins)}</strong></span>`);
  if (live.operatingMargins != null) chips.push(`<span class="chip">Op. margin <strong>${fmtPct(live.operatingMargins)}</strong></span>`);
  if (live.revenueGrowth != null) {
    const cls = live.revenueGrowth < 0 ? "down" : "up";
    chips.push(`<span class="chip ${cls}">Rev. growth <strong>${fmtPct(live.revenueGrowth)}</strong></span>`);
  }
  if (live.debtToEquity != null) chips.push(`<span class="chip">D/E <strong>${fmtNum(live.debtToEquity,1)}</strong></span>`);
  if (live.shortPercentOfFloat != null) chips.push(`<span class="chip">Short % float <strong>${fmtPct(live.shortPercentOfFloat)}</strong></span>`);
  if (live.rsi != null) chips.push(`<span class="chip">RSI(14) <strong>${fmtNum(live.rsi,0)}</strong></span>`);
  if (live.ma200 != null && live.distFromMA200Pct != null) {
    chips.push(`<span class="chip ${changeDir}">vs 200-DMA <strong>${fmtPct(live.distFromMA200Pct)}</strong></span>`);
  }
  if (live.deathCross) chips.push(`<span class="chip down">⚠ death cross</span>`);
  if (live.earningsDate) {
    const d = new Date(live.earningsDate * 1000);
    chips.push(`<span class="chip">Next earnings <strong>${d.toISOString().slice(0,10)}</strong></span>`);
  }
  return `<div class="live-chips">${chips.join("")}</div>`;
}

function renderBreakdown(port) {
  const el = document.getElementById("breakdown");
  const cards = port.positions.map(p => {
    const factors = Object.keys(FACTOR_META).map(k => {
      const m = FACTOR_META[k];
      const v = p[k] || 0;
      return `
        <div class="fac">
          <div class="fn">${m.label}</div>
          <div class="fv">${v}<span style="font-size:13px;color:var(--text-tertiary);font-weight:500;"> / 10</span></div>
          <div class="bar"><span style="width:${v*10}%;background:${m.color};"></span></div>
        </div>`;
    }).join("");

    const thesis = (p.thesis || []).map(t => `<li>${t}</li>`).join("");
    const catalysts = (p.catalysts || []).join(" · ");

    const filings = (p._filings || []).slice(0,5).map(f => `
      <div class="filing-row">
        <span class="date">${f.filedAt || ""}</span>
        <span class="form">${f.form || ""}</span>
        <span>${f.url ? `<a href="${f.url}" target="_blank" rel="noopener">${f.primaryDocDesc || f.primaryDoc || "View filing"}</a>` : (f.primaryDocDesc || f.primaryDoc || "")}</span>
      </div>`).join("");

    const redFlags = (p._live?.redFlags || []).map(f =>
      `<div class="note"><strong>${f.kind.replace(/-/g," ")}:</strong> ${f.detail}</div>`).join("");

    return `
      <div class="stock fade-in">
        <div class="stock-head">
          <div>
            <div class="id"><span class="tkr">${p.ticker}</span><span class="sec">${p.sector}</span></div>
            <div class="co">${p.company} · ref. ${fmt$(p.price)}</div>
          </div>
          <div class="alloc">
            <div class="n">${fmt$(p.capital)}</div>
            <div class="l">Allocation · ${fmtPct(p.weight)}</div>
          </div>
        </div>

        ${liveChips(p)}

        <div class="factors">${factors}</div>

        <div class="bear-box">
          <h4>Bear Thesis</h4>
          <ul>${thesis}</ul>
          ${catalysts ? `<div class="catalysts">Catalysts: ${catalysts}</div>` : ""}
        </div>

        <div class="trade-box">
          <div class="trade-row"><span class="k">Vehicle</span><span class="v">${p.vehicle.kind} · ${p.vehicle.leverage}× effective</span></div>
          <div class="trade-row"><span class="k">Instruction</span><span class="v">${instructionString(p)}</span></div>
          <div class="trade-row"><span class="k">Reference price</span><span class="v">${fmt$(p.price)}</span></div>
          <div class="trade-row"><span class="k">Stop / invalidation</span><span class="v">${fmt$(p.stopPrice)} (+${(port.profile.stopLossPct*100).toFixed(0)}%)</span></div>
          <div class="trade-row"><span class="k">Max defined loss</span><span class="v">${fmt$(p.maxLossDollars)}</span></div>
          <div class="trade-row"><span class="k">Squeeze risk · Beta</span><span class="v">${p.squeezeRisk}/10 · β ${fmtNum(p.beta,2)}</span></div>
        </div>

        ${p.squeezeRisk >= 7 ? `<div class="note"><strong>Elevated squeeze risk.</strong> ${p.vehicle.note}</div>` :
          p.vehicle.note ? `<div class="note info">${p.vehicle.note}</div>` : ""}

        ${redFlags}

        ${filings ? `
          <div style="margin-top:16px;">
            <div class="card-title" style="margin-bottom:4px;">Recent SEC Filings</div>
            <div class="filings-list">${filings}</div>
          </div>` : ""}
      </div>`;
  }).join("");

  el.innerHTML = `
    <div class="section-h">
      <h2>Per-Name Analysis</h2>
      <span class="sub">Live fundamentals · technical signals · SEC filings</span>
    </div>
    ${cards}
  `;
}

function instructionString(p) {
  switch (p.vehicle.kind) {
    case "short":       return `Short ${p.shares} sh @ ~${fmt$(p.price)} · stop ${fmt$(p.stopPrice)}`;
    case "short+put":   return `Short ${p.shares} sh + buy 1 OTM put hedge`;
    case "put":         return `Buy ${p.contracts} × ~90 DTE ATM puts @ ~${fmt$(p.premiumPerContract / 100)}/sh`;
    case "put-spread":  return `Buy ${p.contracts} × ATM put · sell equal OTM put — debit spread`;
    case "put-otm":     return `Buy ${p.contracts} × deep-OTM puts (≤ 0.20 delta)`;
    default:            return "—";
  }
}

function renderRiskPlan(port, scaling) {
  const el = document.getElementById("risk-plan");
  const rows = scaling.map(r => `
    <tr>
      <td>${fmt$(r.pool)}</td>
      <td><span class="bar-cell"><span class="progress"><span style="width:${Math.min(100, r.leverage*20)}%"></span></span>${r.leverage.toFixed(2)}×</span></td>
      <td>${fmt$(r.capitalAtWork)}</td>
      <td>${fmt$(r.notional)}</td>
      <td style="color:var(--accent);">${fmt$(r.maxLoss)}</td>
      <td>${r.positions}</td>
      <td><span class="ticker">${r.topPick}</span></td>
    </tr>`).join("");

  el.innerHTML = `
    <div class="section-h">
      <h2>Risk Plan</h2>
      <span class="sub">Shorts have unbounded theoretical loss — these rules are non-negotiable.</span>
    </div>
    <div class="card">
      <div class="risk-grid">
        <div class="risk-cell"><h4>Hard Stop</h4><p>Exit on ${(port.profile.stopLossPct*100).toFixed(0)}% adverse move from entry.</p></div>
        <div class="risk-cell"><h4>Reserve Buffer</h4><p>${(port.profile.marginReserve*100).toFixed(0)}% of capital held back for margin calls and adds on weakness.</p></div>
        <div class="risk-cell"><h4>Event Blackout</h4><p>Hedge or close ~2 days before earnings unless the thesis is an earnings short.</p></div>
        <div class="risk-cell"><h4>Squeeze Protocol</h4><p>Names with squeeze risk ≥ 7 use puts or put spreads only. Never naked short.</p></div>
        <div class="risk-cell"><h4>Correlation Cap</h4><p>No more than 2 positions in a single sub-sector — short books hide factor exposure.</p></div>
        <div class="risk-cell"><h4>Book Unwind</h4><p>Close entire book if aggregate drawdown exceeds ${(port.profile.stopLossPct*150).toFixed(0)}% of pool.</p></div>
      </div>
    </div>

    <div class="section-h">
      <h2>Same Strategy · Every Pool Size</h2>
      <span class="sub">Leverage and position count preserved; only dollar sizing scales.</span>
    </div>
    <div class="card" style="padding:0;overflow:hidden;">
      <table class="ptable pool-table">
        <thead><tr>
          <th>Starting Pool</th><th>Leverage</th><th>Capital At Work</th>
          <th>Notional</th><th>Max Loss</th><th>Positions</th><th>Top Pick</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderUniverse(scored) {
  const el = document.getElementById("universe");
  const rows = scored.map(c => {
    const cls = c._score >= 6.5 ? "high" : c._score >= 4.5 ? "med" : "low";
    const pct = (c._score / 10) * 100;
    const live = c._live?.price ? `${fmt$(c._live.price)}` : `${fmt$(c.price)}`;
    return `
      <tr>
        <td><div class="ticker">${c.ticker}</div><div class="company-sub">${c.company}</div></td>
        <td><span class="pill neutral">${c.sector}</span></td>
        <td><span class="pill ${cls}">${c._score.toFixed(2)}</span></td>
        <td><span class="progress" style="display:inline-block;width:100px;height:5px;background:var(--bg-subtle);border-radius:3px;overflow:hidden;"><span style="display:block;height:100%;width:${pct}%;background:linear-gradient(90deg,var(--orange),var(--accent));"></span></span></td>
        <td>${live}</td>
        <td>${c.aiRisk}/10</td>
        <td>${c.squeezeRisk}/10</td>
      </tr>`;
  }).join("");

  el.innerHTML = `
    <div class="section-h">
      <h2>Full Ranked Universe</h2>
      <span class="sub">${scored.length} names — ranked by composite bear score</span>
    </div>
    <div class="card" style="padding:0;overflow:hidden;">
      <table class="ptable">
        <thead><tr>
          <th>Ticker</th><th>Sector</th><th>Score</th><th>Conviction</th>
          <th>Price</th><th>AI Risk</th><th>Squeeze Risk</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

if (typeof window !== "undefined") {
  window.renderSummary        = renderSummary;
  window.renderPortfolioTable = renderPortfolioTable;
  window.renderBreakdown      = renderBreakdown;
  window.renderRiskPlan       = renderRiskPlan;
  window.renderUniverse       = renderUniverse;
}
