"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  DollarSign,
  Percent,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CategoryCycle {
  category: string;
  label: string;
  position: "soft" | "firming" | "hard" | "softening";
  latestCR: number | null;
  crDirection: number;
  premiumGrowthRate: number | null;
  carriersWithData: number;
}

interface TrendPoint {
  year: number;
  avgCR: number | null;
  avgNWPGrowth: number | null;
  crMomentum: number | null;
  premiumAcceleration: number | null;
  carriersWithCR: number;
}

interface YearAheadOutlook {
  overallDirection: "hardening" | "softening" | "stable";
  confidence: "high" | "medium" | "low";
  signals: string[];
  byCategory: Array<{
    category: string;
    label: string;
    prediction: string;
    rationale: string;
  }>;
}

interface CarrierInvestmentProfile {
  carrierId: string;
  name: string;
  ticker: string | null;
  category: string;
  underwritingResult: number;
  investmentIncome: number;
  netIncome: number;
  dependencyRatio: number | null;
  isProppedUp: boolean;
  year: number;
}

interface ScatterPoint {
  name: string;
  ticker: string | null;
  x: number;
  y: number;
  category: string;
}

interface OverlayPoint {
  year: number;
  reinsurerAvgCR: number;
  primaryNWPGrowthNextYear: number | null;
  reinsurerCount: number;
}

interface CommentaryEntry {
  id: string;
  title: string;
  content: string;
  sentiment: string;
  quarter: number;
  year: number;
  carrierName: string;
  sourceDate: string;
}

interface PredictiveData {
  rateCycle: {
    cyclePositionByCategory: CategoryCycle[];
    industryTrend: TrendPoint[];
    yearAheadOutlook: YearAheadOutlook;
    promptTemplate: string;
  };
  investmentDependency: {
    carrierProfiles: CarrierInvestmentProfile[];
    scatterData: ScatterPoint[];
    industryTrend: Array<{
      year: number;
      totalUnderwriting: number;
      totalInvestment: number;
      carriersWithData: number;
    }>;
    latestYear: number;
  };
  reinsurancePassThrough: {
    overlayData: OverlayPoint[];
    cededPremiumTrend: Array<{
      year: number;
      avgCededRatio: number;
      carriersWithData: number;
    }>;
    commentary: CommentaryEntry[];
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

const CYCLE_COLORS: Record<string, string> = {
  soft: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  firming: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  hard: "bg-red-500/20 text-red-400 border-red-500/40",
  softening: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
};

const CYCLE_BG: Record<string, string> = {
  soft: "bg-blue-500",
  firming: "bg-amber-500",
  hard: "bg-red-500",
  softening: "bg-emerald-500",
};

const CATEGORY_SCATTER_COLORS: Record<string, string> = {
  us_pc: "#60a5fa",
  global: "#34d399",
  reinsurer: "#a78bfa",
  auto_dealer_niche: "#f59e0b",
};

const CATEGORY_LABELS: Record<string, string> = {
  us_pc: "US P&C",
  global: "Global",
  reinsurer: "Reinsurer",
  auto_dealer_niche: "Auto Dealer",
};

const DIRECTION_BADGES: Record<string, { color: string; icon: typeof TrendingUp }> = {
  hardening: { color: "bg-red-500/15 text-red-400 border-red-500/20", icon: TrendingUp },
  softening: { color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", icon: TrendingDown },
  stable: { color: "bg-amber-500/15 text-amber-400 border-amber-500/20", icon: Minus },
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  low: "bg-muted text-muted-foreground border-border",
};

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--foreground))",
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function PredictivePage() {
  const [data, setData] = useState<PredictiveData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/predictive");
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        setData(json);
      } catch {
        toast.error("Failed to load predictive intelligence data");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  async function handleCopyPrompt() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.rateCycle.promptTemplate);
      setCopied(true);
      toast.success("Prompt copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy prompt");
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        <Brain className="mr-2 h-5 w-5 animate-pulse" />
        Computing predictive intelligence...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <Brain className="h-10 w-10 text-muted-foreground/50" />
        <div>
          <h3 className="font-semibold">No Data Available</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Sync EDGAR data for carriers to generate predictive insights.
          </p>
        </div>
      </div>
    );
  }

  const { rateCycle, investmentDependency, reinsurancePassThrough } = data;
  const latestTrend = rateCycle.industryTrend.filter((t) => t.avgCR !== null);
  const latestPoint = latestTrend.length > 0 ? latestTrend[latestTrend.length - 1] : null;
  const proppedUpCount = investmentDependency.carrierProfiles.filter((c) => c.isProppedUp).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Predictive Intelligence</h1>
        <p className="mt-1 text-muted-foreground">
          Data-driven market predictions and hidden competitive signals from SEC EDGAR filings.
        </p>
      </div>

      <Tabs defaultValue="rate-cycle" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="rate-cycle">Rate Cycle</TabsTrigger>
          <TabsTrigger value="investment">Investment Dependency</TabsTrigger>
          <TabsTrigger value="reinsurance">Reinsurance Pass-Through</TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 1: Rate Cycle Predictor                                    */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="rate-cycle" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Industry Avg CR
                </CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    "text-3xl font-bold tabular-nums",
                    latestPoint && latestPoint.avgCR! < 100
                      ? "text-emerald-400"
                      : "text-red-400"
                  )}
                >
                  {latestPoint?.avgCR ?? "N/A"}%
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  FY {latestPoint?.year ?? "—"} ({latestPoint?.carriersWithCR ?? 0} carriers)
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Premium Growth
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">
                  {latestPoint?.avgNWPGrowth !== null && latestPoint?.avgNWPGrowth !== undefined
                    ? `${latestPoint.avgNWPGrowth > 0 ? "+" : ""}${latestPoint.avgNWPGrowth}%`
                    : "N/A"}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Avg NWP growth rate
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  CR Momentum
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-3xl font-bold tabular-nums",
                      latestPoint?.crMomentum !== null && latestPoint?.crMomentum !== undefined
                        ? latestPoint.crMomentum > 0
                          ? "text-red-400"
                          : "text-emerald-400"
                        : ""
                    )}
                  >
                    {latestPoint?.crMomentum !== null && latestPoint?.crMomentum !== undefined
                      ? `${latestPoint.crMomentum > 0 ? "+" : ""}${latestPoint.crMomentum.toFixed(1)}`
                      : "N/A"}
                  </span>
                  {latestPoint?.crMomentum !== null && latestPoint?.crMomentum !== undefined && (
                    latestPoint.crMomentum > 0 ? (
                      <ArrowUpRight className="h-5 w-5 text-red-400" />
                    ) : (
                      <ArrowDownRight className="h-5 w-5 text-emerald-400" />
                    )
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  YoY change in pts
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Outlook
                </CardTitle>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      DIRECTION_BADGES[rateCycle.yearAheadOutlook.overallDirection]?.color ?? ""
                    }
                  >
                    {rateCycle.yearAheadOutlook.overallDirection.toUpperCase()}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Confidence:{" "}
                  <Badge
                    variant="outline"
                    className={
                      CONFIDENCE_COLORS[rateCycle.yearAheadOutlook.confidence] ?? ""
                    }
                  >
                    {rateCycle.yearAheadOutlook.confidence}
                  </Badge>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cycle Position by Category */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {rateCycle.cyclePositionByCategory.map((cycle) => (
              <Card key={cycle.category} className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{cycle.label}</CardTitle>
                  <CardDescription>
                    {cycle.carriersWithData} carrier{cycle.carriersWithData !== 1 ? "s" : ""} with data
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Cycle bar */}
                  <div className="flex gap-1">
                    {(["soft", "firming", "hard", "softening"] as const).map(
                      (phase) => (
                        <div
                          key={phase}
                          className={cn(
                            "h-3 flex-1 rounded-sm transition-all",
                            cycle.position === phase
                              ? CYCLE_BG[phase]
                              : "bg-muted"
                          )}
                        />
                      )
                    )}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Soft</span>
                    <span>Firming</span>
                    <span>Hard</span>
                    <span>Softening</span>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">CR</span>
                      <p
                        className={cn(
                          "font-semibold",
                          cycle.latestCR !== null && cycle.latestCR < 100
                            ? "text-emerald-400"
                            : "text-red-400"
                        )}
                      >
                        {cycle.latestCR ?? "N/A"}%
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Direction</span>
                      <p
                        className={cn(
                          "font-semibold",
                          cycle.crDirection > 0 ? "text-red-400" : "text-emerald-400"
                        )}
                      >
                        {cycle.crDirection > 0 ? "+" : ""}
                        {cycle.crDirection.toFixed(1)} pts
                      </p>
                    </div>
                  </div>

                  <Badge variant="outline" className={CYCLE_COLORS[cycle.position]}>
                    {cycle.position.charAt(0).toUpperCase() + cycle.position.slice(1)} Market
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* CR Trend */}
            {latestTrend.length > 1 && (
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-base">
                    Combined Ratio Trend (Industry Avg)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={latestTrend}
                      margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                      <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} domain={["auto", "auto"]} />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`${value}%`, undefined]} />
                      <Legend />
                      <ReferenceLine y={100} stroke="#f87171" strokeDasharray="6 3" label={{ value: "100%", position: "right", fill: "#f87171", fontSize: 11 }} />
                      <Line type="monotone" dataKey="avgCR" name="Avg Combined Ratio" stroke="#60a5fa" strokeWidth={2} dot={{ fill: "#60a5fa", r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Premium Growth Trend */}
            {(() => {
              const growthData = rateCycle.industryTrend.filter(
                (t) => t.avgNWPGrowth !== null
              );
              return growthData.length > 1 ? (
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="text-base">
                      Premium Growth Rate (Industry Avg)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={growthData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                        <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                        <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`${value}%`, undefined]} />
                        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                        <Bar dataKey="avgNWPGrowth" name="NWP Growth %" fill="#34d399" radius={[4, 4, 0, 0]}>
                          {growthData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                (entry.avgNWPGrowth ?? 0) >= 0 ? "#34d399" : "#f87171"
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              ) : null;
            })()}
          </div>

          {/* Year-Ahead Outlook */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="h-5 w-5 text-primary" />
                Year-Ahead Outlook
              </CardTitle>
              <CardDescription>
                Algorithmic assessment based on financial trends across{" "}
                {latestPoint?.carriersWithCR ?? 0} SEC-reporting carriers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-sm px-3 py-1",
                    DIRECTION_BADGES[rateCycle.yearAheadOutlook.overallDirection]
                      ?.color ?? ""
                  )}
                >
                  Market {rateCycle.yearAheadOutlook.overallDirection}
                </Badge>
                <Badge
                  variant="outline"
                  className={CONFIDENCE_COLORS[rateCycle.yearAheadOutlook.confidence]}
                >
                  {rateCycle.yearAheadOutlook.confidence} confidence
                </Badge>
              </div>

              {/* Signals */}
              {rateCycle.yearAheadOutlook.signals.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Key Signals:</p>
                  <ul className="space-y-1.5">
                    {rateCycle.yearAheadOutlook.signals.map((signal, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                        {signal}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Per-category outlook */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {rateCycle.yearAheadOutlook.byCategory.map((cat) => (
                  <div
                    key={cat.category}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{cat.label}</span>
                      <Badge
                        variant="outline"
                        className={
                          DIRECTION_BADGES[cat.prediction]?.color ??
                          "bg-muted text-muted-foreground"
                        }
                      >
                        {cat.prediction}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {cat.rationale}
                    </p>
                  </div>
                ))}
              </div>

              {/* AI Prompt Section */}
              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPrompt(!showPrompt)}
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    {showPrompt ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {showPrompt ? "Hide" : "Show"} AI Prompt
                  </button>
                  <button
                    onClick={handleCopyPrompt}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied!" : "Copy Prompt"}
                  </button>
                </div>
                {showPrompt && (
                  <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-muted p-4 text-xs text-muted-foreground whitespace-pre-wrap">
                    {data.rateCycle.promptTemplate}
                  </pre>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 2: Investment Dependency                                    */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="investment" className="space-y-6">
          {/* Highlight Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Carriers Analyzed
                </CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">
                  {investmentDependency.carrierProfiles.length}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  FY {investmentDependency.latestYear}
                </p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                "border-border bg-card",
                proppedUpCount > 0 && "border-amber-500/30"
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Propped Up by Investments
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    "text-3xl font-bold tabular-nums",
                    proppedUpCount > 0 ? "text-amber-400" : "text-emerald-400"
                  )}
                >
                  {proppedUpCount}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Unprofitable underwriting, profitable net income
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg Dependency Ratio
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {(() => {
                  const withRatio = investmentDependency.carrierProfiles.filter(
                    (c) => c.dependencyRatio !== null
                  );
                  const avg =
                    withRatio.length > 0
                      ? withRatio.reduce(
                          (s, c) => s + (c.dependencyRatio ?? 0),
                          0
                        ) / withRatio.length
                      : null;
                  return (
                    <>
                      <div className="text-3xl font-bold tabular-nums">
                        {avg !== null ? `${(avg * 100).toFixed(0)}%` : "N/A"}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Investment income / net income
                      </p>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* Scatter Chart */}
          {investmentDependency.scatterData.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">
                  Underwriting Result vs Investment Income ($B)
                </CardTitle>
                <CardDescription>
                  Top-left quadrant: carriers relying on investment income to cover underwriting losses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <ScatterChart margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="Underwriting Result"
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `$${v}B`}
                      label={{ value: "Underwriting Result ($B)", position: "bottom", offset: 0, style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 } }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name="Investment Income"
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `$${v}B`}
                      label={{ value: "Investment Income ($B)", angle: -90, position: "insideLeft", style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 } }}
                    />
                    <ZAxis range={[60, 200]} />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value, name) => [
                        `$${value}B`,
                        name === "x" ? "Underwriting" : "Investment",
                      ]}
                      labelFormatter={() => ""}
                      cursor={{ strokeDasharray: "3 3" }}
                    />
                    <ReferenceLine x={0} stroke="#f87171" strokeDasharray="6 3" />
                    <Scatter data={investmentDependency.scatterData} name="Carriers">
                      {investmentDependency.scatterData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CATEGORY_SCATTER_COLORS[entry.category] ?? "#60a5fa"}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="mt-2 flex flex-wrap gap-4 justify-center">
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: CATEGORY_SCATTER_COLORS[key] }}
                      />
                      {label}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dependency Table */}
          {investmentDependency.carrierProfiles.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">
                  Investment Dependency Ranking (FY {investmentDependency.latestYear})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">#</TableHead>
                      <TableHead className="text-muted-foreground">Carrier</TableHead>
                      <TableHead className="text-muted-foreground">Category</TableHead>
                      <TableHead className="text-right text-muted-foreground">
                        Underwriting
                      </TableHead>
                      <TableHead className="text-right text-muted-foreground">
                        Investment
                      </TableHead>
                      <TableHead className="text-right text-muted-foreground">
                        Net Income
                      </TableHead>
                      <TableHead className="text-right text-muted-foreground">
                        Dep. Ratio
                      </TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {investmentDependency.carrierProfiles.map((carrier, i) => (
                      <TableRow key={carrier.carrierId} className="border-border">
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">
                          {carrier.name}
                          {carrier.ticker && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({carrier.ticker})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {CATEGORY_LABELS[carrier.category] ?? carrier.category}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            carrier.underwritingResult >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          )}
                        >
                          {formatCurrency(carrier.underwritingResult)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(carrier.investmentIncome)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            carrier.netIncome >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          )}
                        >
                          {formatCurrency(carrier.netIncome)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {carrier.dependencyRatio !== null
                            ? `${(carrier.dependencyRatio * 100).toFixed(0)}%`
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          {carrier.isProppedUp && (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/15 text-amber-400 border-amber-500/20"
                            >
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Propped Up
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Industry Trend */}
          {investmentDependency.industryTrend.length > 1 && (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">
                  Industry: Underwriting vs Investment Income ($B)
                </CardTitle>
                <CardDescription>
                  Widening gap signals increasing reliance on investment returns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={investmentDependency.industryTrend}
                    margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                    <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}B`} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`$${value}B`, undefined]} />
                    <Legend />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="totalUnderwriting" name="Underwriting Result" stroke="#60a5fa" strokeWidth={2} dot={{ fill: "#60a5fa", r: 4 }} />
                    <Line type="monotone" dataKey="totalInvestment" name="Investment Income" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 3: Reinsurance Pass-Through                                */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="reinsurance" className="space-y-6">
          {/* Overlay Chart */}
          {reinsurancePassThrough.overlayData.length > 1 && (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">
                  Reinsurer Pain → Primary Rate Response (1-Year Lag)
                </CardTitle>
                <CardDescription>
                  When reinsurer CRs spike, primary carrier premium growth
                  accelerates the following year
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart
                    data={reinsurancePassThrough.overlayData}
                    margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                    <YAxis
                      yAxisId="left"
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `${v}%`}
                      label={{ value: "Reinsurer CR (%)", angle: -90, position: "insideLeft", style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 } }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `${v}%`}
                      label={{ value: "Primary NWP Growth (next yr)", angle: 90, position: "insideRight", style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 } }}
                    />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Legend />
                    <ReferenceLine yAxisId="left" y={100} stroke="#f87171" strokeDasharray="6 3" />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="reinsurerAvgCR"
                      name="Reinsurer Avg CR (%)"
                      stroke="#a78bfa"
                      strokeWidth={2}
                      dot={{ fill: "#a78bfa", r: 4 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="primaryNWPGrowthNextYear"
                      name="Primary NWP Growth +1yr (%)"
                      stroke="#34d399"
                      strokeWidth={2}
                      dot={{ fill: "#34d399", r: 4 }}
                      strokeDasharray="4 4"
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
                <p className="mt-2 text-xs text-muted-foreground text-center">
                  Based on {reinsurancePassThrough.overlayData[0]?.reinsurerCount ?? 0} SEC-reporting reinsurers
                </p>
              </CardContent>
            </Card>
          )}

          {/* Ceded Premium Ratio */}
          {reinsurancePassThrough.cededPremiumTrend.length > 1 && (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">
                  Ceded Premium Ratio Trend
                </CardTitle>
                <CardDescription>
                  Percentage of gross premiums ceded to reinsurers — rising ratio
                  signals increased reinsurance dependency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={reinsurancePassThrough.cededPremiumTrend}
                    margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                    <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`${value}%`, undefined]} />
                    <Line type="monotone" dataKey="avgCededRatio" name="Avg Ceded Ratio" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
                <p className="mt-2 text-xs text-muted-foreground text-center">
                  Based on {reinsurancePassThrough.cededPremiumTrend[0]?.carriersWithData ?? 0} carriers with both GWP and NWP data
                </p>
              </CardContent>
            </Card>
          )}

          {/* Commentary Feed */}
          {reinsurancePassThrough.commentary.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">
                  Reinsurance Commentary Feed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reinsurancePassThrough.commentary.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 rounded-lg border border-border p-3"
                    >
                      <div
                        className={cn(
                          "mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full",
                          entry.sentiment === "positive"
                            ? "bg-emerald-400"
                            : entry.sentiment === "negative"
                            ? "bg-red-400"
                            : "bg-amber-400"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">
                            {entry.title}
                          </p>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            Q{entry.quarter} {entry.year}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {entry.carrierName}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {entry.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {reinsurancePassThrough.commentary.length === 0 &&
            reinsurancePassThrough.overlayData.length <= 1 &&
            reinsurancePassThrough.cededPremiumTrend.length <= 1 && (
              <Card className="border-border bg-card">
                <CardContent className="flex h-64 flex-col items-center justify-center gap-3 text-center">
                  <Eye className="h-10 w-10 text-muted-foreground/50" />
                  <div>
                    <h3 className="font-semibold">Limited Reinsurance Data</h3>
                    <p className="mt-1 text-sm text-muted-foreground max-w-md">
                      Add commentary entries with the &quot;Reinsurance&quot; category and sync more
                      carrier EDGAR data to populate this analysis.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
