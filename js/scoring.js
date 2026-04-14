/**
 * BearCase Scoring Engine
 *
 * Produces a composite "short conviction" score for each candidate given the
 * user's horizon, risk profile, and AI-thesis weighting. Also returns the
 * decomposed factor contributions for transparent breakdowns.
 *
 * Horizons shift weights between technicals (short-term) and fundamentals
 * (long-term). AI-disruption weight is dialled independently by the user —
 * the remaining weight is distributed proportionally across the other
 * fundamental/technical/macro buckets per the selected horizon profile.
 */

const HORIZON_PROFILES = {
  short:  { valuation: 0.08, quality: 0.10, balance: 0.08, filings: 0.08,
            technical: 0.30, shortInt: 0.18, macro: 0.10, aiRisk: 0.08 },
  medium: { valuation: 0.15, quality: 0.16, balance: 0.12, filings: 0.10,
            technical: 0.17, shortInt: 0.10, macro: 0.10, aiRisk: 0.10 },
  long:   { valuation: 0.22, quality: 0.22, balance: 0.16, filings: 0.10,
            technical: 0.06, shortInt: 0.04, macro: 0.10, aiRisk: 0.10 }
};

function buildWeights(horizon, aiWeightPct) {
  const base = HORIZON_PROFILES[horizon];
  const aiW = aiWeightPct / 100;                        // user choice
  const remaining = 1 - aiW;
  // scale the other seven factors so they sum to `remaining`
  const others = { ...base }; delete others.aiRisk;
  const baseSum = Object.values(others).reduce((a, b) => a + b, 0);
  const scaled = {};
  for (const k in others) scaled[k] = (others[k] / baseSum) * remaining;
  scaled.aiRisk = aiW;
  return scaled;
}

/** Penalise squeeze risk more heavily for conservative profiles. */
const SQUEEZE_PENALTY = {
  conservative: 0.9,   // strongly avoid squeezes
  balanced:     0.5,
  aggressive:   0.2
};

function scoreCandidate(c, weights, riskProfile) {
  const raw = {
    valuation: c.valuation * weights.valuation,
    quality:   c.quality   * weights.quality,
    balance:   c.balance   * weights.balance,
    filings:   c.filings   * weights.filings,
    technical: c.technical * weights.technical,
    shortInt:  c.shortInt  * weights.shortInt,
    macro:     c.macro     * weights.macro,
    aiRisk:    c.aiRisk    * weights.aiRisk
  };
  const gross = Object.values(raw).reduce((a, b) => a + b, 0);   // 0–10 scale
  const penalty = (c.squeezeRisk / 10) * SQUEEZE_PENALTY[riskProfile];
  const net = Math.max(0, gross - penalty * 2);                  // up to -2.0 points
  return {
    ...c,
    _components: raw,
    _gross: gross,
    _penalty: penalty * 2,
    _score: net
  };
}

function scoreUniverse(candidates, { horizon, aiWeightPct, riskProfile }) {
  const weights = buildWeights(horizon, aiWeightPct);
  return candidates
    .map(c => scoreCandidate(c, weights, riskProfile))
    .sort((a, b) => b._score - a._score);
}

if (typeof window !== "undefined") {
  window.scoreUniverse = scoreUniverse;
  window.buildWeights  = buildWeights;
}
