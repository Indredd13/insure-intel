"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { TrendingUp, DollarSign, Percent, ShieldCheck, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface FinancialMetric {
  id: string;
  metricName: string;
  value: number;
  unit: string;
  periodEnd: string;
  fiscalYear: number | null;
  fiscalPeriod: string | null;
  formType: string | null;
}

interface FinancialsTabProps {
  carrierId: string;
  cikNumber: string | null;
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function formatRatio(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatChartCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(0)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
  return value.toLocaleString();
}

// ─── Component ──────────────────────────────────────────────────────────────

export function FinancialsTab({ carrierId, cikNumber }: FinancialsTabProps) {
  const [metrics, setMetrics] = useState<FinancialMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [annualOnly, setAnnualOnly] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({ carrierId });
        if (annualOnly) params.set("annualOnly", "true");
        const res = await fetch(`/api/financials?${params}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setMetrics(data);
      } catch {
        // Empty state handles it
      } finally {
        setIsLoading(false);
      }
    }
    fetchMetrics();
  }, [carrierId, annualOnly]);

  // Pivot metrics into year-based records for charts
  const yearData = useMemo(() => {
    const byYear = new Map<number, Record<string, number>>();

    for (const m of metrics) {
      if (!m.fiscalYear) continue;
      if (!byYear.has(m.fiscalYear)) {
        byYear.set(m.fiscalYear, { year: m.fiscalYear });
      }
      const record = byYear.get(m.fiscalYear)!;
      // Keep the first value for each metric per year (avoid duplicates)
      if (record[m.metricName] === undefined) {
        record[m.metricName] = m.value;
      }
    }

    return Array.from(byYear.values()).sort((a, b) => a.year - b.year);
  }, [metrics]);

  // Latest year metrics for summary cards
  const latestYear = useMemo(() => {
    if (yearData.length === 0) return null;
    return yearData[yearData.length - 1];
  }, [yearData]);

  // Previous year for comparison
  const previousYear = useMemo(() => {
    if (yearData.length < 2) return null;
    return yearData[yearData.length - 2];
  }, [yearData]);

  // No CIK
  if (!cikNumber) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex h-64 flex-col items-center justify-center gap-3 text-center">
          <TrendingUp className="h-10 w-10 text-muted-foreground/50" />
          <div>
            <h3 className="font-semibold text-foreground">No Financial Data Available</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md">
              XBRL financial data is only available for SEC-reporting carriers.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex h-64 items-center justify-center text-muted-foreground">
          Loading financial data...
        </CardContent>
      </Card>
    );
  }

  if (metrics.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex h-64 flex-col items-center justify-center gap-3 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/50" />
          <div>
            <h3 className="font-semibold text-foreground">No Financial Data Yet</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md">
              Use the &quot;Fetch from EDGAR&quot; button on the Filings tab to sync SEC data first.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Compute YoY change helper
  function yoyChange(current: number | undefined, previous: number | undefined): string | null {
    if (current === undefined || previous === undefined || previous === 0) return null;
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
  }

  // Chart data for combined ratio (convert to percentage for readability)
  const ratioChartData = yearData
    .filter((d) => d.combined_ratio !== undefined)
    .map((d) => ({
      year: d.year,
      "Combined Ratio": Number((d.combined_ratio * 100).toFixed(1)),
      "Loss Ratio": d.loss_ratio ? Number((d.loss_ratio * 100).toFixed(1)) : undefined,
      "Expense Ratio": d.expense_ratio ? Number((d.expense_ratio * 100).toFixed(1)) : undefined,
    }));

  // Chart data for premiums
  const premiumChartData = yearData
    .filter((d) => d.nep !== undefined || d.nwp !== undefined || d.gwp !== undefined)
    .map((d) => ({
      year: d.year,
      GWP: d.gwp ? Number((d.gwp / 1e9).toFixed(2)) : undefined,
      NWP: d.nwp ? Number((d.nwp / 1e9).toFixed(2)) : undefined,
      NEP: d.nep ? Number((d.nep / 1e9).toFixed(2)) : undefined,
    }));

  return (
    <div className="space-y-6">
      {/* Annual/Quarterly Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Financial Metrics</h3>
        <div className="flex gap-2">
          <Button
            variant={annualOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setAnnualOnly(true)}
            className="border-border"
          >
            Annual
          </Button>
          <Button
            variant={!annualOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setAnnualOnly(false)}
            className="border-border"
          >
            All Periods
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {latestYear && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {/* Combined Ratio */}
          {latestYear.combined_ratio !== undefined && (
            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Combined Ratio
                </CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    "text-2xl font-bold tabular-nums",
                    latestYear.combined_ratio < 1
                      ? "text-emerald-400"
                      : "text-red-400"
                  )}
                >
                  {formatRatio(latestYear.combined_ratio)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  FY {latestYear.year}
                  {previousYear?.combined_ratio !== undefined && (
                    <span className="ml-2">
                      {yoyChange(latestYear.combined_ratio, previousYear.combined_ratio)} YoY
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Net Written Premiums */}
          {latestYear.nwp !== undefined && (
            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net Written Premiums
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {formatCurrency(latestYear.nwp)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  FY {latestYear.year}
                  {previousYear?.nwp !== undefined && (
                    <span className="ml-2">{yoyChange(latestYear.nwp, previousYear.nwp)} YoY</span>
                  )}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Net Earned Premiums */}
          {latestYear.nep !== undefined && (
            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net Earned Premiums
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {formatCurrency(latestYear.nep)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  FY {latestYear.year}
                  {previousYear?.nep !== undefined && (
                    <span className="ml-2">{yoyChange(latestYear.nep, previousYear.nep)} YoY</span>
                  )}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Investment Income */}
          {latestYear.investment_income !== undefined && (
            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Investment Income
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {formatCurrency(latestYear.investment_income)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  FY {latestYear.year}
                  {previousYear?.investment_income !== undefined && (
                    <span className="ml-2">
                      {yoyChange(latestYear.investment_income, previousYear.investment_income)} YoY
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Stockholders' Equity */}
          {latestYear.stockholders_equity !== undefined && (
            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Stockholders&apos; Equity
                </CardTitle>
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {formatCurrency(latestYear.stockholders_equity)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">FY {latestYear.year}</p>
              </CardContent>
            </Card>
          )}

          {/* Net Income */}
          {latestYear.net_income !== undefined && (
            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net Income
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    "text-2xl font-bold tabular-nums",
                    latestYear.net_income >= 0 ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {formatCurrency(latestYear.net_income)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  FY {latestYear.year}
                  {previousYear?.net_income !== undefined && (
                    <span className="ml-2">
                      {yoyChange(latestYear.net_income, previousYear.net_income)} YoY
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Loss Ratio */}
          {latestYear.loss_ratio !== undefined && (
            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Loss Ratio
                </CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {formatRatio(latestYear.loss_ratio)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">FY {latestYear.year}</p>
              </CardContent>
            </Card>
          )}

          {/* Expense Ratio */}
          {latestYear.expense_ratio !== undefined && (
            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Expense Ratio
                </CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {formatRatio(latestYear.expense_ratio)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">FY {latestYear.year}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Combined Ratio Trend Chart */}
      {ratioChartData.length > 1 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Combined Ratio Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={ratioChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="year"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `${v}%`}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value) => [`${value}%`, undefined]}
                />
                <Legend />
                <ReferenceLine
                  y={100}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="6 3"
                  label={{ value: "100%", position: "right", fill: "hsl(var(--destructive))", fontSize: 11 }}
                />
                <Line
                  type="monotone"
                  dataKey="Combined Ratio"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={{ fill: "#60a5fa", r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="Loss Ratio"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={{ fill: "#f59e0b", r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="Expense Ratio"
                  stroke="#a78bfa"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={{ fill: "#a78bfa", r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Premiums Trend Chart */}
      {premiumChartData.length > 1 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Premium Trends ($B)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={premiumChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="year"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `$${v}B`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value) => [`$${value}B`, undefined]}
                />
                <Legend />
                {premiumChartData.some((d) => d.GWP !== undefined) && (
                  <Bar dataKey="GWP" fill="#60a5fa" radius={[2, 2, 0, 0]} />
                )}
                {premiumChartData.some((d) => d.NWP !== undefined) && (
                  <Bar dataKey="NWP" fill="#34d399" radius={[2, 2, 0, 0]} />
                )}
                {premiumChartData.some((d) => d.NEP !== undefined) && (
                  <Bar dataKey="NEP" fill="#a78bfa" radius={[2, 2, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Raw data summary */}
      <div className="text-xs text-muted-foreground">
        {metrics.length} data points across {yearData.length} fiscal year{yearData.length !== 1 ? "s" : ""}
        {latestYear && ` (${yearData[0]?.year}–${latestYear.year})`}
      </div>
    </div>
  );
}
