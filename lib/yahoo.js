/**
 * Yahoo Finance client (unofficial public endpoints).
 *
 *   - query1.finance.yahoo.com/v7/finance/quote          → current quote
 *   - query2.finance.yahoo.com/v10/finance/quoteSummary  → fundamentals
 *   - query1.finance.yahoo.com/v8/finance/chart          → OHLCV history
 *
 * No API key needed. We identify ourselves with a realistic User-Agent so
 * we don't get the stock 401 that the default Node UA trips.
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) " +
           "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";

async function jsonFetch(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/json" } });
  if (!res.ok) throw new Error(`Yahoo ${res.status} for ${url}`);
  return res.json();
}

async function getQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  const j = await jsonFetch(url);
  const q = j?.quoteResponse?.result?.[0];
  if (!q) throw new Error(`No quote for ${symbol}`);
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
    exchange: q.fullExchangeName
  };
}

async function getSummary(symbol) {
  const modules = [
    "financialData", "defaultKeyStatistics", "summaryDetail",
    "balanceSheetHistory", "incomeStatementHistory",
    "cashflowStatementHistory", "calendarEvents"
  ].join(",");
  const url =
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
  const j = await jsonFetch(url);
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
    // valuation
    enterpriseValue:        v(dks.enterpriseValue),
    enterpriseToEbitda:     v(dks.enterpriseToEbitda),
    enterpriseToRevenue:    v(dks.enterpriseToRevenue),
    priceToSales:           v(sd.priceToSalesTrailing12Months),
    priceToBook:            v(dks.priceToBook),
    forwardPE:              v(dks.forwardPE),
    trailingPE:             v(sd.trailingPE),

    // profitability / quality
    grossMargins:           v(fd.grossMargins),
    operatingMargins:       v(fd.operatingMargins),
    profitMargins:          v(fd.profitMargins),
    ebitdaMargins:          v(fd.ebitdaMargins),
    returnOnEquity:         v(fd.returnOnEquity),
    returnOnAssets:         v(fd.returnOnAssets),

    // growth
    revenueGrowth:          v(fd.revenueGrowth),
    earningsGrowth:         v(fd.earningsGrowth),
    earningsQuarterlyGrowth:v(dks.earningsQuarterlyGrowth),

    // balance sheet
    totalCash:              v(fd.totalCash),
    totalDebt:              v(fd.totalDebt),
    debtToEquity:           v(fd.debtToEquity),
    currentRatio:           v(fd.currentRatio),
    quickRatio:             v(fd.quickRatio),

    // cash flow
    freeCashflow:           v(fd.freeCashflow),
    operatingCashflow:      v(fd.operatingCashflow),

    // short interest
    sharesShort:            v(dks.sharesShort),
    sharesShortPriorMonth:  v(dks.sharesShortPriorMonth),
    shortPercentOfFloat:    v(dks.shortPercentOfFloat),
    shortRatio:             v(dks.shortRatio),
    floatShares:            v(dks.floatShares),

    // one-line numbers
    revenue:                v(is.totalRevenue),
    netIncome:              v(is.netIncome),
    goodwill:               v(bs.goodWill),
    totalAssets:            v(bs.totalAssets),
    intangibleAssets:       v(bs.intangibleAssets),
    accountsReceivable:     v(bs.netReceivables),
    inventory:              v(bs.inventory),
    ebit:                   v(is.ebit),
    interestExpense:        v(is.interestExpense),

    // events
    earningsDate:           (r.calendarEvents?.earnings?.earningsDate || [])
                              .map(d => v(d)).filter(Boolean)
  };
}

async function getHistory(symbol, range = "1y", interval = "1d") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const j = await jsonFetch(url);
  const r = j?.chart?.result?.[0];
  if (!r) throw new Error(`No history for ${symbol}`);
  const ts   = r.timestamp ?? [];
  const q    = r.indicators?.quote?.[0] ?? {};
  const adj  = r.indicators?.adjclose?.[0]?.adjclose ?? q.close ?? [];
  const rows = ts.map((t, i) => ({
    t,
    o: q.open?.[i], h: q.high?.[i], l: q.low?.[i],
    c: q.close?.[i], v: q.volume?.[i], a: adj[i]
  })).filter(r => r.c != null);
  return rows;
}

module.exports = { getQuote, getSummary, getHistory };
