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
  BarChart3,
  Trophy,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Users,
  PieChart,
  Gauge,
  Crown,
  Medal,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PeerScorecard {
  carrierId: string;
  name: string;
  ticker: string | null;
  category: string;
  categoryLabel: string;
  metrics: {
    combinedRatio: number | null;
    nwpGrowth: number | null;
    netIncomeMargin: number | null;
    expenseRatio: number | null;
    investmentYield: number | null;
  };
  ranks: {
    combinedRatio: number | null;
    nwpGrowth: number | null;
    netIncomeMargin: number | null;
    expenseRatio: number | null;
    investmentYield: number | null;
  };
  compositeRank: number;
  compositeScore: number;
  peerGroupSize: number;
  metricsAvailable: number;
}

interface ShareChange {
  carrierId: string;
  name: string;
  ticker: string | null;
  category: string;
  categoryLabel: string;
  latestShare: number;
  previousShare: number;
  change: number;
}

interface QuartilePoint {
  year: number;
  p25: number;
  median: number;
  p75: number;
  carrierCount: number;
}

interface EfficiencyEntry {
  carrierId: string;
  name: string;
  ticker: string | null;
  category: string;
  categoryLabel: string;
  expenseRatio: number | null;
  lossRatio: number | null;
  combinedRatio: number | null;
  quartile: number | null;
  trend: Array<{ year: number; expenseRatio: number | null }>;
}

interface BenchmarkingData {
  latestYear: number;
  previousYear: number | null;
  peerScoring: {
    scorecards: PeerScorecard[];
    categories: Array<{ key: string; label: string; count: number }>;
  };
  marketShare: {
    byYear: Array<{
      year: number;
      category: string;
      categoryLabel: string;
      carriers: Array<{
        carrierId: string;
        name: string;
        ticker: string | null;
        nwp: number;
        marketShare: number;
      }>;
    }>;
    shareChanges: ShareChange[];
    stackedShareData: Record<string, Array<Record<string, number | string>>>;
    carrierNamesByCategory: Record<string, string[]>;
  };
  expenseBenchmark: {
    quartilesByYear: QuartilePoint[];
    efficiencyEntries: EfficiencyEntry[];
    industryMedianER: number | null;
    bestCarrier: { name: string; expenseRatio: number | null } | null;
    worstCarrier: { name: string; expenseRatio: number | null } | null;
    carrierCount: number;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

const CHART_COLORS = [
  "#60a5fa",
  "#f59e0b",
  "#a78bfa",
  "#34d399",
  "#f87171",
  "#fb923c",
  "#38bdf8",
  "#e879f9",
  "#94a3b8",
];

const QUARTILE_COLORS: Record<number, string> = {
  1: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  2: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  3: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  4: "bg-red-500/15 text-red-400 border-red-500/20",
};

const QUARTILE_LABELS: Record<number, string> = {
  1: "Top Quartile",
  2: "2nd Quartile",
  3: "3rd Quartile",
  4: "Bottom Quartile",
};

type SortField =
  | "compositeRank"
  | "combinedRatio"
  | "nwpGrowth"
  | "netIncomeMargin"
  | "expenseRatio";

// ─── Component ──────────────────────────────────────────────────────────────

export default function BenchmarkingPage() {
  const [data, setData] = useState<BenchmarkingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("compositeRank");
  const [sortAsc, setSortAsc] = useState(true);
  const [shareCategory, setShareCategory] = useState<string>("");

  useEffect(() => {
    fetch("/api/benchmarking")
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        // Default share category to first available
        if (json.peerScoring?.categories?.length > 0) {
          setShareCategory(json.peerScoring.categories[0].key);
        }
      })
      .catch(() => toast.error("Failed to load benchmarking data"))
      .finally(() => setLoading(false));
  }, []);

  // ─── Filtered & sorted scorecards ───────────────────────────────────

  const filteredScorecards = useMemo(() => {
    if (!data) return [];
    let cards = [...data.peerScoring.scorecards];

    if (activeCategory !== "all") {
      cards = cards.filter((c) => c.category === activeCategory);
    }

    cards.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      switch (sortField) {
        case "compositeRank":
          aVal = a.compositeScore;
          bVal = b.compositeScore;
          break;
        case "combinedRatio":
          aVal = a.metrics.combinedRatio ?? 999;
          bVal = b.metrics.combinedRatio ?? 999;
          break;
        case "nwpGrowth":
          aVal = a.metrics.nwpGrowth ?? -999;
          bVal = b.metrics.nwpGrowth ?? -999;
          return sortAsc ? bVal - aVal : aVal - bVal; // higher is better
        case "netIncomeMargin":
          aVal = a.metrics.netIncomeMargin ?? -999;
          bVal = b.metrics.netIncomeMargin ?? -999;
          return sortAsc ? bVal - aVal : aVal - bVal;
        case "expenseRatio":
          aVal = a.metrics.expenseRatio ?? 999;
          bVal = b.metrics.expenseRatio ?? 999;
          break;
        default:
          aVal = a.compositeScore;
          bVal = b.compositeScore;
      }

      return sortAsc ? aVal - bVal : bVal - aVal;
    });

    return cards;
  }, [data, activeCategory, sortField, sortAsc]);

  // ─── Share chart data ─────────────────────────────────────────────

  const shareChartData = useMemo(() => {
    if (!data || !shareCategory) return { data: [], keys: [] };
    return {
      data: data.marketShare.stackedShareData[shareCategory] ?? [],
      keys: data.marketShare.carrierNamesByCategory[shareCategory] ?? [],
    };
  }, [data, shareCategory]);

  const filteredShareChanges = useMemo(() => {
    if (!data) return [];
    if (!shareCategory) return data.marketShare.shareChanges;
    return data.marketShare.shareChanges.filter(
      (s) => s.category === shareCategory
    );
  }, [data, shareCategory]);

  // ─── Sort handler ────────────────────────────────────────────────

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return null;
    return sortAsc ? (
      <ChevronUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ChevronDown className="ml-1 inline h-3 w-3" />
    );
  }

  // ─── Loading ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading benchmarking data...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        No data available
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          Competitive Benchmarking
        </h1>
        <p className="mt-1 text-muted-foreground">
          Peer group rankings, market share dynamics, and expense efficiency
          analysis across {data.peerScoring.scorecards.length} SEC-reporting
          carriers ({data.latestYear} data)
        </p>
      </div>

      <Tabs defaultValue="peer-scoring" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="peer-scoring" className="gap-2">
            <Trophy className="h-4 w-4" />
            Peer Scoring
          </TabsTrigger>
          <TabsTrigger value="market-share" className="gap-2">
            <PieChart className="h-4 w-4" />
            Market Share
          </TabsTrigger>
          <TabsTrigger value="expense-efficiency" className="gap-2">
            <Gauge className="h-4 w-4" />
            Expense Efficiency
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════
            TAB 1: Peer Group Scoring
            ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="peer-scoring" className="space-y-6">
          {/* Category filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory("all")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                activeCategory === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              All ({data.peerScoring.scorecards.length})
            </button>
            {data.peerScoring.categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  activeCategory === cat.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                {cat.label} ({cat.count})
              </button>
            ))}
          </div>

          {/* Stats summary */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Carriers Scored</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredScorecards.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  with {data.latestYear} financial data
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Peer Groups</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.peerScoring.categories.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  industry segments
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Top Performer</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-400">
                  {filteredScorecards[0]?.ticker ||
                    filteredScorecards[0]?.name?.slice(0, 10) ||
                    "—"}
                </div>
                <p className="text-xs text-muted-foreground">
                  best composite score
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Metrics Tracked</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">5</div>
                <p className="text-xs text-muted-foreground">
                  CR, Growth, Margin, ER, Yield
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-400" />
                Carrier Rankings
              </CardTitle>
              <CardDescription>
                Click column headers to sort. Ranks shown within peer group.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Segment</TableHead>
                      <TableHead
                        className="cursor-pointer hover:text-foreground text-right"
                        onClick={() => handleSort("compositeRank")}
                      >
                        Score <SortIcon field="compositeRank" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:text-foreground text-right"
                        onClick={() => handleSort("combinedRatio")}
                      >
                        CR % <SortIcon field="combinedRatio" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:text-foreground text-right"
                        onClick={() => handleSort("nwpGrowth")}
                      >
                        NWP Growth <SortIcon field="nwpGrowth" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:text-foreground text-right"
                        onClick={() => handleSort("netIncomeMargin")}
                      >
                        NI Margin <SortIcon field="netIncomeMargin" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:text-foreground text-right"
                        onClick={() => handleSort("expenseRatio")}
                      >
                        Expense % <SortIcon field="expenseRatio" />
                      </TableHead>
                      <TableHead className="text-right">
                        Inv Yield
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredScorecards.map((card, idx) => (
                      <TableRow key={card.carrierId}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {idx === 0 && (
                              <Crown className="h-4 w-4 text-amber-400" />
                            )}
                            {idx === 1 && (
                              <Medal className="h-4 w-4 text-gray-400" />
                            )}
                            {idx === 2 && (
                              <Medal className="h-4 w-4 text-amber-700" />
                            )}
                            {idx > 2 && (
                              <span className="text-muted-foreground">
                                {idx + 1}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>
                            {card.name}
                            {card.ticker && (
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                ({card.ticker})
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {card.categoryLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono font-semibold">
                            {card.compositeScore.toFixed(1)}
                          </span>
                          <span className="ml-1 text-xs text-muted-foreground">
                            /{card.peerGroupSize}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <MetricCell
                            value={card.metrics.combinedRatio}
                            rank={card.ranks.combinedRatio}
                            total={card.peerGroupSize}
                            suffix="%"
                            lowerIsBetter
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <MetricCell
                            value={card.metrics.nwpGrowth}
                            rank={card.ranks.nwpGrowth}
                            total={card.peerGroupSize}
                            suffix="%"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <MetricCell
                            value={card.metrics.netIncomeMargin}
                            rank={card.ranks.netIncomeMargin}
                            total={card.peerGroupSize}
                            suffix="%"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <MetricCell
                            value={card.metrics.expenseRatio}
                            rank={card.ranks.expenseRatio}
                            total={card.peerGroupSize}
                            suffix="%"
                            lowerIsBetter
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <MetricCell
                            value={card.metrics.investmentYield}
                            rank={card.ranks.investmentYield}
                            total={card.peerGroupSize}
                            suffix="%"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Composite score = average rank across available metrics (lower
                is better). Peer group size shown after score.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════
            TAB 2: Market Share
            ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="market-share" className="space-y-6">
          {/* Category selector */}
          <div className="flex flex-wrap gap-2">
            {data.peerScoring.categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setShareCategory(cat.key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  shareCategory === cat.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Carriers in Segment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {shareChartData.keys.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  among SEC-reporting carriers
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Biggest Gainer</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const gainer = filteredShareChanges.find(
                    (s) => s.change > 0
                  );
                  return gainer ? (
                    <>
                      <div className="text-2xl font-bold text-emerald-400">
                        {gainer.ticker || gainer.name.slice(0, 12)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        +{gainer.change}pp share gain
                      </p>
                    </>
                  ) : (
                    <div className="text-2xl font-bold text-muted-foreground">
                      —
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Biggest Loser</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const loser = [...filteredShareChanges]
                    .reverse()
                    .find((s) => s.change < 0);
                  return loser ? (
                    <>
                      <div className="text-2xl font-bold text-red-400">
                        {loser.ticker || loser.name.slice(0, 12)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {loser.change}pp share loss
                      </p>
                    </>
                  ) : (
                    <div className="text-2xl font-bold text-muted-foreground">
                      —
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* Stacked Area Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-blue-400" />
                Market Share Over Time
              </CardTitle>
              <CardDescription>
                NWP share among SEC-reporting carriers in this segment (top 8 +
                Other)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shareChartData.data.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={shareChartData.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis
                      tickFormatter={(v: number) => `${v}%`}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number | undefined) => `${value ?? 0}%`}
                    />
                    <Legend />
                    {shareChartData.keys.map((name, idx) => (
                      <Area
                        key={name}
                        type="monotone"
                        dataKey={name}
                        stackId="1"
                        fill={CHART_COLORS[idx % CHART_COLORS.length]}
                        stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                        fillOpacity={0.6}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-10 text-center text-muted-foreground">
                  No NWP data available for this segment
                </p>
              )}
            </CardContent>
          </Card>

          {/* Share Movers Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                Share Movers ({data.previousYear} &rarr; {data.latestYear})
              </CardTitle>
              <CardDescription>
                Carriers ranked by absolute change in NWP market share
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Segment</TableHead>
                    <TableHead className="text-right">
                      {data.previousYear} Share
                    </TableHead>
                    <TableHead className="text-right">
                      {data.latestYear} Share
                    </TableHead>
                    <TableHead className="text-right">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShareChanges.slice(0, 15).map((sc) => (
                    <TableRow key={sc.carrierId}>
                      <TableCell className="font-medium">
                        {sc.name}
                        {sc.ticker && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            ({sc.ticker})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {sc.categoryLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {sc.previousShare.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {sc.latestShare.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "inline-flex items-center gap-0.5 font-mono font-semibold",
                            sc.change > 0
                              ? "text-emerald-400"
                              : sc.change < 0
                              ? "text-red-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {sc.change > 0 ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : sc.change < 0 ? (
                            <ArrowDownRight className="h-3.5 w-3.5" />
                          ) : (
                            <Minus className="h-3.5 w-3.5" />
                          )}
                          {sc.change > 0 ? "+" : ""}
                          {sc.change.toFixed(1)}pp
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════
            TAB 3: Expense Efficiency
            ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="expense-efficiency" className="space-y-6">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Industry Median ER</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.expenseBenchmark.industryMedianER !== null
                    ? `${data.expenseBenchmark.industryMedianER}%`
                    : "—"}
                </div>
                <p className="text-xs text-muted-foreground">
                  across {data.expenseBenchmark.carrierCount} carriers
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Most Efficient</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-400">
                  {data.expenseBenchmark.bestCarrier?.name?.slice(0, 15) ||
                    "—"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.expenseBenchmark.bestCarrier?.expenseRatio !== null
                    ? `${data.expenseBenchmark.bestCarrier?.expenseRatio}% expense ratio`
                    : ""}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Least Efficient</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-400">
                  {data.expenseBenchmark.worstCarrier?.name?.slice(0, 15) ||
                    "—"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.expenseBenchmark.worstCarrier?.expenseRatio !== null
                    ? `${data.expenseBenchmark.worstCarrier?.expenseRatio}% expense ratio`
                    : ""}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Carriers Ranked</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.expenseBenchmark.carrierCount}
                </div>
                <p className="text-xs text-muted-foreground">
                  with expense data
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quartile Band Chart */}
          {data.expenseBenchmark.quartilesByYear.length >= 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-amber-400" />
                  Expense Ratio Distribution Over Time
                </CardTitle>
                <CardDescription>
                  Shaded band shows 25th-75th percentile range. Line shows
                  industry median.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.expenseBenchmark.quartilesByYear}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis
                      tickFormatter={(v: number) => `${v}%`}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number | undefined, name: string | undefined) => [
                        `${value ?? 0}%`,
                        name === "p25"
                          ? "25th Pctl"
                          : name === "median"
                          ? "Median"
                          : "75th Pctl",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="p75"
                      stackId="band"
                      fill="transparent"
                      stroke="transparent"
                    />
                    <Area
                      type="monotone"
                      dataKey="p25"
                      stackId="band"
                      fill="#60a5fa"
                      fillOpacity={0.15}
                      stroke="transparent"
                    />
                    <Line
                      type="monotone"
                      dataKey="median"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ fill: "#f59e0b", r: 4 }}
                      name="Median"
                    />
                    <Line
                      type="monotone"
                      dataKey="p25"
                      stroke="#34d399"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      dot={false}
                      name="25th Pctl"
                    />
                    <Line
                      type="monotone"
                      dataKey="p75"
                      stroke="#f87171"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      dot={false}
                      name="75th Pctl"
                    />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Efficiency Ranking Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-400" />
                Efficiency Rankings ({data.latestYear})
              </CardTitle>
              <CardDescription>
                Carriers ranked by expense ratio with quartile classifications
                and historical trend
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Segment</TableHead>
                      <TableHead className="text-right">
                        Expense %
                      </TableHead>
                      <TableHead className="text-right">Loss %</TableHead>
                      <TableHead className="text-right">CR %</TableHead>
                      <TableHead>Quartile</TableHead>
                      <TableHead className="text-right">Trend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.expenseBenchmark.efficiencyEntries.map(
                      (entry, idx) => (
                        <TableRow key={entry.carrierId}>
                          <TableCell className="font-mono text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            {entry.name}
                            {entry.ticker && (
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                ({entry.ticker})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {entry.categoryLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {entry.expenseRatio !== null
                              ? `${entry.expenseRatio}%`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {entry.lossRatio !== null
                              ? `${entry.lossRatio}%`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {entry.combinedRatio !== null
                              ? `${entry.combinedRatio}%`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {entry.quartile !== null ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  QUARTILE_COLORS[entry.quartile]
                                )}
                              >
                                Q{entry.quartile}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <TrendSparkline trend={entry.trend} />
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {[1, 2, 3, 4].map((q) => (
                  <div
                    key={q}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <Badge
                      variant="outline"
                      className={cn("text-xs", QUARTILE_COLORS[q])}
                    >
                      Q{q}
                    </Badge>
                    {QUARTILE_LABELS[q]}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function MetricCell({
  value,
  rank,
  total,
  suffix = "",
  lowerIsBetter = false,
}: {
  value: number | null;
  rank: number | null;
  total: number;
  suffix?: string;
  lowerIsBetter?: boolean;
}) {
  if (value === null)
    return <span className="text-muted-foreground">—</span>;

  const isTopHalf =
    rank !== null && rank <= Math.ceil(total / 2);
  const isTop = rank !== null && rank === 1;

  return (
    <div className="flex items-center justify-end gap-1.5">
      <span className="font-mono">
        {value.toFixed(1)}
        {suffix}
      </span>
      {rank !== null && (
        <span
          className={cn(
            "rounded px-1 py-0.5 text-[10px] font-medium",
            isTop
              ? "bg-emerald-500/15 text-emerald-400"
              : isTopHalf
              ? "bg-blue-500/10 text-blue-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          {rank}/{total}
        </span>
      )}
    </div>
  );
}

function TrendSparkline({
  trend,
}: {
  trend: Array<{ year: number; expenseRatio: number | null }>;
}) {
  const validPoints = trend.filter((t) => t.expenseRatio !== null);
  if (validPoints.length < 2) {
    return <span className="text-muted-foreground">—</span>;
  }

  const first = validPoints[0].expenseRatio!;
  const last = validPoints[validPoints.length - 1].expenseRatio!;
  const diff = last - first;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        diff < -1
          ? "text-emerald-400"
          : diff > 1
          ? "text-red-400"
          : "text-muted-foreground"
      )}
    >
      {diff < -0.5 ? (
        <TrendingDown className="h-3 w-3" />
      ) : diff > 0.5 ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <Minus className="h-3 w-3" />
      )}
      {diff > 0 ? "+" : ""}
      {diff.toFixed(1)}pp
    </span>
  );
}
