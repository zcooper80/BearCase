const { getSummary, tickerFrom, json, setEdgeCache, handleError } = require("../_shared");

module.exports = async (req, res) => {
  try {
    const t = tickerFrom(req);
    setEdgeCache(res, 600, 1800);
    json(res, 200, await getSummary(t));
  } catch (e) { handleError(res, e); }
};
