const { getFilings, sec, tickerFrom, json, setEdgeCache, handleError } = require("../_shared");

module.exports = async (req, res) => {
  try {
    const t = tickerFrom(req);
    setEdgeCache(res, 3600, 86400);
    const f = await getFilings(t);
    json(res, 200, { ...f, redFlags: sec.detectRedFlags(f) });
  } catch (e) { handleError(res, e); }
};
