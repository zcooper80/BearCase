/**
 * Yahoo Finance client — hardened for serverless (Vercel) environments.
 *
 * Yahoo's public endpoints frequently 401 serverless IPs unless you send
 * a realistic User-Agent AND a consent cookie + crumb token. This module
 * performs a one-time consent handshake, caches the cookie+crumb at the
 * module scope (survives within a warm Lambda invocation), and falls back
 * to crumb-less requests when the consent flow is blocked.
 *
 * It also falls back to Stooq for basic quote data when Yahoo is
 * completely unreachable — Stooq is an anonymous CSV endpoint that
 * works reliably from cloud IPs.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";

let _session = null;   // { cookie, crumb, establishedAt }

const SESSION_TTL_MS = 60 * 60 * 1000;

function sessionValid() {
  return _session && (Date.now() - _session.establishedAt) < SESSION_TTL_MS;
}

/**
 * Perform the Yahoo consent handshake: fetch finance.yahoo.com to collect
 * a session cookie, then request a crumb token. Returns { cookie, crumb }.
 * Any step may fail — we return partial results so the caller can still
 * attempt unauthenticated requests.
 */
async function establishSession() {
  const headers = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5"
  };

  let cookie = "";
  try {
    const res = await fetch("https://fc.yahoo.com/", { headers, redirect: "manual" });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
  } catch {/* ignore */}

  if (!cookie) {
    try {
      const res = await fetch("https://finance.yahoo.com/", { headers });
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";")[0];
    } catch {/* ignore */}
  }

  let crumb = "";
  if (cookie) {
    try {
      const res = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
        headers: { ...headers, "Cookie": cookie }
      });
      if (res.ok) crumb = (await res.text()).trim();
    } catch {/* ignore */}
  }

  _session = { cookie, crumb, establishedAt: Date.now() };
  return _session;
}

async function authedFetch(url) {
  const headers = {
    "User-Agent": UA,
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.5"
  };
  if (!sessionValid()) await establishSession();
  if (_session?.cookie) headers["Cookie"] = _session.cookie;

  let target = url;
  if (_session?.crumb) {
    target = url + (url.includes("?") ? "&" : "?") + "crumb=" + encodeURIComponent(_session.crumb);
  }

  let res = await fetch(target, { headers });
  if (res.status === 401 || res.status === 403) {
    // crumb expired — re-establish once, then retry
    _session = null;
    await establishSession();
    const retryHeaders = { ...headers };
    if (_session?.cookie) retryHeaders["Cookie"] = _session.cookie;
    const retryUrl = _session?.crumb
      ? url + (url.includes("?") ? "&" : "?") + "crumb=" + encodeURIComponent(_session.crumb)
      : url;
    res = await fetch(retryUrl, { headers: retryHeaders });
  }
  if (!res.ok) throw new Error(`Yahoo ${res.status} ${url}`);
  return res.json();
}

/* -------- Stooq fallback ---------------------------------------------- */

async function stooqQuote(symbol) {
  // Stooq uses lowercase ticker + country suffix: aapl.us, tsla.us ...
  const sym = symbol.toLowerCase() + ".us";
  const url = `https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcvn&h&e=csv`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Stooq ${res.status}`);
  const csv = (await res.text()).trim().split("\n");
  if (csv.length < 2) throw new Error("Stooq empty");
  const header = csv[0].split(",").map(s => s.trim().toLowerCase());
  const row = csv[1].split(",");
  const rec = Object.fromEntries(header.map((h, i) => [h, row[i]]));
  const price = parseFloat(rec.close);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Stooq bad price");
  return {
    symbol,
    name: rec.name || symbol,
    price,
    change: null,
    changePct: null,
    marketCap: null,
    _source: "stooq"
  };
}

/* -------- Public API --------------------------------------------------- */

async function getQuote(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    const j = await authedFetch(url);
    const q = j?.quoteResponse?.result?.[0];
    if (!q) throw new Error(`Yahoo empty quote for ${symbol}`);
    return {
      symbol: q.symbol,
      name: q.longName || q.shortName,
      price: q.regularMarketPrice,
      change: q.regularMarketChange,
      changePct: q.regularMarketChangePercent,
      marketCap: q.marketCap,
      peTrailing: q.trailingPE,
      peForward: q.forwardPE,
      priceToSales: q.priceToSalesTrailing12Months,
      priceToBook: q.priceToBook,
      avgVol: q.averageDailyVolume10Day,
      sharesShort: q.sharesShort,
      shortRatio: q.shortRatio,
      shortPercentOfFloat: q.shortPercentOfFloat,
      fiftyDayAvg: q.fiftyDayAverage,
      twoHundredDayAvg: q.twoHundredDayAverage,
      beta: q.beta,
      currency: q.currency,
      exchange: q.fullExchangeName,
      _source: "yahoo-v7"
    };
  } catch (primary) {
    // v7 can be denied from some IPs — synthesize from v10 price module
    try {
      const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=price,summaryDetail,defaultKeyStatistics`;
      const j = await authedFetch(url);
      const r = j?.quoteSummary?.result?.[0];
      if (!r) throw primary;
      const p = r.price ?? {}, sd = r.summaryDetail ?? {}, dks = r.defaultKeyStatistics ?? {};
      const v = x => (x && typeof x === "object" ? x.raw : x);
      return {
        symbol,
        name: p.longName || p.shortName || symbol,
        price: v(p.regularMarketPrice),
        change: v(p.regularMarketChange),
        changePct: v(p.regularMarketChangePercent),
        marketCap: v(p.marketCap),
        peTrailing: v(sd.trailingPE),
        priceToSales: v(sd.priceToSalesTrailing12Months),
        priceToBook: v(dks.priceToBook),
        fiftyDayAvg: v(sd.fiftyDayAverage),
        twoHundredDayAvg: v(sd.twoHundredDayAverage),
        beta: v(dks.beta),
        currency: p.currency,
        _source: "yahoo-v10"
      };
    } catch (secondary) {
      // final fallback: Stooq CSV
      try { return await stooqQuote(symbol); }
      catch (tertiary) {
        throw new Error(`All quote providers failed: ${primary.message} | ${secondary.message} | ${tertiary.message}`);
      }
    }
  }
}

async function getSummary(symbol) {
  const modules = [
    "financialData", "defaultKeyStatistics", "summaryDetail",
    "balanceSheetHistory", "incomeStatementHistory",
    "cashflowStatementHistory", "calendarEvents", "price"
  ].join(",");
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
  const j = await authedFetch(url);
  const r = j?.quoteSummary?.result?.[0];
  if (!r) throw new Error(`No summary for ${symbol}`);

  const fd  = r.financialData          ?? {};
  const dks = r.defaultKeyStatistics   ?? {};
  const sd  = r.summaryDetail          ?? {};
  const bs  = r.balanceSheetHistory?.balanceSheetStatements?.[0] ?? {};
  const is  = r.incomeStatementHistory?.incomeStatementHistory?.[0] ?? {};
  const cf  = r.cashflowStatementHistory?.cashflowStatements?.[0] ?? {};

  const v = x => (x && typeof x === "object" ? x.raw : x);

  return {
    enterpriseValue:        v(dks.enterpriseValue),
    enterpriseToEbitda:     v(dks.enterpriseToEbitda),
    enterpriseToRevenue:    v(dks.enterpriseToRevenue),
    priceToSales:           v(sd.priceToSalesTrailing12Months),
    priceToBook:            v(dks.priceToBook),
    forwardPE:              v(dks.forwardPE),
    trailingPE:             v(sd.trailingPE),

    grossMargins:           v(fd.grossMargins),
    operatingMargins:       v(fd.operatingMargins),
    profitMargins:          v(fd.profitMargins),
    ebitdaMargins:          v(fd.ebitdaMargins),
    returnOnEquity:         v(fd.returnOnEquity),
    returnOnAssets:         v(fd.returnOnAssets),

    revenueGrowth:          v(fd.revenueGrowth),
    earningsGrowth:         v(fd.earningsGrowth),
    earningsQuarterlyGrowth:v(dks.earningsQuarterlyGrowth),

    totalCash:              v(fd.totalCash),
    totalDebt:              v(fd.totalDebt),
    debtToEquity:           v(fd.debtToEquity),
    currentRatio:           v(fd.currentRatio),
    quickRatio:             v(fd.quickRatio),

    freeCashflow:           v(fd.freeCashflow),
    operatingCashflow:      v(fd.operatingCashflow),

    sharesShort:            v(dks.sharesShort),
    sharesShortPriorMonth:  v(dks.sharesShortPriorMonth),
    shortPercentOfFloat:    v(dks.shortPercentOfFloat),
    shortRatio:             v(dks.shortRatio),
    floatShares:            v(dks.floatShares),

    revenue:                v(is.totalRevenue),
    netIncome:              v(is.netIncome),
    goodwill:               v(bs.goodWill),
    totalAssets:            v(bs.totalAssets),
    intangibleAssets:       v(bs.intangibleAssets),
    accountsReceivable:     v(bs.netReceivables),
    inventory:              v(bs.inventory),
    ebit:                   v(is.ebit),
    interestExpense:        v(is.interestExpense),

    earningsDate: (r.calendarEvents?.earnings?.earningsDate || [])
                    .map(d => v(d)).filter(Boolean)
  };
}

async function getHistory(symbol, range = "1y", interval = "1d") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const j = await authedFetch(url);
  const r = j?.chart?.result?.[0];
  if (!r) throw new Error(`No history for ${symbol}`);
  const ts   = r.timestamp ?? [];
  const q    = r.indicators?.quote?.[0] ?? {};
  const adj  = r.indicators?.adjclose?.[0]?.adjclose ?? q.close ?? [];
  return ts.map((t, i) => ({
    t, o: q.open?.[i], h: q.high?.[i], l: q.low?.[i],
    c: q.close?.[i], v: q.volume?.[i], a: adj[i]
  })).filter(r => r.c != null);
}

module.exports = { getQuote, getSummary, getHistory, establishSession };
