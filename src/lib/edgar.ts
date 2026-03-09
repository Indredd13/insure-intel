// ─── SEC EDGAR API Client ───────────────────────────────────────────────────
// Fetches filing metadata and XBRL financial facts from SEC EDGAR.
// Rate-limited to stay under 10 req/sec. No API key required.
// Docs: https://www.sec.gov/search-filings/edgar-application-programming-interfaces

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EdgarSubmission {
  cik: number;
  entityType: string;
  sic: string;
  sicDescription: string;
  name: string;
  tickers: string[];
  exchanges: string[];
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      form: string[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
    files: Array<{ name: string; filingCount: number; filingFrom: string; filingTo: string }>;
  };
}

export interface EdgarCompanyFacts {
  cik: number;
  entityName: string;
  facts: {
    "us-gaap"?: Record<string, EdgarConcept>;
    "ifrs-full"?: Record<string, EdgarConcept>;
  };
}

export interface EdgarConcept {
  label: string;
  description: string;
  units: Record<string, EdgarFactValue[]>;
}

export interface EdgarFactValue {
  start?: string;
  end: string;
  val: number;
  accn: string;
  fy: number;
  fp: string;
  form: string;
  filed: string;
  frame?: string;
}

// ─── Parsed output types ────────────────────────────────────────────────────

export interface ParsedFiling {
  accessionNumber: string;
  formType: string;
  filingDate: Date;
  reportDate: Date | null;
  primaryDocument: string | null;
  description: string | null;
  edgarUrl: string | null;
}

export interface ParsedMetric {
  metricName: string;
  xbrlTag: string;
  value: number;
  unit: string;
  periodStart: Date | null;
  periodEnd: Date;
  fiscalYear: number | null;
  fiscalPeriod: string | null;
  formType: string;
  filed: Date | null;
}

// ─── Rate limiter ───────────────────────────────────────────────────────────

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 120; // ms — keeps us safely under 10 req/sec

export async function edgarFetch(
  url: string,
  options?: { accept?: string }
): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();

  const response = await fetch(url, {
    headers: {
      "User-Agent": "InsureIntel admin@insureintel.com",
      Accept: options?.accept ?? "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`EDGAR API ${response.status}: ${response.statusText} — ${url}`);
  }

  return response;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function padCik(cik: string): string {
  return cik.replace(/^0+/, "").padStart(10, "0");
}

// ─── API Fetchers ───────────────────────────────────────────────────────────

export async function fetchSubmissions(cik: string): Promise<EdgarSubmission> {
  const url = `https://data.sec.gov/submissions/CIK${padCik(cik)}.json`;
  const response = await edgarFetch(url);
  return response.json();
}

export async function fetchCompanyFacts(cik: string): Promise<EdgarCompanyFacts> {
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`;
  const response = await edgarFetch(url);
  return response.json();
}

// ─── Filing Parser ──────────────────────────────────────────────────────────

const RELEVANT_FORMS = new Set(["10-K", "10-Q", "8-K", "10-K/A", "10-Q/A"]);

export function parseFilings(submission: EdgarSubmission): ParsedFiling[] {
  const recent = submission.filings.recent;
  const cik = String(submission.cik);
  const filings: ParsedFiling[] = [];

  for (let i = 0; i < recent.accessionNumber.length; i++) {
    const formType = recent.form[i];
    if (!RELEVANT_FORMS.has(formType)) continue;

    const accessionNumber = recent.accessionNumber[i];
    const accessionNoDashes = accessionNumber.replace(/-/g, "");
    const primaryDocument = recent.primaryDocument[i] || null;

    const edgarUrl = primaryDocument
      ? `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNoDashes}/${primaryDocument}`
      : null;

    filings.push({
      accessionNumber,
      formType,
      filingDate: new Date(recent.filingDate[i]),
      reportDate: recent.reportDate[i] ? new Date(recent.reportDate[i]) : null,
      primaryDocument,
      description: recent.primaryDocDescription[i] || null,
      edgarUrl,
    });
  }

  return filings;
}

// ─── Financial Metrics Parser ───────────────────────────────────────────────

// Map: normalized metric name → array of XBRL tags to try (priority order)
const METRIC_TAG_MAP: Record<string, string[]> = {
  gwp: [
    "PremiumsWrittenGross",
    "GrossWrittenPremiums",
    "DirectPremiumsWritten",
    "DirectPremiumsEarned",
  ],
  nwp: [
    "PremiumsWrittenNet",
    "NetPremiumsWritten",
    "WrittenPremiumsNet",
  ],
  nep: [
    "PremiumsEarnedNet",
    "EarnedPremiums",
    "NetPremiumsEarned",
    "PremiumsEarned",
  ],
  incurred_losses: [
    "PolicyholderBenefitsAndClaimsIncurredNet",
    "LossesAndLossAdjustmentExpenses",
    "PolicyholderBenefitsAndClaimsIncurredGross",
    "IncurredClaimsNet",
    "BenefitsLossesAndExpenses",
    "IncurredClaims",
  ],
  underwriting_expenses: [
    "OtherUnderwritingExpense",
    "PolicyAcquisitionCosts",
    "DeferredPolicyAcquisitionCostsAmortizationExpense",
    "AcquisitionCosts",
    "OperatingExpenses",
  ],
  investment_income: [
    "NetInvestmentIncome",
    "InvestmentIncome",
    "InvestmentIncomeNet",
    "InvestmentIncomeInterestAndDividend",
  ],
  net_income: [
    "NetIncomeLoss",
    "ProfitLoss",
    "NetIncomeLossAvailableToCommonStockholdersBasic",
  ],
  stockholders_equity: [
    "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
  ],
  total_revenue: [
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
  ],
  total_assets: [
    "Assets",
  ],
  interest_income: [
    "InterestAndDividendIncomeSecurities",
    "InterestAndFeeIncomeLoansAndLeasesHeldInPortfolio",
    "InterestIncomeExpenseAfterProvisionForLoanLoss",
  ],
  interest_expense: [
    "InterestExpense",
    "InterestExpenseOperating",
    "InterestExpenseDeposits",
  ],
  noninterest_income: [
    "NoninterestIncome",
    "NoninterestIncomeOtherOperatingIncome",
  ],
  operating_cash_flow: [
    "NetCashProvidedByUsedInOperatingActivities",
  ],
  provision_for_losses: [
    "ProvisionForLoanAndLeaseLosses",
    "ProvisionForLoanLossesExpensed",
    "ProvisionForLoanLeaseAndOtherLosses",
  ],
};

export function parseFinancialMetrics(facts: EdgarCompanyFacts): ParsedMetric[] {
  const usGaap = facts.facts["us-gaap"];
  if (!usGaap) return [];

  const rawMetrics: ParsedMetric[] = [];

  for (const [metricName, possibleTags] of Object.entries(METRIC_TAG_MAP)) {
    for (const tag of possibleTags) {
      const concept = usGaap[tag];
      if (!concept) continue;

      const values = concept.units["USD"];
      if (!values || values.length === 0) continue;

      for (const val of values) {
        // Only 10-K and 10-Q
        if (val.form !== "10-K" && val.form !== "10-Q") continue;
        // Filter to 2018+
        if (val.fy && val.fy < 2018) continue;

        rawMetrics.push({
          metricName,
          xbrlTag: tag,
          value: val.val,
          unit: "USD",
          periodStart: val.start ? new Date(val.start) : null,
          periodEnd: new Date(val.end),
          fiscalYear: val.fy || null,
          fiscalPeriod: val.fp || null,
          formType: val.form,
          filed: val.filed ? new Date(val.filed) : null,
        });
      }

      break; // Use first matching tag only
    }
  }

  // Compute derived ratios
  const derived = computeDerivedRatios(rawMetrics);
  rawMetrics.push(...derived);

  return rawMetrics;
}

// ─── Derived Ratio Computation ──────────────────────────────────────────────

interface PeriodGroup {
  periodEnd: Date;
  periodStart: Date | null;
  fiscalYear: number | null;
  fiscalPeriod: string | null;
  formType: string;
  filed: Date | null;
  metrics: Map<string, number>;
}

function computeDerivedRatios(metrics: ParsedMetric[]): ParsedMetric[] {
  // Group metrics by (periodEnd + formType)
  const groups = new Map<string, PeriodGroup>();

  for (const m of metrics) {
    const key = `${m.periodEnd.toISOString()}|${m.formType}`;
    if (!groups.has(key)) {
      groups.set(key, {
        periodEnd: m.periodEnd,
        periodStart: m.periodStart,
        fiscalYear: m.fiscalYear,
        fiscalPeriod: m.fiscalPeriod,
        formType: m.formType,
        filed: m.filed,
        metrics: new Map(),
      });
    }
    // Keep the first value for each metric name in the group
    if (!groups.get(key)!.metrics.has(m.metricName)) {
      groups.get(key)!.metrics.set(m.metricName, m.value);
    }
  }

  const derived: ParsedMetric[] = [];

  for (const group of groups.values()) {
    const nep = group.metrics.get("nep");
    const losses = group.metrics.get("incurred_losses");
    const expenses = group.metrics.get("underwriting_expenses");

    if (!nep || nep <= 0) continue;

    if (losses !== undefined) {
      derived.push({
        metricName: "loss_ratio",
        xbrlTag: "derived",
        value: losses / nep,
        unit: "ratio",
        periodStart: group.periodStart,
        periodEnd: group.periodEnd,
        fiscalYear: group.fiscalYear,
        fiscalPeriod: group.fiscalPeriod,
        formType: group.formType,
        filed: group.filed,
      });
    }

    if (expenses !== undefined) {
      derived.push({
        metricName: "expense_ratio",
        xbrlTag: "derived",
        value: expenses / nep,
        unit: "ratio",
        periodStart: group.periodStart,
        periodEnd: group.periodEnd,
        fiscalYear: group.fiscalYear,
        fiscalPeriod: group.fiscalPeriod,
        formType: group.formType,
        filed: group.filed,
      });
    }

    if (losses !== undefined && expenses !== undefined) {
      derived.push({
        metricName: "combined_ratio",
        xbrlTag: "derived",
        value: (losses + expenses) / nep,
        unit: "ratio",
        periodStart: group.periodStart,
        periodEnd: group.periodEnd,
        fiscalYear: group.fiscalYear,
        fiscalPeriod: group.fiscalPeriod,
        formType: group.formType,
        filed: group.filed,
      });
    }
  }

  return derived;
}

// ─── Main Sync Orchestrator ─────────────────────────────────────────────────

export async function syncCarrierEdgarData(cik: string) {
  const [submissions, facts] = await Promise.all([
    fetchSubmissions(cik),
    fetchCompanyFacts(cik),
  ]);

  const parsedFilings = parseFilings(submissions);
  const parsedMetrics = parseFinancialMetrics(facts);

  return { parsedFilings, parsedMetrics };
}
