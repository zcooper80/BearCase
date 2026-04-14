const { getQuote, tickerFrom, json, setEdgeCache, handleError } = require("../_shared");

module.exports = async (req, res) => {
  try {
    const t = tickerFrom(req);
    setEdgeCache(res, 60, 300);
    json(res, 200, await getQuote(t));
  } catch (e) { handleError(res, e); }
};
