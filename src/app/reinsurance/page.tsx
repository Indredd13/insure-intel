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
  Shield,
  Globe,
  TrendingUp,
  FileText,
  ExternalLink,
  Check,
  MessageSquare,
} from "lucide-react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
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

interface ReinsuranceData {
  carriers: CarrierInfo[];
  stats: {
    totalReinsurers: number;
    publiclyTraded: number;
    withEdgarData: number;
    countriesRepresented: number;
    privateSubsidiaries: number;
  };
  geographicDistribution: Array<{
    country: string;
    count: number;
    carriers: string[];
  }>;
  ownershipBreakdown: {
    publicCount: number;
    privateCount: number;
    withParent: Array<{ name: string; parent: string }>;
  };
  lobMatrix: {
    lines: string[];
    carriers: Array<{
      id: string;
      name: string;
      lines: string[];
    }>;
  };
  financialComparison: {
    combinedRatioTrend: Array<Record<string, number>>;
    premiumTrend: Array<Record<string, number>>;
    carriersWithData: Array<{ id: string; name: string; ticker: string }>;
  };
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

const GEO_COLORS = ["#60a5fa", "#f59e0b", "#a78bfa", "#34d399", "#f87171"];
const CARRIER_CHART_COLORS = ["#60a5fa", "#34d399", "#a78bfa"];

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ReinsurancePage() {
  const [data, setData] = useState<ReinsuranceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/reinsurance");
        if (!res.ok) throw new Error("Failed to fetch");
        const result = await res.json();
        setData(result);
      } catch {
        toast.error("Failed to load reinsurance data");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        Loading reinsurance data...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-center">
        <Shield className="h-10 w-10 text-muted-foreground/50" />
        <div>
          <h3 className="font-semibold text-foreground">No Reinsurance Data Available</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md">
            Seed the database from the Dashboard to populate reinsurer data.
          </p>
        </div>
      </div>
    );
  }

  const { stats, carriers, geographicDistribution, ownershipBreakdown, lobMatrix, financialComparison, recentCommentary } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reinsurance Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Global reinsurer universe — carrier intelligence, geographic spread, and financial comparison
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Reinsurers</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.totalReinsurers}</div>
            <p className="mt-1 text-xs text-muted-foreground">Tracked in universe</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Publicly Traded</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.publiclyTraded}</div>
            <p className="mt-1 text-xs text-muted-foreground">Listed on exchanges</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">With EDGAR Data</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.withEdgarData}</div>
            <p className="mt-1 text-xs text-muted-foreground">SEC-reporting carriers</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Countries</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.countriesRepresented}</div>
            <p className="mt-1 text-xs text-muted-foreground">Headquarters locations</p>
          </CardContent>
        </Card>
      </div>

      {/* Reinsurer Universe Table */}
      <Card className="border-border bg-card p-0">
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-base">Reinsurer Universe</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-semibold">Company</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Ticker</TableHead>
                <TableHead className="text-muted-foreground font-semibold">HQ</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Ownership</TableHead>
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
                  </TableCell>
                  <TableCell className="font-mono text-sm text-primary">
                    {carrier.ticker || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {carrier.headquartersCountry}
                  </TableCell>
                  <TableCell>
                    {carrier.isPubliclyTraded ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        Public
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                        Private
                      </Badge>
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

      {/* Geographic + Ownership row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Geographic Distribution */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Geographic Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={geographicDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="count"
                  nameKey="country"
                  label={({ name, value }) => `${name} (${value})`}
                  labelLine={false}
                >
                  {geographicDistribution.map((entry, i) => (
                    <Cell key={entry.country} fill={GEO_COLORS[i % GEO_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Ownership Structure */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Ownership Structure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-8 justify-center">
              <div className="text-center">
                <div className="text-4xl font-bold text-emerald-400">{ownershipBreakdown.publicCount}</div>
                <p className="text-sm text-muted-foreground mt-1">Public</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-muted-foreground">{ownershipBreakdown.privateCount}</div>
                <p className="text-sm text-muted-foreground mt-1">Private</p>
              </div>
            </div>
            {ownershipBreakdown.withParent.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Subsidiary Relationships
                </p>
                {ownershipBreakdown.withParent.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm border-b border-border pb-2">
                    <span className="text-foreground">{item.name}</span>
                    <span className="text-muted-foreground">{item.parent}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lines of Business Matrix */}
      <Card className="border-border bg-card p-0">
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-base">Lines of Business Matrix</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground font-semibold sticky left-0 bg-card z-10 min-w-[200px]">
                    Carrier
                  </TableHead>
                  {lobMatrix.lines.map((line) => (
                    <TableHead
                      key={line}
                      className="text-muted-foreground font-semibold text-center min-w-[100px] text-xs"
                    >
                      {line}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lobMatrix.carriers.map((carrier) => (
                  <TableRow key={carrier.id} className="border-border">
                    <TableCell className="font-medium sticky left-0 bg-card z-10">
                      <Link
                        href={`/carriers/${carrier.id}`}
                        className="hover:text-primary transition-colors text-sm"
                      >
                        {carrier.name}
                      </Link>
                    </TableCell>
                    {lobMatrix.lines.map((line) => (
                      <TableCell key={line} className="text-center">
                        {carrier.lines.includes(line) ? (
                          <div className="mx-auto h-3 w-3 rounded-full bg-purple-400" />
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

      {/* Financial Comparison */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">
            Combined Ratio Comparison
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              EDGAR data available for {financialComparison.carriersWithData.length} of {stats.totalReinsurers} reinsurers
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {financialComparison.combinedRatioTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={financialComparison.combinedRatioTrend} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
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
                {financialComparison.carriersWithData.map((carrier, i) => (
                  <Line
                    key={carrier.id}
                    type="monotone"
                    dataKey={carrier.name}
                    stroke={CARRIER_CHART_COLORS[i % CARRIER_CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ fill: CARRIER_CHART_COLORS[i % CARRIER_CHART_COLORS.length], r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
              <p>No financial data synced yet</p>
              <p className="text-xs">Sync Everest, RenaissanceRe, or Arch Capital from EDGAR to see comparison charts</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Commentary */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Recent Reinsurance Commentary</CardTitle>
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
              <p className="text-xs">Add commentary on individual reinsurer pages to see it here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
