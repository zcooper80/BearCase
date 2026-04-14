/**
 * BearCase server — static frontend + live data proxy.
 *
 * Endpoints:
 *   GET /api/quote/:ticker        live quote
 *   GET /api/summary/:ticker      fundamentals
 *   GET /api/history/:ticker      OHLCV (default 1y daily)
 *   GET /api/technicals/:ticker   computed MA/RSI/MACD/death-cross
 *   GET /api/filings/:ticker      recent SEC filings + red flag detection
 *   GET /api/enrich/:ticker       one-shot merged payload used by the frontend
 *   GET /api/universe             all tickers enriched (parallel, cached)
 *   GET /api/health
 */

const express = require("express");
const path    = require("path");
const fs      = require("fs");

const { TTLCache }      = require("./lib/cache");
const yahoo             = require("./lib/yahoo");
const sec               = require("./lib/sec");
const { computeTechnicals } = require("./lib/technicals");
const { buildLiveScores }   = require("./lib/liveScoring");

// Load the candidate editorial data once at boot. We parse public/js/data.js
// by evaluating it in a sandbox — keeps one source of truth for the universe.
function loadBase() {
  const src = fs.readFileSync(path.join(__dirname, "public/js/data.js"), "utf8");
  const sandbox = { window: {}, module: { exports: {} } };
  const fn = new Function("window", "module", src);
  fn(sandbox.window, sandbox.module);
  return sandbox.window.CANDIDATES || [];
}
const BASE = loadBase();
const BASE_BY_TICKER = Object.fromEntries(BASE.map(c => [c.ticker, c]));

const cache = new TTLCache(15 * 60 * 1000);   // 15-min TTL

// ----- helpers -----------------------------------------------------------
const getQuote   = t => cache.wrap(`quote:${t}`,   5 * 60 * 1000, () => yahoo.getQuote(t));
const getSummary = t => cache.wrap(`summary:${t}`, 30 * 60 * 1000, () => yahoo.getSummary(t));
const getHistory = t => cache.wrap(`hist:${t}`,    60 * 60 * 1000, () => yahoo.getHistory(t, "1y", "1d"));
const getFilings = t => cache.wrap(`filings:${t}`, 60 * 60 * 1000, () => sec.getRecentFilings(t));

async function enrichOne(ticker) {
  return cache.wrap(`enriched:${ticker}`, 10 * 60 * 1000, async () => {
    const base = BASE_BY_TICKER[ticker];
    if (!base) throw new Error(`Unknown ticker ${ticker}`);

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
      sources: {
        quote:   quoteR.status,
        summary: summaryR.status,
        history: histR.status,
        filings: filingsR.status
      },
      errors: results
        .map((r, i) => r.status === "rejected" ? { src: ["quote","summary","history","filings"][i], err: String(r.reason) } : null)
        .filter(Boolean)
    };
    enriched._filings = filings?.filings?.slice(0, 5) ?? [];
    return enriched;
  });
}

// ----- app --------------------------------------------------------------
const app = express();
app.use(express.static(path.join(__dirname, "public"), { index: "index.html" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now(), tickers: BASE.length }));

app.get("/api/quote/:t",      async (req, res, next) => { try { res.json(await getQuote(req.params.t.toUpperCase())); }      catch (e) { next(e); } });
app.get("/api/summary/:t",    async (req, res, next) => { try { res.json(await getSummary(req.params.t.toUpperCase())); }    catch (e) { next(e); } });
app.get("/api/history/:t",    async (req, res, next) => { try { res.json(await getHistory(req.params.t.toUpperCase())); }    catch (e) { next(e); } });
app.get("/api/technicals/:t", async (req, res, next) => {
  try {
    const hist = await getHistory(req.params.t.toUpperCase());
    res.json(computeTechnicals(hist));
  } catch (e) { next(e); }
});
app.get("/api/filings/:t", async (req, res, next) => {
  try {
    const f = await getFilings(req.params.t.toUpperCase());
    res.json({ ...f, redFlags: sec.detectRedFlags(f) });
  } catch (e) { next(e); }
});
app.get("/api/enrich/:t", async (req, res, next) => {
  try { res.json(await enrichOne(req.params.t.toUpperCase())); } catch (e) { next(e); }
});

app.get("/api/universe", async (_req, res) => {
  const results = await Promise.allSettled(BASE.map(c => enrichOne(c.ticker)));
  const data = results.map((r, i) => r.status === "fulfilled"
    ? r.value
    : { ...BASE[i], _meta: { error: String(r.reason), live: false } });
  const liveCount = data.filter(d => d._live?.price != null).length;
  res.json({
    fetchedAt: new Date().toISOString(),
    count: data.length,
    liveCount,
    candidates: data
  });
});

app.use((err, _req, res, _next) => {
  console.error("API error:", err.message);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  BearCase running on http://localhost:${PORT}\n` +
              `  ${BASE.length} tickers loaded · caching live Yahoo/SEC data\n`);
});
