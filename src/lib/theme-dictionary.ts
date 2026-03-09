// ─── Insurance Theme Dictionary ─────────────────────────────────────────────
// Defines keyword groups for tracking insurance industry signals in SEC filings.
// All keywords are multi-word phrases to reduce false positives.

export interface ThemeDefinition {
  id: string;
  label: string;
  color: string; // Tailwind badge classes
  chartColor: string; // Hex color for Recharts
  keywords: string[]; // All lowercase
}

export const THEME_DICTIONARY: ThemeDefinition[] = [
  {
    id: "pricing_signals",
    label: "Pricing Signals",
    color: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    chartColor: "#60a5fa",
    keywords: [
      "rate increase",
      "rate adequacy",
      "rate hardening",
      "premium rate",
      "pricing discipline",
      "price increase",
      "rate action",
      "rate change",
      "rate improvement",
      "rate level",
      "pricing environment",
      "rate firming",
      "hard market",
      "soft market",
      "rate decrease",
      "rate reduction",
      "pricing pressure",
      "competitive pricing",
    ],
  },
  {
    id: "loss_trends",
    label: "Loss Trends",
    color: "bg-red-500/15 text-red-400 border-red-500/20",
    chartColor: "#f87171",
    keywords: [
      "loss ratio",
      "loss trend",
      "loss cost",
      "claims frequency",
      "claims severity",
      "adverse development",
      "prior year development",
      "reserve strengthening",
      "loss reserve",
      "incurred losses",
      "social inflation",
      "litigation trend",
      "nuclear verdict",
      "loss experience",
      "attritional loss",
    ],
  },
  {
    id: "cat_exposure",
    label: "Cat Exposure",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    chartColor: "#fbbf24",
    keywords: [
      "catastrophe loss",
      "natural disaster",
      "hurricane loss",
      "wildfire risk",
      "flood exposure",
      "earthquake risk",
      "severe weather",
      "storm loss",
      "cat exposure",
      "aggregate limit",
      "probable maximum loss",
      "climate change",
      "climate risk",
      "secondary peril",
      "weather event",
    ],
  },
  {
    id: "reinsurance_market",
    label: "Reinsurance Market",
    color: "bg-purple-500/15 text-purple-400 border-purple-500/20",
    chartColor: "#a78bfa",
    keywords: [
      "reinsurance cost",
      "reinsurance placement",
      "reinsurance program",
      "reinsurance market",
      "reinsurance capacity",
      "reinsurance pricing",
      "ceded premium",
      "retrocession",
      "quota share",
      "excess of loss",
      "retention level",
      "attachment point",
      "treaty renewal",
    ],
  },
  {
    id: "regulatory",
    label: "Regulatory",
    color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
    chartColor: "#22d3ee",
    keywords: [
      "regulatory change",
      "regulatory environment",
      "regulatory approval",
      "risk-based capital",
      "rbc ratio",
      "state insurance",
      "rate filing",
      "market conduct",
      "solvency requirement",
      "statutory surplus",
      "admitted assets",
      "regulatory compliance",
    ],
  },
  {
    id: "investment_interest",
    label: "Investment / Interest Rate",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    chartColor: "#34d399",
    keywords: [
      "investment income",
      "interest rate",
      "portfolio yield",
      "book yield",
      "unrealized loss",
      "unrealized gain",
      "fixed income",
      "investment portfolio",
      "reinvestment rate",
      "interest rate risk",
      "credit quality",
      "asset allocation",
      "duration risk",
    ],
  },
  {
    id: "emerging_risks",
    label: "Emerging Risks",
    color: "bg-rose-500/15 text-rose-400 border-rose-500/20",
    chartColor: "#fb7185",
    keywords: [
      "cyber risk",
      "cyber insurance",
      "ransomware attack",
      "artificial intelligence",
      "autonomous vehicle",
      "pandemic risk",
      "supply chain",
      "economic inflation",
      "geopolitical risk",
      "systemic risk",
      "technology risk",
      "emerging risk",
    ],
  },
];

// Pre-built flat list of all keywords for efficient scanning
export const ALL_KEYWORDS: string[] = THEME_DICTIONARY.flatMap(
  (t) => t.keywords
);

// Map keyword → theme id for reverse lookups
export const KEYWORD_TO_THEME = new Map<string, string>(
  THEME_DICTIONARY.flatMap((theme) =>
    theme.keywords.map((kw) => [kw, theme.id] as [string, string])
  )
);
