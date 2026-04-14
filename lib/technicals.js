/**
 * Technical indicator calculations over an OHLCV history array.
 *   rows: [{ t, o, h, l, c, v }]
 *
 * Pure functions, no dependencies.
 */

function sma(arr, n) {
  if (arr.length < n) return null;
  let s = 0;
  for (let i = arr.length - n; i < arr.length; i++) s += arr[i];
  return s / n;
}

function ema(arr, n) {
  if (arr.length < n) return null;
  const k = 2 / (n + 1);
  let e = sma(arr.slice(0, n), n);
  for (let i = n; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
  return e;
}

function emaSeries(arr, n) {
  if (arr.length < n) return [];
  const k = 2 / (n + 1);
  const out = Array(arr.length).fill(null);
  let e = sma(arr.slice(0, n), n);
  out[n - 1] = e;
  for (let i = n; i < arr.length; i++) {
    e = arr[i] * k + e * (1 - k);
    out[i] = e;
  }
  return out;
}

function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgG = gains / period, avgL = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
  }
  if (avgL === 0) return 100;
  const rs = avgG / avgL;
  return 100 - (100 / (1 + rs));
}

function macd(closes) {
  const e12 = emaSeries(closes, 12);
  const e26 = emaSeries(closes, 26);
  if (!e12.length || !e26.length) return null;
  const line = closes.map((_, i) => (e12[i] != null && e26[i] != null) ? e12[i] - e26[i] : null);
  const filled = line.filter(x => x != null);
  if (filled.length < 9) return { macd: line[line.length - 1], signal: null, hist: null };
  const sig = emaSeries(filled, 9);
  const signal = sig[sig.length - 1];
  const macdNow = line[line.length - 1];
  return { macd: macdNow, signal, hist: macdNow - signal };
}

function lowerHighsLowerLows(closes, windowN = 60) {
  if (closes.length < windowN) return 0;
  const recent = closes.slice(-windowN);
  let lastHigh = -Infinity, lastLow = Infinity;
  let lhCount = 0, llCount = 0;
  const seg = Math.floor(windowN / 5);
  for (let i = 0; i < 5; i++) {
    const slice = recent.slice(i * seg, (i + 1) * seg);
    const hi = Math.max(...slice), lo = Math.min(...slice);
    if (i > 0) {
      if (hi < lastHigh) lhCount++;
      if (lo < lastLow)  llCount++;
    }
    lastHigh = hi; lastLow = lo;
  }
  return lhCount + llCount;       // 0..8, higher = stronger downtrend
}

function computeTechnicals(rows) {
  if (!rows || rows.length < 50) return null;
  const closes  = rows.map(r => r.c);
  const volumes = rows.map(r => r.v);
  const last = closes[closes.length - 1];
  const ma50  = sma(closes, 50);
  const ma200 = sma(closes, 200);
  const ma50Prev = sma(closes.slice(0, -5), 50);
  const ma200Prev = sma(closes.slice(0, -5), 200);

  const rsi14 = rsi(closes, 14);
  const macdObj = macd(closes);
  const lh_ll = lowerHighsLowerLows(closes);

  const deathCross =
    ma50 != null && ma200 != null &&
    ma50 < ma200 &&
    !(ma50Prev != null && ma200Prev != null && ma50Prev < ma200Prev && (ma200 - ma50) < (ma200Prev - ma50Prev));

  const belowMA200 = ma200 != null ? last < ma200 : false;
  const belowMA50  = ma50 != null ? last < ma50 : false;

  // volume tilt — are down days higher volume than up days?
  let upVol = 0, downVol = 0, upDays = 0, downDays = 0;
  for (let i = Math.max(1, rows.length - 20); i < rows.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) { upVol += volumes[i] || 0; upDays++; }
    else if (diff < 0) { downVol += volumes[i] || 0; downDays++; }
  }
  const volTilt = (downDays && upDays)
    ? (downVol / downDays) / Math.max(1, upVol / upDays)
    : 1;

  return {
    last, ma50, ma200,
    rsi: rsi14,
    macd: macdObj,
    lowerHighsLows: lh_ll,
    deathCross,
    belowMA200, belowMA50,
    volumeTiltDownVsUp: volTilt,
    distFromMA200Pct: ma200 ? (last - ma200) / ma200 : null
  };
}

module.exports = { computeTechnicals, sma, ema, rsi, macd };
