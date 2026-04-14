/**
 * BearCase Portfolio Builder
 *
 * Converts a ranked list of short candidates into a concrete, capital-sized
 * portfolio for the user's risk profile and multiplier. Handles:
 *   - position count & concentration caps per risk profile
 *   - allocation weighting (inverse-rank with a squeeze-risk haircut)
 *   - vehicle selection: cash short vs put options vs put spreads
 *   - stop-loss & max-loss computation — shorts have unbounded theoretical
 *     downside, so we always surface an explicit risk plan
 *
 * Multiplier (risk factor) maps to leverage / vehicle aggressiveness:
 *   1×  Pure cash short with tight stop
 *   2×  Cash short + ATM put hedge OR short position sized 1.5× of equity
 *   3×  Long ATM puts (defined risk)
 *   4×  Long slightly-OTM put debit spreads
 *   5×  Deep-OTM long puts (lottery / high convexity)
 */

const RISK_PROFILES = {
  conservative: {
    positions: 4, maxPerName: 0.35, minPerName: 0.10,
    squeezeFilter: 6,           // skip names with squeezeRisk > 6
    marginReserve: 0.35,        // keep 35% as buffer for margin calls / adverse moves
    stopLossPct: 0.15,          // close on 15% adverse move
    description: "Lower leverage · defined-risk puts preferred · wider diversification · strict squeeze avoidance."
  },
  balanced: {
    positions: 5, maxPerName: 0.30, minPerName: 0.10,
    squeezeFilter: 8,
    marginReserve: 0.25,
    stopLossPct: 0.20,
    description: "Mix of fundamental and catalyst shorts · options for high-squeeze names · moderate concentration."
  },
  aggressive: {
    positions: 6, maxPerName: 0.40, minPerName: 0.08,
    squeezeFilter: 10,
    marginReserve: 0.15,
    stopLossPct: 0.25,
    description: "Higher concentration · puts/spreads emphasised · accepts squeeze risk for convexity · wider stops."
  }
};

/** Map multiplier (1–5) → vehicle instructions. */
function vehicleFor(mult, squeezeRisk) {
  if (squeezeRisk >= 8 && mult < 3) {
    return { kind: "put",       leverage: 2.0,
      note: "High squeeze risk — use long puts only, never a naked short." };
  }
  switch (mult) {
    case 1: return { kind: "short", leverage: 1.0,
      note: "Cash-secured short with a tight protective buy-stop." };
    case 2: return { kind: "short+put", leverage: 1.5,
      note: "Short equity plus OTM put hedge — caps tail risk on a squeeze." };
    case 3: return { kind: "put", leverage: 2.5,
      note: "Long ATM puts 90–180 DTE — defined premium-at-risk." };
    case 4: return { kind: "put-spread", leverage: 3.5,
      note: "ATM/OTM put debit spread — defined risk, defined reward." };
    case 5: return { kind: "put-otm", leverage: 5.0,
      note: "Deep-OTM puts — lottery convexity; size as premium, not notional." };
    default: return { kind: "short", leverage: 1.0, note: "" };
  }
}

/** Inverse-rank weighting with squeeze-risk haircut and bounds. */
function rawWeights(shortlist) {
  const n = shortlist.length;
  const raw = shortlist.map((c, i) => {
    const rankW = (n - i);                          // best rank → highest weight
    const squeezeHaircut = 1 - (c.squeezeRisk / 20); // up to 50% cut
    return rankW * squeezeHaircut;
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(w => w / sum);
}

function clampWeights(weights, min, max) {
  let w = weights.slice();
  // clamp
  w = w.map(x => Math.max(min, Math.min(max, x)));
  // re-normalise
  const s = w.reduce((a, b) => a + b, 0);
  return w.map(x => x / s);
}

function buildPortfolio(scored, { pool, riskProfile, multiplier }) {
  const profile = RISK_PROFILES[riskProfile];
  const shortlist = scored
    .filter(c => c.squeezeRisk <= profile.squeezeFilter)
    .slice(0, profile.positions);

  const capitalAtWork = pool * (1 - profile.marginReserve);
  let weights = rawWeights(shortlist);
  weights = clampWeights(weights, profile.minPerName, profile.maxPerName);

  const positions = shortlist.map((c, i) => {
    const alloc = capitalAtWork * weights[i];
    const veh = vehicleFor(multiplier, c.squeezeRisk);
    const effectiveNotional = alloc * veh.leverage;
    const shares = Math.max(1, Math.floor(effectiveNotional / c.price));
    const premiumPerContract = estimateOptionPremium(c.price, c.putIV, veh.kind);
    const contracts = (veh.kind === "short" || veh.kind === "short+put")
      ? 0
      : Math.max(1, Math.floor(alloc / premiumPerContract));

    const stopPrice = c.price * (1 + profile.stopLossPct);
    const maxLossDollars = (veh.kind === "short" || veh.kind === "short+put")
      ? (stopPrice - c.price) * shares
      : contracts * premiumPerContract;     // options = premium paid

    return {
      ...c,
      weight: weights[i],
      capital: alloc,
      vehicle: veh,
      shares,
      contracts,
      premiumPerContract,
      stopPrice,
      maxLossDollars,
      effectiveNotional
    };
  });

  const totalMaxLoss = positions.reduce((a, p) => a + p.maxLossDollars, 0);
  const totalNotional = positions.reduce((a, p) => a + p.effectiveNotional, 0);

  return {
    pool,
    riskProfile,
    profile,
    multiplier,
    capitalAtWork,
    marginReserve: pool - capitalAtWork,
    positions,
    totalMaxLoss,
    totalNotional,
    leverage: totalNotional / pool
  };
}

/** Very rough Black-Scholes-ish put premium estimate for a 90-DTE contract. */
function estimateOptionPremium(price, ivPct, kind) {
  const iv = ivPct / 100;
  const t = 90 / 365;
  // crude ATM put ~ 0.4 * price * iv * sqrt(t)
  let prem = 0.4 * price * iv * Math.sqrt(t);
  if (kind === "put-otm")    prem *= 0.35;
  if (kind === "put-spread") prem *= 0.55;
  return Math.max(0.25, prem) * 100;       // one contract = 100 shares
}

/** Generate the cross-pool breakdown table the user asked for. */
function scaleAcrossPools(scored, pools, { riskProfile, multiplier }) {
  return pools.map(p => {
    const port = buildPortfolio(scored, { pool: p, riskProfile, multiplier });
    return {
      pool: p,
      capitalAtWork: port.capitalAtWork,
      maxLoss: port.totalMaxLoss,
      notional: port.totalNotional,
      leverage: port.leverage,
      topPick: port.positions[0]?.ticker || "—",
      positions: port.positions.length
    };
  });
}

if (typeof window !== "undefined") {
  window.buildPortfolio   = buildPortfolio;
  window.scaleAcrossPools = scaleAcrossPools;
  window.RISK_PROFILES    = RISK_PROFILES;
}
