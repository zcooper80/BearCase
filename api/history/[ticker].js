const { getHistory, tickerFrom, json, setEdgeCache, handleError } = require("../_shared");

module.exports = async (req, res) => {
  try {
    const t = tickerFrom(req);
    setEdgeCache(res, 900, 3600);
    json(res, 200, await getHistory(t));
  } catch (e) { handleError(res, e); }
};
