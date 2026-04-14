/**
 * Derive the 0-10 BearCase factor scores from live market/fundamental data.
 * Falls back to editorial defaults passed in `base` if live data is missing.
 */

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function valuationScore(s) {
  let score = 0;
  const pe = s.trailingPE, ps = s.priceToSales, ev = s.enterpriseToEbitda;
  if (pe != null) {
    if (pe < 0)        score += 3;
    else if (pe > 100) score += 4;
    else if (pe > 50)  score += 3;
    else if (pe > 30)  score += 2;
    else if (pe > 20)  score += 1;
  }
  if (ps != null) {
    if (ps > 20)       score += 3;
    else if (ps > 10)  score += 2;
    else if (ps > 5)   score += 1;
  }
  if (ev != null) {
    if (ev > 50)       score += 3;
    else if (ev > 30)  score += 2;
    else if (ev > 20)  score += 1;
    else if (ev < 0)   score += 2;   // EBITDA negative → can't value normally
  }
  return clamp(score, 0, 10);
}

function qualityScore(s) {
  let score = 0;
  if (s.grossMargins != null && s.grossMargins < 0.25) score += 2;
  if (s.operatingMargins != null && s.operatingMargins < 0) score += 3;
  else if (s.operatingMargins != null && s.operatingMargins < 0.05) score += 1;
  if (s.profitMargins != null && s.profitMargins < 0) score += 1;

  // FCF vs net income — classic earnings-quality check
  if (s.freeCashflow != null && s.netIncome != null) {
    if (s.freeCashflow < 0 && s.netIncome > 0) score += 3;       // earnings > cash
    else if (s.freeCashflow < s.netIncome * 0.5) score += 1;
  }

  if (s.revenueGrowth != null) {
    if (s.revenueGrowth < -0.1) score += 2;
    else if (s.revenueGrowth < 0) score += 1;
  }

  // AR growing faster than revenue is a channel-stuffing tell — we only have
  // a snapshot, so approximate with AR/revenue ratio
  if (s.accountsReceivable && s.revenue && s.accountsReceivable / s.revenue > 0.4) score += 1;

  return clamp(score, 0, 10);
}

function balanceScore(s) {
  let score = 0;
  if (s.debtToEquity != null) {
    // Yahoo reports as pct (e.g. 150 = 1.5x)
    const de = s.debtToEquity > 10 ? s.debtToEquity / 100 : s.debtToEquity;
    if (de > 3)      score += 4;
    else if (de > 2) score += 3;
    else if (de > 1) score += 2;
  }
  // interest coverage
  if (s.ebit != null && s.interestExpense) {
    const cov = s.ebit / Math.abs(s.interestExpense);
    if (cov < 1)      score += 4;
    else if (cov < 2) score += 3;
    else if (cov < 5) score += 1;
  }
  if (s.currentRatio != null && s.currentRatio < 1) score += 1;

  // goodwill + intangibles as share of assets
  const intangible = (s.goodwill || 0) + (s.intangibleAssets || 0);
  if (s.totalAssets && intangible / s.totalAssets > 0.5) score += 2;

  return clamp(score, 0, 10);
}

function filingsScore(redFlags, baseScore) {
  if (!redFlags || !redFlags.length) return baseScore ?? 2;
  const weight = redFlags.reduce((a, f) => a + (f.severity || 1), 0);
  return clamp((baseScore ?? 2) + weight, 0, 10);
}

function technicalScore(t) {
  if (!t) return null;
  let score = 0;
  if (t.belowMA200) score += 2;
  if (t.belowMA50)  score += 1;
  if (t.deathCross) score += 2;
  if (t.rsi != null && t.rsi > 70) score += 2;      // overbought in weak name
  else if (t.rsi != null && t.rsi < 30) score += 1; // confirmed weakness
  if (t.macd && t.macd.hist != null && t.macd.hist < 0) score += 1;
  if (t.volumeTiltDownVsUp > 1.3) score += 1;
  if (t.lowerHighsLows >= 4) score += 1;
  return clamp(score, 0, 10);
}

function shortInterestScore(s) {
  let score = 0;
  if (s.shortPercentOfFloat != null) {
    const pct = s.shortPercentOfFloat;
    if (pct > 0.25)      score += 4;
    else if (pct > 0.15) score += 3;
    else if (pct > 0.08) score += 2;
    else if (pct > 0.04) score += 1;
  }
  if (s.sharesShort && s.sharesShortPriorMonth) {
    const delta = (s.sharesShort - s.sharesShortPriorMonth) / s.sharesShortPriorMonth;
    if (delta > 0.2) score += 2;
    else if (delta > 0.05) score += 1;
  }
  if (s.shortRatio != null && s.shortRatio > 5) score += 1;
  return clamp(score, 0, 10);
}

/** Squeeze risk is highest when short % of float is high AND float is small. */
function squeezeRisk(s) {
  let risk = 0;
  if (s.shortPercentOfFloat != null) {
    const pct = s.shortPercentOfFloat;
    if (pct > 0.25) risk += 5;
    else if (pct > 0.15) risk += 4;
    else if (pct > 0.08) risk += 3;
    else if (pct > 0.04) risk += 2;
  }
  if (s.shortRatio != null) {
    if (s.shortRatio > 10) risk += 3;
    else if (s.shortRatio > 5) risk += 2;
  }
  if (s.floatShares != null && s.floatShares < 50e6) risk += 2;
  return clamp(risk, 0, 10);
}

/**
 * Merge baseline editorial scores with live-computed ones. Live wins when
 * available; baseline remains for factors we can't compute from a feed
 * (AI-disruption risk, macro sector context).
 */
function buildLiveScores(base, quote, summary, tech, redFlags) {
  const live = {};
  if (summary) {
    const v = valuationScore(summary);
    const q = qualityScore(summary);
    const b = balanceScore(summary);
    const si = shortInterestScore(summary);
    const sq = squeezeRisk(summary);
    if (v  != null) live.valuation = v;
    if (q  != null) live.quality = q;
    if (b  != null) live.balance = b;
    if (si != null) live.shortInt = si;
    live.squeezeRisk = sq;
  }
  if (tech) {
    const t = technicalScore(tech);
    if (t != null) live.technical = t;
  }
  live.filings = filingsScore(redFlags, base.filings);

  // merge — live overrides base when present
  const merged = { ...base, ...live };
  merged._live = {
    price: quote?.price ?? null,
    name:  quote?.name  ?? base.company,
    marketCap: quote?.marketCap ?? null,
    peTrailing: summary?.trailingPE ?? null,
    peForward:  summary?.forwardPE ?? null,
    priceToSales: summary?.priceToSales ?? null,
    evEbitda: summary?.enterpriseToEbitda ?? null,
    grossMargins: summary?.grossMargins ?? null,
    operatingMargins: summary?.operatingMargins ?? null,
    freeCashflow: summary?.freeCashflow ?? null,
    debtToEquity: summary?.debtToEquity ?? null,
    shortPercentOfFloat: summary?.shortPercentOfFloat ?? null,
    shortRatio: summary?.shortRatio ?? null,
    revenueGrowth: summary?.revenueGrowth ?? null,
    earningsDate: summary?.earningsDate?.[0] ?? null,
    ma50:  tech?.ma50  ?? null,
    ma200: tech?.ma200 ?? null,
    rsi:   tech?.rsi   ?? null,
    macdHist: tech?.macd?.hist ?? null,
    deathCross: tech?.deathCross ?? null,
    distFromMA200Pct: tech?.distFromMA200Pct ?? null,
    redFlags: redFlags ?? []
  };
  // use live price when available
  if (quote?.price) merged.price = quote.price;
  // prefer live beta
  if (quote?.beta) merged.beta = quote.beta;
  return merged;
}

module.exports = {
  buildLiveScores,
  valuationScore, qualityScore, balanceScore,
  filingsScore, technicalScore, shortInterestScore, squeezeRisk
};
