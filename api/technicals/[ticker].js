const { getHistory, computeTechnicals, tickerFrom, json, setEdgeCache, handleError } = require("../_shared");

module.exports = async (req, res) => {
  try {
    const t = tickerFrom(req);
    setEdgeCache(res, 900, 3600);
    const hist = await getHistory(t);
    json(res, 200, computeTechnicals(hist));
  } catch (e) { handleError(res, e); }
};
