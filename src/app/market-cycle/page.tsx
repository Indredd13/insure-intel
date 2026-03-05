"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Activity,
  DollarSign,
  Users,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface IndustryTrendPoint {
  year: number;
  avgCombinedRatio: number;
  avgLossRatio: number | null;
  avgExpenseRatio: number | null;
  carriersWithData: number;
}

interface CategoryTrendPoint {
  year: number;
  us_pc: number | null;
  global: number | null;
  reinsurer: number | null;
}

interface PremiumGrowthPoint {
  year: number;
  totalNWP: number;
  yoyGrowthPct: number | null;
}

interface PerformerEntry {
  carrierId: string;
  name: string;
  ticker: string | null;
  combinedRatio: number;
  category: string;
}

interface MarketCycleData {
  industryTrend: IndustryTrendPoint[];
  categoryTrend: CategoryTrendPoint[];
  premiumGrowth: PremiumGrowthPoint[];
  cycleIndicator: {
    direction: "hardening" | "softening" | "stable";
    latestCR: number | null;
    previousCR: number | null;
    changePct: number;
    latestYear: number | null;
    previousYear: number | null;
  };
  topPerformers: PerformerEntry[];
  bottomPerformers: PerformerEntry[];
  stats: {
    avgCombinedRatio: number | null;
    totalNWP: number | null;
    carriersWithData: number;
    yoyPremiumChange: number | null;
    latestYear: number | null;
  };
}

const categoryLabels: Record<string, string> = {
  us_pc: "US P&C",
  global: "Global",
  reinsurer: "Reinsurer",
  auto_dealer_niche: "Auto Dealer",
};

const categoryColors: Record<string, string> = {
  us_pc: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  global: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  reinsurer: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  auto_dealer_niche: "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--foreground))",
};

export default function MarketCyclePage() {
  const [data, setData] = useState<MarketCycleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/market-cycle");
        if (!res.ok) throw new Error("Failed to fetch");
        const result = await res.json();
        setData(result);
      } catch {
        toast.error("Failed to load market cycle data");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        Loading market cycle data...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-center">
        <Activity className="h-10 w-10 text-muted-foreground/50" />
        <div>
          <h3 className="font-semibold text-foreground">No Market Data Available</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md">
            Sync carrier data from EDGAR first to populate the market cycle dashboard.
            Visit the Dashboard and click &quot;Sync All from EDGAR&quot;.
          </p>
        </div>
      </div>
    );
  }

  const { stats, cycleIndicator, industryTrend, categoryTrend, premiumGrowth, topPerformers, bottomPerformers } = data;

  const cycleDirectionConfig = {
    hardening: {
      icon: TrendingUp,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10 border-emerald-500/20",
      label: "HARDENING",
      description: "Combined ratios are improving — market conditions tightening",
    },
    softening: {
      icon: TrendingDown,
      color: "text-red-400",
      bgColor: "bg-red-500/10 border-red-500/20",
      label: "SOFTENING",
      description: "Combined ratios are deteriorating — market conditions loosening",
    },
    stable: {
      icon: ArrowRight,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10 border-amber-500/20",
      label: "STABLE",
      description: "Combined ratios are holding steady — no significant directional change",
    },
  };

  const cycleConfig = cycleDirectionConfig[cycleIndicator.direction];
  const CycleIcon = cycleConfig.icon;

  // Premium chart data in billions
  const premiumChartData = premiumGrowth.map((d) => ({
    year: d.year,
    NWP: Number((d.totalNWP / 1e9).toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Market Cycle Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Industry-wide P&C insurance market trends and competitive positioning
          {stats.latestYear && (
            <span className="ml-1 text-muted-foreground/70">
              — data through {stats.latestYear}
            </span>
          )}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Industry Avg Combined Ratio
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold tabular-nums ${
              stats.avgCombinedRatio !== null
                ? stats.avgCombinedRatio < 100
                  ? "text-emerald-400"
                  : "text-red-400"
                : ""
            }`}>
              {stats.avgCombinedRatio !== null ? `${stats.avgCombinedRatio}%` : "N/A"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.avgCombinedRatio !== null
                ? stats.avgCombinedRatio < 100
                  ? "Industry profitably underwriting"
                  : "Industry underwriting at a loss"
                : "No ratio data available"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Net Written Premiums
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              {stats.totalNWP !== null ? formatCurrency(stats.totalNWP) : "N/A"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Across all tracked carriers
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Carriers With Data
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              {stats.carriersWithData}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Reporting combined ratios
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              YoY Premium Change
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold tabular-nums ${
              stats.yoyPremiumChange !== null
                ? stats.yoyPremiumChange >= 0
                  ? "text-emerald-400"
                  : "text-red-400"
                : ""
            }`}>
              {stats.yoyPremiumChange !== null
                ? `${stats.yoyPremiumChange >= 0 ? "+" : ""}${stats.yoyPremiumChange}%`
                : "N/A"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Net written premium growth
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cycle Indicator */}
      <Card className={`border ${cycleConfig.bgColor}`}>
        <CardContent className="flex items-center gap-6 py-6">
          <div className={`flex h-16 w-16 items-center justify-center rounded-xl ${cycleConfig.bgColor}`}>
            <CycleIcon className={`h-8 w-8 ${cycleConfig.color}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className={`text-2xl font-bold tracking-widest ${cycleConfig.color}`}>
                {cycleConfig.label}
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {cycleConfig.description}
            </p>
            {cycleIndicator.latestCR !== null && cycleIndicator.previousCR !== null && (
              <p className="mt-1 text-xs text-muted-foreground">
                Combined ratio moved from{" "}
                <span className="font-semibold text-foreground">{cycleIndicator.previousCR}%</span>
                {" "}({cycleIndicator.previousYear}) to{" "}
                <span className="font-semibold text-foreground">{cycleIndicator.latestCR}%</span>
                {" "}({cycleIndicator.latestYear})
                {" — "}
                <span className={cycleIndicator.changePct <= 0 ? "text-emerald-400" : "text-red-400"}>
                  {cycleIndicator.changePct > 0 ? "+" : ""}{cycleIndicator.changePct} pts
                </span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Industry Combined Ratio Trend */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Industry Combined Ratio Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {industryTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={industryTrend} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `${v}%`}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value) => [`${value}%`, undefined]}
                  />
                  <Legend />
                  <ReferenceLine
                    y={100}
                    stroke="hsl(var(--destructive))"
                    strokeDasharray="6 3"
                    label={{
                      value: "100%",
                      position: "right",
                      fill: "hsl(var(--destructive))",
                      fontSize: 11,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgCombinedRatio"
                    name="Combined Ratio"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    dot={{ fill: "#60a5fa", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgLossRatio"
                    name="Loss Ratio"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="avgExpenseRatio"
                    name="Expense Ratio"
                    stroke="#a78bfa"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                No combined ratio data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Combined Ratio by Category */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Combined Ratio by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={categoryTrend} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `${v}%`}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value) => [`${value}%`, undefined]}
                  />
                  <Legend />
                  <ReferenceLine
                    y={100}
                    stroke="hsl(var(--destructive))"
                    strokeDasharray="6 3"
                    label={{
                      value: "100%",
                      position: "right",
                      fill: "hsl(var(--destructive))",
                      fontSize: 11,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="us_pc"
                    name="US P&C"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    dot={{ fill: "#60a5fa", r: 4 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="global"
                    name="Global"
                    stroke="#34d399"
                    strokeWidth={2}
                    dot={{ fill: "#34d399", r: 4 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="reinsurer"
                    name="Reinsurer"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    dot={{ fill: "#a78bfa", r: 4 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                No category comparison data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Premium Growth Chart */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Net Written Premium Trends</CardTitle>
        </CardHeader>
        <CardContent>
          {premiumChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={premiumChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `$${v}B`}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value) => [`$${value}B`, undefined]}
                />
                <Legend />
                <Bar dataKey="NWP" name="Net Written Premiums" fill="#60a5fa" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              No premium data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top/Bottom Performers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Performers */}
        <Card className="border-border bg-card p-0">
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-base">
              Top Performers — Lowest Combined Ratios
              {stats.latestYear && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({stats.latestYear})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topPerformers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-semibold w-[50px]">#</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Carrier</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Category</TableHead>
                    <TableHead className="text-muted-foreground font-semibold text-right">CR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topPerformers.map((carrier, idx) => (
                    <TableRow key={carrier.carrierId} className="border-border">
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/carriers/${carrier.carrierId}`}
                          className="text-sm font-medium hover:text-primary transition-colors"
                        >
                          {carrier.name}
                          {carrier.ticker && (
                            <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                              {carrier.ticker}
                            </span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={categoryColors[carrier.category] || "border-border text-muted-foreground"}
                        >
                          {categoryLabels[carrier.category] || carrier.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-emerald-400">
                        {carrier.combinedRatio}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                No performer data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom Performers */}
        <Card className="border-border bg-card p-0">
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-base">
              Bottom Performers — Highest Combined Ratios
              {stats.latestYear && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({stats.latestYear})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {bottomPerformers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-semibold w-[50px]">#</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Carrier</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Category</TableHead>
                    <TableHead className="text-muted-foreground font-semibold text-right">CR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bottomPerformers.map((carrier, idx) => (
                    <TableRow key={carrier.carrierId} className="border-border">
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/carriers/${carrier.carrierId}`}
                          className="text-sm font-medium hover:text-primary transition-colors"
                        >
                          {carrier.name}
                          {carrier.ticker && (
                            <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                              {carrier.ticker}
                            </span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={categoryColors[carrier.category] || "border-border text-muted-foreground"}
                        >
                          {categoryLabels[carrier.category] || carrier.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-red-400">
                        {carrier.combinedRatio}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                No performer data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
