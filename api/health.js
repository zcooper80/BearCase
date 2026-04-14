const { CANDIDATES, json, setEdgeCache } = require("./_shared");

module.exports = (req, res) => {
  setEdgeCache(res, 30, 60);
  json(res, 200, {
    ok: true,
    ts: Date.now(),
    tickers: CANDIDATES.length,
    runtime: "vercel-serverless",
    node: process.version
  });
};
