/**
 * Shared helpers for Vercel serverless handlers.
 *
 * Serverless functions are stateless between cold starts, so the TTL cache
 * here only helps within a warm invocation. We layer on edge caching via
 * Cache-Control headers, which Vercel's CDN honours.
 */

const { TTLCache }          = require("../lib/cache");
const yahoo                 = require("../lib/yahoo");
const sec                   = require("../lib/sec");
const { computeTechnicals } = require("../lib/technicals");
const { buildLiveScores }   = require("../lib/liveScoring");
const { CANDIDATES }        = require("../public/js/data.js");

const BASE_BY_TICKER = Object.fromEntries(CANDIDATES.map(c => [c.ticker, c]));
const memCache = new TTLCache(10 * 60 * 1000);

/** CDN cache — 5 min fresh, 30 min stale-while-revalidate. */
function setEdgeCache(res, sMaxAgeSec = 300, swrSec = 1800) {
  res.setHeader(
    "Cache-Control",
    `public, s-maxage=${sMaxAgeSec}, stale-while-revalidate=${swrSec}`
  );
}

function json(res, status, body) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function handleError(res, err) {
  console.error("API error:", err?.message || err);
  json(res, 500, { error: String(err?.message || err) });
}

function tickerFrom(req) {
  const t = (req.query?.ticker || "").toString().toUpperCase().trim();
  if (!t || !/^[A-Z.\-]{1,10}$/.test(t)) {
    const err = new Error("Invalid ticker");
    err.status = 400;
    throw err;
  }
  return t;
}

const getQuote   = t => memCache.wrap(`q:${t}`, 5*60*1000,  () => yahoo.getQuote(t));
const getSummary = t => memCache.wrap(`s:${t}`, 30*60*1000, () => yahoo.getSummary(t));
const getHistory = t => memCache.wrap(`h:${t}`, 60*60*1000, () => yahoo.getHistory(t, "1y", "1d"));
const getFilings = t => memCache.wrap(`f:${t}`, 60*60*1000, () => sec.getRecentFilings(t));

/** Full enrichment (all 4 sources + score merge). Used by /api/enrich/[ticker]. */
async function enrichFull(ticker) {
  const base = BASE_BY_TICKER[ticker];
  if (!base) throw Object.assign(new Error(`Unknown ticker ${ticker}`), { status: 404 });

  const results = await Promise.allSettled([
    getQuote(ticker), getSummary(ticker), getHistory(ticker), getFilings(ticker)
  ]);
  const [quoteR, summaryR, histR, filingsR] = results;
  const quote   = quoteR.status   === "fulfilled" ? quoteR.value   : null;
  const summary = summaryR.status === "fulfilled" ? summaryR.value : null;
  const hist    = histR.status    === "fulfilled" ? histR.value    : null;
  const filings = filingsR.status === "fulfilled" ? filingsR.value : null;

  const tech     = hist ? computeTechnicals(hist) : null;
  const redFlags = filings ? sec.detectRedFlags(filings) : null;

  const enriched = buildLiveScores(base, quote, summary, tech, redFlags);
  enriched._meta = {
    fetchedAt: new Date().toISOString(),
    sources: Object.fromEntries(["quote","summary","history","filings"]
      .map((n, i) => [n, results[i].status])),
    errors: results
      .map((r, i) => r.status === "rejected"
        ? { src: ["quote","summary","history","filings"][i], err: String(r.reason) } : null)
      .filter(Boolean)
  };
  enriched._filings = filings?.filings?.slice(0, 5) ?? [];
  return enriched;
}

/**
 * Lightweight enrichment for the universe list — quote + summary only.
 * Skips history (no technicals) and filings (no SEC scan) to stay well
 * under Vercel's 10s default timeout when fanning out across 20 tickers.
 */
async function enrichLight(ticker) {
  const base = BASE_BY_TICKER[ticker];
  if (!base) return null;

  const results = await Promise.allSettled([getQuote(ticker), getSummary(ticker)]);
  const [qR, sR] = results;
  const quote   = qR.status === "fulfilled" ? qR.value : null;
  const summary = sR.status === "fulfilled" ? sR.value : null;

  const enriched = buildLiveScores(base, quote, summary, null, null);
  enriched._meta = {
    fetchedAt: new Date().toISOString(),
    light: true,
    sources: { quote: qR.status, summary: sR.status },
    errors: results
      .map((r, i) => r.status === "rejected"
        ? { src: ["quote","summary"][i], err: String(r.reason) } : null)
      .filter(Boolean)
  };
  return enriched;
}

module.exports = {
  CANDIDATES, BASE_BY_TICKER, memCache,
  json, handleError, tickerFrom, setEdgeCache,
  getQuote, getSummary, getHistory, getFilings,
  enrichFull, enrichLight,
  yahoo, sec, computeTechnicals
};
