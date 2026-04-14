/**
 * BearCase Candidate Universe
 *
 * Each entry is scored on 0–10 scales for the factor families described in the
 * fundamental / technical / macro framework. Values are representative inputs
 * synthesized from publicly reported financials, analyst commentary, and
 * widely-discussed bear theses. They are illustrative of the analytical
 * framework, NOT a live market feed.
 *
 * Factors (all 0–10, higher = more bearish / more conviction on the short):
 *   valuation          Extreme P/E, P/S, EV/EBITDA vs peers & history
 *   quality            Margin decay, AR bloat, inventory, FCF vs earnings
 *   balance            Leverage, interest coverage, goodwill/intangibles
 *   filings            Auditor changes, CFO exits, accounting flags, SEC issues
 *   technical          Trend breakdown, MAs, death cross, lower highs/lows
 *   shortInt           Rising short interest conviction (with squeeze penalty)
 *   macro              Rate sensitivity, sector rotation, regulatory drag
 *   aiRisk             Vulnerability to AI/LLM automation of core product
 *
 * squeezeRisk 0–10  – higher means more dangerous to short (high SI% + low float + retail)
 * beta, avgDailyVolM – used for liquidity / sizing
 * optionable           – whether put options exist / are liquid
 * putIV                – representative 90-day put implied vol (for option sizing)
 */

const CANDIDATES = [
  {
    ticker: "CHGG", company: "Chegg, Inc.",
    sector: "Ed-Tech / Consumer Internet", price: 2.10,
    valuation: 6, quality: 9, balance: 8, filings: 4,
    technical: 9, shortInt: 8, macro: 6, aiRisk: 10,
    squeezeRisk: 6, beta: 1.6, avgDailyVolM: 8.5,
    optionable: true, putIV: 95,
    thesis: [
      "Subscriber base collapsed after ChatGPT — a textbook LLM-disruption case study.",
      "Gross margin compressed as the company pivots toward AI tools it does not own.",
      "Convertible debt refinancing risk with market cap now below net debt.",
      "Revenue decelerating double-digits while cost base remains semi-fixed."
    ],
    catalysts: ["Earnings misses", "Potential going-concern language", "Debt maturity wall"]
  },
  {
    ticker: "FVRR", company: "Fiverr International",
    sector: "Online Gig Marketplace", price: 24.50,
    valuation: 7, quality: 7, balance: 4, filings: 2,
    technical: 7, shortInt: 7, macro: 6, aiRisk: 9,
    squeezeRisk: 7, beta: 1.8, avgDailyVolM: 1.2,
    optionable: true, putIV: 70,
    thesis: [
      "Core 'gig' categories (copywriting, logo, translation, basic code) now commodity-priced by LLMs.",
      "Take-rate expansion is masking active-buyer decline — a quality-of-growth red flag.",
      "SG&A heavy relative to slowing top-line; operating deleverage if growth breaks.",
      "High short interest — manage squeeze risk with put structures, not naked short."
    ],
    catalysts: ["Active buyer disclosure", "AI-native competitor pricing pressure"]
  },
  {
    ticker: "UPWK", company: "Upwork Inc.",
    sector: "Online Gig Marketplace", price: 11.20,
    valuation: 6, quality: 6, balance: 3, filings: 2,
    technical: 6, shortInt: 6, macro: 5, aiRisk: 8,
    squeezeRisk: 5, beta: 1.7, avgDailyVolM: 3.0,
    optionable: true, putIV: 60,
    thesis: [
      "Enterprise narrative breaking down; SMB buyers substitute AI for junior freelance work.",
      "GSV growth decelerating while take-rate is already elevated.",
      "Declining average project size is an earnings-quality tell."
    ],
    catalysts: ["GSV miss", "Enterprise churn disclosure"]
  },
  {
    ticker: "TTD", company: "The Trade Desk",
    sector: "AdTech / SaaS", price: 78.00,
    valuation: 10, quality: 5, balance: 2, filings: 3,
    technical: 6, shortInt: 4, macro: 6, aiRisk: 7,
    squeezeRisk: 4, beta: 1.9, avgDailyVolM: 5.2,
    optionable: true, putIV: 55,
    thesis: [
      "EV/EBITDA well above both sector and its own historical median — asymmetric downside to mean.",
      "Walled-garden ad platforms increasingly using in-house AI bidding, reducing DSP value.",
      "Stock-based compensation inflating 'adjusted' profitability metrics."
    ],
    catalysts: ["Ad-market softening", "Rate-cut disappointment", "Guidance cut"]
  },
  {
    ticker: "COIN", company: "Coinbase Global",
    sector: "Crypto Exchange", price: 165.00,
    valuation: 8, quality: 7, balance: 5, filings: 5,
    technical: 5, shortInt: 6, macro: 7, aiRisk: 3,
    squeezeRisk: 8, beta: 3.1, avgDailyVolM: 11.0,
    optionable: true, putIV: 85,
    thesis: [
      "Earnings over-indexed to transaction spikes; revenue quality extremely cyclical.",
      "Regulatory overhang remains; stablecoin interest income is rate-cut vulnerable.",
      "Historically violent squeezes — define risk with long puts, do NOT short outright."
    ],
    catalysts: ["Crypto drawdown", "Rate cuts compressing interest income"]
  },
  {
    ticker: "CVNA", company: "Carvana Co.",
    sector: "Used Auto Retail", price: 215.00,
    valuation: 10, quality: 8, balance: 10, filings: 7,
    technical: 4, shortInt: 8, macro: 8, aiRisk: 2,
    squeezeRisk: 10, beta: 3.6, avgDailyVolM: 7.5,
    optionable: true, putIV: 90,
    thesis: [
      "One of the most leveraged balance sheets in US retail; interest coverage fragile.",
      "Gross profit per unit dependent on used-car prices — cyclical tailwind fading.",
      "EXTREME squeeze history: use defined-risk put spreads only."
    ],
    catalysts: ["Used-vehicle price normalization", "Credit tightening"]
  },
  {
    ticker: "BYND", company: "Beyond Meat",
    sector: "Plant-Based Foods", price: 7.40,
    valuation: 8, quality: 10, balance: 9, filings: 6,
    technical: 8, shortInt: 9, macro: 6, aiRisk: 1,
    squeezeRisk: 7, beta: 2.3, avgDailyVolM: 3.2,
    optionable: true, putIV: 110,
    thesis: [
      "Persistent negative gross margins; revenue declining YoY for multiple quarters.",
      "Going-concern narrative tightening; convertible debt overhang.",
      "Category growth collapsed — structural, not cyclical."
    ],
    catalysts: ["Covenant breach", "Distribution losses", "Equity raise dilution"]
  },
  {
    ticker: "AFRM", company: "Affirm Holdings",
    sector: "BNPL / Consumer Finance", price: 42.00,
    valuation: 9, quality: 6, balance: 7, filings: 3,
    technical: 5, shortInt: 7, macro: 9, aiRisk: 4,
    squeezeRisk: 7, beta: 3.4, avgDailyVolM: 9.0,
    optionable: true, putIV: 75,
    thesis: [
      "Unit economics squeezed by higher funding costs; credit losses normalizing higher.",
      "Valuation implies a fintech multiple on a subprime-adjacent lender.",
      "Rate-cut dependency — if cuts disappoint, thesis accelerates to the downside."
    ],
    catalysts: ["Delinquency upticks", "Partner (Shopify) renegotiation", "Rate surprises"]
  },
  {
    ticker: "RIVN", company: "Rivian Automotive",
    sector: "EV Manufacturing", price: 9.80,
    valuation: 8, quality: 9, balance: 7, filings: 2,
    technical: 8, shortInt: 6, macro: 6, aiRisk: 3,
    squeezeRisk: 5, beta: 2.1, avgDailyVolM: 25.0,
    optionable: true, putIV: 80,
    thesis: [
      "Cash burn per vehicle remains punishing; gross margin still deeply negative.",
      "EV demand curve normalizing; competitive intensity rising from incumbents.",
      "Dilution risk high — secondary offerings have repeatedly broken support."
    ],
    catalysts: ["Delivery misses", "Cash raise", "Price cuts"]
  },
  {
    ticker: "PLTR", company: "Palantir Technologies",
    sector: "Enterprise AI Software", price: 78.00,
    valuation: 10, quality: 4, balance: 1, filings: 3,
    technical: 3, shortInt: 5, macro: 5, aiRisk: 2,
    squeezeRisk: 9, beta: 2.6, avgDailyVolM: 50.0,
    optionable: true, putIV: 65,
    thesis: [
      "P/S multiple in top decile of software history — mean-reversion setup if growth misses.",
      "SBC dilution understates 'real' earnings meaningfully.",
      "Retail ownership + momentum factor = significant squeeze risk; options only."
    ],
    catalysts: ["Government contract slippage", "Commercial growth deceleration"]
  },
  {
    ticker: "SMCI", company: "Super Micro Computer",
    sector: "AI Infrastructure Hardware", price: 38.00,
    valuation: 8, quality: 7, balance: 4, filings: 9,
    technical: 7, shortInt: 7, macro: 4, aiRisk: 2,
    squeezeRisk: 7, beta: 2.8, avgDailyVolM: 14.0,
    optionable: true, putIV: 120,
    thesis: [
      "Auditor resignation + delayed 10-K — highest tier of filing red flag.",
      "Revenue-recognition questions raised in short-seller reports.",
      "Extreme IV means long-put premium is pricey — put spreads preferred."
    ],
    catalysts: ["Audit outcome", "Nasdaq delisting risk"]
  },
  {
    ticker: "PTON", company: "Peloton Interactive",
    sector: "Connected Fitness", price: 4.10,
    valuation: 6, quality: 9, balance: 9, filings: 5,
    technical: 7, shortInt: 8, macro: 5, aiRisk: 2,
    squeezeRisk: 6, beta: 2.4, avgDailyVolM: 11.0,
    optionable: true, putIV: 85,
    thesis: [
      "Subscriber growth flatlined; equipment revenue collapsed post-pandemic.",
      "Convertible note refinancing looming; interest coverage weak.",
      "Management turnover elevated."
    ],
    catalysts: ["Refi outcome", "Sub-count misses"]
  },
  {
    ticker: "W", company: "Wayfair Inc.",
    sector: "Online Home Retail", price: 47.00,
    valuation: 8, quality: 8, balance: 9, filings: 2,
    technical: 7, shortInt: 7, macro: 8, aiRisk: 2,
    squeezeRisk: 6, beta: 2.8, avgDailyVolM: 3.5,
    optionable: true, putIV: 70,
    thesis: [
      "Negative tangible book value; persistent FCF negativity.",
      "Housing-turnover weakness a structural headwind to furniture demand.",
      "Active-customer decline masked by larger order values."
    ],
    catalysts: ["Holiday GMV", "Housing data"]
  },
  {
    ticker: "TDOC", company: "Teladoc Health",
    sector: "Telehealth / SaaS", price: 9.20,
    valuation: 6, quality: 8, balance: 6, filings: 4,
    technical: 8, shortInt: 5, macro: 5, aiRisk: 6,
    squeezeRisk: 3, beta: 1.5, avgDailyVolM: 6.0,
    optionable: true, putIV: 60,
    thesis: [
      "Goodwill impairments following Livongo deal highlight poor capital allocation.",
      "Primary-care competition rising; AI triage tools from payers compressing pricing.",
      "BetterHelp has quietly peaked."
    ],
    catalysts: ["Payer contract churn", "Further impairments"]
  },
  {
    ticker: "DOCN", company: "DigitalOcean Holdings",
    sector: "Cloud Infrastructure", price: 34.00,
    valuation: 7, quality: 6, balance: 7, filings: 2,
    technical: 5, shortInt: 6, macro: 5, aiRisk: 6,
    squeezeRisk: 4, beta: 1.5, avgDailyVolM: 1.8,
    optionable: true, putIV: 55,
    thesis: [
      "Hyperscalers + AI-native clouds are taking developer mindshare.",
      "Debt-financed buybacks at elevated prices — balance-sheet optimization unwind risk.",
      "Net-dollar retention decelerating; AI pivot is narrative, not yet revenue."
    ],
    catalysts: ["NDR disclosure", "Debt refinancing"]
  },
  {
    ticker: "OLPX", company: "Olaplex Holdings",
    sector: "Prestige Beauty", price: 1.50,
    valuation: 5, quality: 9, balance: 7, filings: 5,
    technical: 7, shortInt: 7, macro: 4, aiRisk: 1,
    squeezeRisk: 4, beta: 1.6, avgDailyVolM: 4.0,
    optionable: true, putIV: 80,
    thesis: [
      "Revenue declined sharply post-IPO; brand heat fading.",
      "Class-action overhang; customer concentration in salon channel.",
      "Private-equity overhang; insiders have been sellers."
    ],
    catalysts: ["Professional channel churn", "Secondary offerings"]
  },
  {
    ticker: "BIGC", company: "BigCommerce Holdings",
    sector: "E-Commerce SaaS", price: 5.40,
    valuation: 6, quality: 7, balance: 8, filings: 3,
    technical: 7, shortInt: 6, macro: 6, aiRisk: 7,
    squeezeRisk: 4, beta: 2.0, avgDailyVolM: 1.5,
    optionable: true, putIV: 85,
    thesis: [
      "Sub-scale vs Shopify; AI storefront generators commoditize the low-end template business.",
      "Convertible notes + no profitability path; dilution vs default choice ahead.",
      "ARR growth decelerating each quarter."
    ],
    catalysts: ["ARR print", "Going-concern risk"]
  },
  {
    ticker: "ZM", company: "Zoom Communications",
    sector: "Communications SaaS", price: 65.00,
    valuation: 3, quality: 5, balance: 1, filings: 2,
    technical: 4, shortInt: 3, macro: 4, aiRisk: 7,
    squeezeRisk: 3, beta: 0.9, avgDailyVolM: 4.5,
    optionable: true, putIV: 40,
    thesis: [
      "AI-native meeting platforms (embedded in Teams, Google, OpenAI) compressing enterprise renewals.",
      "Cash-rich but growth anemic — capital return cannot offset multiple compression.",
      "Lower-conviction short; use strictly as a hedge leg."
    ],
    catalysts: ["Enterprise seat renewals", "Microsoft bundling"]
  },
  {
    ticker: "TWLO", company: "Twilio Inc.",
    sector: "CPaaS / Communications APIs", price: 58.00,
    valuation: 5, quality: 6, balance: 3, filings: 3,
    technical: 5, shortInt: 4, macro: 5, aiRisk: 6,
    squeezeRisk: 3, beta: 1.7, avgDailyVolM: 4.0,
    optionable: true, putIV: 55,
    thesis: [
      "SMS pass-through revenue inflates top line; gross profit growth anemic.",
      "Segment API commoditization as LLM providers offer integrated voice/SMS.",
      "Activist pressure eased — 'catalyst fatigue' setup."
    ],
    catalysts: ["Segment divestiture", "Organic growth miss"]
  },
  {
    ticker: "WIX", company: "Wix.com Ltd.",
    sector: "Website Builder / SaaS", price: 155.00,
    valuation: 7, quality: 5, balance: 5, filings: 2,
    technical: 3, shortInt: 4, macro: 4, aiRisk: 8,
    squeezeRisk: 3, beta: 1.4, avgDailyVolM: 0.9,
    optionable: true, putIV: 45,
    thesis: [
      "Core product most exposed to generative-AI site builders (users describe a site, get one).",
      "FCF story has re-rated the stock, but revenue growth mid-teens at best.",
      "Competitive bundling from Shopify / Squarespace AI features compresses ARPU."
    ],
    catalysts: ["AI-competitor launches", "ARPU disclosure"]
  }
];

// Expose — dual-purpose: browser (window) + Node (CommonJS for Vercel functions)
if (typeof window !== "undefined") window.CANDIDATES = CANDIDATES;
if (typeof module !== "undefined" && module.exports) module.exports = { CANDIDATES };
