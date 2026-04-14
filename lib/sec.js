/**
 * SEC EDGAR client — public filings.
 *
 *   data.sec.gov/submissions/CIK{10-digit-zero-padded}.json
 *
 * EDGAR REQUIRES a descriptive User-Agent with contact info for programmatic
 * access. We send a generic educational-tool UA.
 */

const UA = "BearCase-Educational-Analyzer/0.2 (contact: bearcase@example.org)";

async function jsonFetch(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "application/json",
               "Host": new URL(url).host }
  });
  if (!res.ok) throw new Error(`SEC ${res.status} for ${url}`);
  return res.json();
}

// Common publicly-traded tickers → CIK (10-digit zero-padded).
// Only the ones in our candidate universe; easy to extend.
const CIK = {
  CHGG: "0001364954", FVRR: "0001762301", UPWK: "0001627475",
  TTD:  "0001671933", COIN: "0001679788", CVNA: "0001690820",
  BYND: "0001655210", AFRM: "0001820953", RIVN: "0001874178",
  PLTR: "0001321655", SMCI: "0001375365", PTON: "0001639825",
  W:    "0001616707", TDOC: "0001477449", DOCN: "0001582961",
  OLPX: "0001868726", BIGC: "0001626450", ZM:   "0001585521",
  TWLO: "0001447669", WIX:  "0001576789"
};

async function getRecentFilings(ticker, limit = 25) {
  const cik = CIK[ticker];
  if (!cik) return { ticker, filings: [], note: "CIK not mapped" };
  const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
  const j = await jsonFetch(url);
  const r = j?.filings?.recent ?? {};
  const out = [];
  const len = (r.accessionNumber ?? []).length;
  for (let i = 0; i < Math.min(len, limit); i++) {
    out.push({
      form:         r.form?.[i],
      filedAt:      r.filingDate?.[i],
      periodOfReport: r.reportDate?.[i],
      accession:    r.accessionNumber?.[i],
      primaryDoc:   r.primaryDocument?.[i],
      primaryDocDesc: r.primaryDocDescription?.[i],
      url: r.primaryDocument?.[i]
        ? `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${r.accessionNumber?.[i].replace(/-/g,'')}/${r.primaryDocument[i]}`
        : null
    });
  }
  return {
    ticker,
    cik,
    name: j?.name,
    sic: j?.sicDescription,
    fiscalYearEnd: j?.fiscalYearEnd,
    filings: out
  };
}

/**
 * Heuristic red-flag detector. Scans recent filings for items commonly
 * associated with governance / accounting concerns.
 */
function detectRedFlags(submissions) {
  const flags = [];
  const filings = submissions?.filings ?? [];
  const recentWindow = filings.slice(0, 40);

  // Count NT (late filing) filings in last 40 filings
  const nt = recentWindow.filter(f => /^NT/i.test(f.form || ""));
  if (nt.length) flags.push({
    kind: "late-filing",
    severity: Math.min(3, nt.length),
    detail: `${nt.length} NT-form (late filing) submissions in recent history`
  });

  // 8-K filings with item descriptors — auditor changes / officer exits
  const eightKs = recentWindow.filter(f => f.form === "8-K");
  const auditorChange = eightKs.find(f =>
    /auditor|accountant|changes?.in.*registrant.*certifying/i.test(f.primaryDocDesc || ""));
  if (auditorChange) flags.push({
    kind: "auditor-change",
    severity: 3,
    detail: `8-K on ${auditorChange.filedAt} references auditor/accountant change`
  });

  const officerExit = eightKs.find(f =>
    /resignation|departure|officer|principal.financial/i.test(f.primaryDocDesc || ""));
  if (officerExit) flags.push({
    kind: "officer-departure",
    severity: 2,
    detail: `8-K on ${officerExit.filedAt} cites officer departure`
  });

  // SC 13D/G changes — ownership shifts
  const ownershipShifts = recentWindow.filter(f =>
    /^SC 13[DG]/i.test(f.form || "")).length;
  if (ownershipShifts >= 3) flags.push({
    kind: "ownership-shift",
    severity: 1,
    detail: `${ownershipShifts} ownership-filings in recent activity`
  });

  return flags;
}

module.exports = { getRecentFilings, detectRedFlags, CIK };
