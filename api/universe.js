/**
 * /api/universe — lightweight enrichment of the full candidate list.
 *
 * Uses only quote + summary per ticker (2 fetches × 20 = 40 parallel) so we
 * stay well under Vercel's default timeout. Per-name detail (history,
 * filings) is fetched on demand via /api/enrich/[ticker].
 */

const { CANDIDATES, enrichLight, json, setEdgeCache, handleError } = require("./_shared");

module.exports = async (req, res) => {
  try {
    setEdgeCache(res, 300, 1800);   // 5 min fresh, 30 min SWR
    const settled = await Promise.allSettled(CANDIDATES.map(c => enrichLight(c.ticker)));
    const data = settled.map((r, i) => r.status === "fulfilled" && r.value
      ? r.value
      : { ...CANDIDATES[i], _meta: { error: String(r.reason), live: false } });

    // Count live sources for diagnostics
    const liveCount = data.filter(d => d._live?.price != null).length;
    json(res, 200, {
      fetchedAt: new Date().toISOString(),
      count: data.length,
      liveCount,
      candidates: data
    });
  } catch (e) { handleError(res, e); }
};

module.exports.config = { maxDuration: 30 };
