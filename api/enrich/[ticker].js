const { enrichFull, tickerFrom, json, setEdgeCache, handleError } = require("../_shared");

module.exports = async (req, res) => {
  try {
    const t = tickerFrom(req);
    setEdgeCache(res, 300, 1800);
    json(res, 200, await enrichFull(t));
  } catch (e) { handleError(res, e); }
};

module.exports.config = { maxDuration: 30 };
