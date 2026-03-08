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
  Car,
  Building2,
  Briefcase,
  Package,
  ExternalLink,
  Check,
  MessageSquare,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

interface CarrierInfo {
  id: string;
  name: string;
  ticker: string | null;
  exchange: string | null;
  headquartersCountry: string;
  companyType: string;
  linesOfBusiness: string[];
  isPubliclyTraded: boolean;
  parentCompany: string | null;
  cikNumber: string | null;
  description: string | null;
  website: string | null;
}

interface AutoDealerData {
  carriers: CarrierInfo[];
  stats: {
    totalCarriers: number;
    primaryCarriers: number;
    mgaAndBrokers: number;
    mutuals: number;
    withEdgarData: number;
    uniqueProducts: number;
  };
  companyTypeBreakdown: Array<{
    type: string;
    label: string;
    count: number;
    carriers: string[];
  }>;
  productMatrix: {
    products: string[];
    carriers: Array<{
      id: string;
      name: string;
      companyType: string;
      products: string[];
    }>;
  };
  allySpotlight: {
    carrierId: string;
    hasData: boolean;
    latestMetrics: Record<string, number> | null;
    previousMetrics: Record<string, number> | null;
    latestYear: number | null;
    combinedRatioTrend: Array<{ year: number; value: number }>;
    premiumTrend: Array<{ year: number; value: number }>;
  } | null;
  recentCommentary: Array<{
    id: string;
    carrierId: string;
    carrierName: string;
    title: string;
    content: string;
    category: string;
    sentiment: string;
    sourceDate: string;
    source: string;
    quarter: number;
    year: number;
  }>;
}

const TYPE_COLORS: Record<string, string> = {
  primary_carrier: "#60a5fa",
  mga_specialty: "#a78bfa",
  broker: "#34d399",
  mutual: "#f59e0b",
};

const typeBadgeColors: Record<string, string> = {
  primary_carrier: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  mga_specialty: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  broker: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  mutual: "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

const typeLabels: Record<string, string> = {
  primary_carrier: "Primary Carrier",
  mga_specialty: "MGA / Specialty",
  broker: "Broker",
  mutual: "Mutual",
};

const categoryBadgeColors: Record<string, string> = {
  rate_commentary: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  reinsurance_signal: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  reserve_development: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  strategic_direction: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  catastrophe_update: "bg-red-500/15 text-red-400 border-red-500/20",
};

const categoryLabels: Record<string, string> = {
  rate_commentary: "Rate",
  reinsurance_signal: "Reinsurance",
  reserve_development: "Reserves",
  strategic_direction: "Strategy",
  catastrophe_update: "Catastrophe",
};

const sentimentColors: Record<string, string> = {
  positive: "bg-emerald-400",
  neutral: "bg-muted-foreground",
  negative: "bg-red-400",
};

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--foreground))",
};

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AutoDealersPage() {
  const [data, setData] = useState<AutoDealerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/auto-dealers");
        if (!res.ok) throw new Error("Failed to fetch");
        const result = await res.json();
        setData(result);
      } catch {
        toast.error("Failed to load auto dealer data");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        Loading auto dealer data...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-center">
        <Car className="h-10 w-10 text-muted-foreground/50" />
        <div>
          <h3 className="font-semibold text-foreground">No Auto Dealer Data Available</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md">
            Seed the database from the Dashboard to populate auto dealer carrier data.
          </p>
        </div>
      </div>
    );
  }

  const { stats, carriers, companyTypeBreakdown, productMatrix, allySpotlight, recentCommentary } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Auto Dealer Vertical</h1>
        <p className="mt-1 text-muted-foreground">
          Niche insurance market for auto dealerships — carriers, products, and competitive intelligence
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Carriers</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.totalCarriers}</div>
            <p className="mt-1 text-xs text-muted-foreground">In auto dealer niche</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Primary Carriers</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.primaryCarriers}</div>
            <p className="mt-1 text-xs text-muted-foreground">Direct insurers</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">MGAs & Brokers</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.mgaAndBrokers}</div>
            <p className="mt-1 text-xs text-muted-foreground">Specialty distributors</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dealer Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.uniqueProducts}</div>
            <p className="mt-1 text-xs text-muted-foreground">Unique coverage types</p>
          </CardContent>
        </Card>
      </div>

      {/* Carrier Universe Table */}
      <Card className="border-border bg-card p-0">
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-base">Dealer Carrier Universe</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-semibold">Company</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Type</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Key Products</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Parent</TableHead>
                <TableHead className="text-muted-foreground font-semibold">EDGAR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carriers.map((carrier) => (
                <TableRow key={carrier.id} className="border-border cursor-pointer hover:bg-accent/50">
                  <TableCell>
                    <Link
                      href={`/carriers/${carrier.id}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {carrier.name}
                    </Link>
                    {carrier.ticker && (
                      <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                        {carrier.ticker}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={typeBadgeColors[carrier.companyType] || "border-border text-muted-foreground"}
                    >
                      {typeLabels[carrier.companyType] || carrier.companyType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[300px]">
                    {carrier.linesOfBusiness.slice(0, 3).join(", ")}
                    {carrier.linesOfBusiness.length > 3 && (
                      <span className="text-xs"> +{carrier.linesOfBusiness.length - 3}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {carrier.parentCompany || "—"}
                  </TableCell>
                  <TableCell>
                    {carrier.cikNumber ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Type Breakdown + Ally Spotlight row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Company Type Breakdown */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Company Type Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={companyTypeBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="count"
                  nameKey="label"
                  label={({ name, value }) => `${name} (${value})`}
                  labelLine={false}
                >
                  {companyTypeBreakdown.map((entry) => (
                    <Cell
                      key={entry.type}
                      fill={TYPE_COLORS[entry.type] || "#6b7280"}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Ally Financial Spotlight */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-400" />
              Ally Financial Spotlight
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allySpotlight && allySpotlight.hasData && allySpotlight.latestMetrics ? (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Only SEC-reporting carrier in the auto dealer niche
                  {allySpotlight.latestYear && ` — data through ${allySpotlight.latestYear}`}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {allySpotlight.latestMetrics.combined_ratio !== undefined && (
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Combined Ratio</p>
                      <p className={cn(
                        "text-xl font-bold tabular-nums mt-1",
                        allySpotlight.latestMetrics.combined_ratio < 1 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {(allySpotlight.latestMetrics.combined_ratio * 100).toFixed(1)}%
                      </p>
                    </div>
                  )}
                  {allySpotlight.latestMetrics.nwp !== undefined && (
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Net Written Premiums</p>
                      <p className="text-xl font-bold tabular-nums mt-1">
                        {formatCurrency(allySpotlight.latestMetrics.nwp)}
                      </p>
                    </div>
                  )}
                  {allySpotlight.latestMetrics.net_income !== undefined && (
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Net Income</p>
                      <p className={cn(
                        "text-xl font-bold tabular-nums mt-1",
                        allySpotlight.latestMetrics.net_income >= 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {formatCurrency(allySpotlight.latestMetrics.net_income)}
                      </p>
                    </div>
                  )}
                  {allySpotlight.latestMetrics.investment_income !== undefined && (
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Investment Income</p>
                      <p className="text-xl font-bold tabular-nums mt-1">
                        {formatCurrency(allySpotlight.latestMetrics.investment_income)}
                      </p>
                    </div>
                  )}
                </div>
                {allySpotlight.combinedRatioTrend.length > 1 && (
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={allySpotlight.combinedRatioTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => `${v}%`}
                        domain={["auto", "auto"]}
                      />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={(value) => [`${value}%`, "Combined Ratio"]}
                      />
                      <ReferenceLine y={100} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                <Link
                  href={`/carriers/${allySpotlight.carrierId}`}
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View full Ally Financial profile
                </Link>
              </div>
            ) : (
              <div className="flex h-[250px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-8 w-8 text-muted-foreground/50" />
                <p>No EDGAR data synced for Ally Financial</p>
                <p className="text-xs">Sync from the Dashboard to see financial metrics here</p>
                {allySpotlight && (
                  <Link
                    href={`/carriers/${allySpotlight.carrierId}`}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Go to Ally Financial
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Product & Coverage Matrix */}
      <Card className="border-border bg-card p-0">
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-base">Product & Coverage Matrix</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground font-semibold sticky left-0 bg-card z-10 min-w-[200px]">
                    Carrier
                  </TableHead>
                  {productMatrix.products.map((product) => (
                    <TableHead
                      key={product}
                      className="text-muted-foreground font-semibold text-center min-w-[100px] text-xs"
                    >
                      {product}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {productMatrix.carriers.map((carrier) => (
                  <TableRow key={carrier.id} className="border-border">
                    <TableCell className="font-medium sticky left-0 bg-card z-10">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/carriers/${carrier.id}`}
                          className="hover:text-primary transition-colors text-sm"
                        >
                          {carrier.name}
                        </Link>
                      </div>
                    </TableCell>
                    {productMatrix.products.map((product) => (
                      <TableCell key={product} className="text-center">
                        {carrier.products.includes(product) ? (
                          <div className="mx-auto h-3 w-3 rounded-full bg-amber-400" />
                        ) : null}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Commentary */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Recent Auto Dealer Commentary</CardTitle>
        </CardHeader>
        <CardContent>
          {recentCommentary.length > 0 ? (
            <div className="space-y-3">
              {recentCommentary.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 border-b border-border pb-3 last:border-0">
                  <div
                    className={cn(
                      "mt-1.5 h-2 w-2 rounded-full shrink-0",
                      sentimentColors[entry.sentiment] || "bg-muted-foreground"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/carriers/${entry.carrierId}`}
                        className="text-sm font-semibold hover:text-primary transition-colors"
                      >
                        {entry.carrierName}
                      </Link>
                      <Badge
                        variant="outline"
                        className={categoryBadgeColors[entry.category] || "border-border text-muted-foreground"}
                      >
                        {categoryLabels[entry.category] || entry.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground mt-0.5">{entry.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.content}</p>
                    <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                      Q{entry.quarter} {entry.year} — {formatDate(entry.sourceDate)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
              <p>No commentary yet</p>
              <p className="text-xs">Add commentary on individual carrier pages to see it here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
