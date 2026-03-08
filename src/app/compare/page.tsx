"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  ArrowLeftRight,
  Search,
  X,
  Copy,
  Save,
  Check,
  FileText,
  MessageSquare,
  ClipboardPaste,
  ChevronDown,
  ChevronUp,
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
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CarrierBasic {
  id: string;
  name: string;
  ticker: string | null;
  category: string;
}

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
  category: string;
}

interface ComparisonData {
  carriers: CarrierInfo[];
  financialComparison: {
    combinedRatioTrend: Array<Record<string, number | null>>;
    nwpTrend: Array<Record<string, number | null>>;
    latestMetrics: Array<{
      carrierId: string;
      carrierName: string;
      hasCik: boolean;
      metrics: Record<string, number>;
    }>;
    metricDefinitions: Array<{ key: string; label: string; format: string }>;
    latestYear: number | null;
  };
  lobOverlap: {
    allLines: string[];
    sharedLines: string[];
    carriers: Array<{
      id: string;
      name: string;
      uniqueLines: string[];
      totalLines: number;
    }>;
  };
  commentarySummary: Array<{
    carrierId: string;
    carrierName: string;
    entries: Array<{
      id: string;
      title: string;
      content: string;
      category: string;
      sentiment: string;
      sourceDate: string;
      source: string;
      quarter: number;
      year: number;
    }>;
  }>;
  promptTemplate: string;
}

interface SavedReport {
  id: string;
  title: string;
  carrierIds: string[];
  analysis: string;
  createdAt: string;
  carriers: Array<{ id: string; name: string; ticker: string | null }>;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CARRIER_COLORS = ["#60a5fa", "#34d399", "#f59e0b"];

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

const companyTypeLabels: Record<string, string> = {
  primary_carrier: "Primary Carrier",
  reinsurer: "Reinsurer",
  mutual: "Mutual",
  mga_specialty: "MGA / Specialty",
  broker: "Broker",
  market: "Market",
};

const categoryBadgeColors: Record<string, string> = {
  rate_commentary: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  reinsurance_signal: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  reserve_development: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  strategic_direction: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  catastrophe_update: "bg-red-500/15 text-red-400 border-red-500/20",
};

const commentaryCategoryLabels: Record<string, string> = {
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

function formatMetricValue(value: number | undefined, format: string): string {
  if (value === undefined) return "—";
  if (format === "ratio") return `${(value * 100).toFixed(1)}%`;
  if (format === "currency") return formatCurrency(value);
  return value.toString();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-muted-foreground">Loading comparison...</div>}>
      <ComparePageContent />
    </Suspense>
  );
}

function ComparePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Carrier selection state
  const [allCarriers, setAllCarriers] = useState<CarrierBasic[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Comparison data
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // AI Analysis
  const [showPrompt, setShowPrompt] = useState(false);
  const [analysisText, setAnalysisText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Saved reports
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [showSavedReports, setShowSavedReports] = useState(false);

  // Load all carriers for the selector
  useEffect(() => {
    async function fetchCarriers() {
      try {
        const res = await fetch("/api/carriers");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setAllCarriers(data);
      } catch {
        toast.error("Failed to load carriers");
      }
    }
    fetchCarriers();
  }, []);

  // Load saved reports
  useEffect(() => {
    async function fetchReports() {
      try {
        const res = await fetch("/api/compare/reports");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSavedReports(data);
      } catch {
        // Silent
      }
    }
    fetchReports();
  }, []);

  // Initialize from URL params
  useEffect(() => {
    const carriersParam = searchParams.get("carriers");
    if (carriersParam) {
      const ids = carriersParam.split(",").filter(Boolean);
      if (ids.length >= 2 && ids.length <= 3) {
        setSelectedIds(ids);
      }
    }
  }, [searchParams]);

  // Fetch comparison when carriers change
  const fetchComparison = useCallback(async (ids: string[]) => {
    if (ids.length < 2) {
      setComparisonData(null);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/compare?carriers=${ids.join(",")}`);
      if (!res.ok) throw new Error("Failed to fetch comparison");
      const data = await res.json();
      setComparisonData(data);
      setAnalysisText("");
    } catch {
      toast.error("Failed to load comparison data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedIds.length >= 2) {
      fetchComparison(selectedIds);
    }
  }, [selectedIds, fetchComparison]);

  // Handlers
  const addCarrier = (id: string) => {
    if (selectedIds.length >= 3 || selectedIds.includes(id)) return;
    const newIds = [...selectedIds, id];
    setSelectedIds(newIds);
    setSearchQuery("");
    setShowDropdown(false);
    router.push(`/compare?carriers=${newIds.join(",")}`);
  };

  const removeCarrier = (id: string) => {
    const newIds = selectedIds.filter((i) => i !== id);
    setSelectedIds(newIds);
    if (newIds.length >= 2) {
      router.push(`/compare?carriers=${newIds.join(",")}`);
    } else {
      router.push("/compare");
      setComparisonData(null);
    }
  };

  const copyPrompt = async () => {
    if (!comparisonData?.promptTemplate) return;
    try {
      await navigator.clipboard.writeText(comparisonData.promptTemplate);
      setCopied(true);
      toast.success("Prompt copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const saveReport = async () => {
    if (!comparisonData || !analysisText.trim()) {
      toast.error("Please paste your AI analysis before saving");
      return;
    }
    setIsSaving(true);
    try {
      const carrierNames = comparisonData.carriers.map((c) => c.name).join(" vs ");
      const res = await fetch("/api/compare/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: carrierNames,
          carrierIds: selectedIds,
          analysis: analysisText,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Report saved");
      // Refresh saved reports
      const reportsRes = await fetch("/api/compare/reports");
      if (reportsRes.ok) setSavedReports(await reportsRes.json());
    } catch {
      toast.error("Failed to save report");
    } finally {
      setIsSaving(false);
    }
  };

  const loadReport = (report: SavedReport) => {
    setSelectedIds(report.carrierIds);
    setAnalysisText(report.analysis);
    router.push(`/compare?carriers=${report.carrierIds.join(",")}`);
  };

  // Filtered carriers for dropdown
  const filteredCarriers = allCarriers
    .filter((c) => !selectedIds.includes(c.id))
    .filter(
      (c) =>
        !searchQuery ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.ticker && c.ticker.toLowerCase().includes(searchQuery.toLowerCase()))
    );

  // Merge all commentary entries sorted by date
  const mergedCommentary = comparisonData
    ? comparisonData.commentarySummary
        .flatMap((cs) =>
          cs.entries.map((e) => ({ ...e, carrierId: cs.carrierId, carrierName: cs.carrierName }))
        )
        .sort((a, b) => new Date(b.sourceDate).getTime() - new Date(a.sourceDate).getTime())
        .slice(0, 15)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Competitor Comparison</h1>
        <p className="mt-1 text-muted-foreground">
          Select 2–3 carriers to compare side-by-side across financials, lines of business, and commentary
        </p>
      </div>

      {/* Carrier Selector */}
      <Card className="border-border bg-card">
        <CardContent className="pt-6">
          <div className="space-y-3">
            {/* Selected carriers chips */}
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedIds.map((id, i) => {
                  const carrier = allCarriers.find((c) => c.id === id);
                  return (
                    <Badge
                      key={id}
                      variant="outline"
                      className="flex items-center gap-1.5 py-1.5 px-3 text-sm"
                      style={{ borderColor: CARRIER_COLORS[i] }}
                    >
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: CARRIER_COLORS[i] }} />
                      {carrier?.name || "Unknown"}
                      {carrier?.ticker && (
                        <span className="font-mono text-xs opacity-60">{carrier.ticker}</span>
                      )}
                      <button onClick={() => removeCarrier(id)} className="ml-1 hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Search input */}
            {selectedIds.length < 3 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={
                    selectedIds.length === 0
                      ? "Search carriers to compare..."
                      : `Add ${3 - selectedIds.length} more carrier${3 - selectedIds.length > 1 ? "s" : ""}...`
                  }
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className="pl-10 border-border bg-input"
                />
                {showDropdown && searchQuery && (
                  <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-64 overflow-y-auto">
                    {filteredCarriers.length > 0 ? (
                      filteredCarriers.slice(0, 10).map((carrier) => (
                        <button
                          key={carrier.id}
                          onClick={() => addCarrier(carrier.id)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-left"
                        >
                          <span className="font-medium">{carrier.name}</span>
                          {carrier.ticker && (
                            <span className="font-mono text-xs text-primary">{carrier.ticker}</span>
                          )}
                          <Badge
                            variant="outline"
                            className={cn("ml-auto text-[10px]", categoryColors[carrier.category])}
                          >
                            {categoryLabels[carrier.category] || carrier.category}
                          </Badge>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-muted-foreground">No carriers found</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {!comparisonData && !isLoading && selectedIds.length < 2 && (
        <div className="space-y-6">
          <Card className="border-border bg-card">
            <CardContent className="flex h-64 flex-col items-center justify-center gap-3 text-center">
              <ArrowLeftRight className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <h3 className="font-semibold text-foreground">Select Carriers to Compare</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-md">
                  Search and select 2–3 insurance carriers above to see a detailed side-by-side comparison.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Saved Reports */}
          {savedReports.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader>
                <button
                  onClick={() => setShowSavedReports(!showSavedReports)}
                  className="flex items-center justify-between w-full"
                >
                  <CardTitle className="text-base">Saved Reports ({savedReports.length})</CardTitle>
                  {showSavedReports ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CardHeader>
              {showSavedReports && (
                <CardContent className="space-y-2">
                  {savedReports.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => loadReport(report)}
                      className="flex w-full items-center justify-between rounded-lg border border-border p-3 hover:bg-accent transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-medium">{report.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(report.createdAt)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {report.carriers.map((c) => (
                          <Badge key={c.id} variant="outline" className="text-[10px] border-border">
                            {c.ticker || c.name.split(" ")[0]}
                          </Badge>
                        ))}
                      </div>
                    </button>
                  ))}
                </CardContent>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <Card className="border-border bg-card">
          <CardContent className="flex h-48 items-center justify-center text-muted-foreground">
            Building comparison...
          </CardContent>
        </Card>
      )}

      {/* ─── Comparison Results ────────────────────────────────────────────── */}
      {comparisonData && !isLoading && (
        <>
          {/* Overview Cards */}
          <div className={cn("grid gap-4", comparisonData.carriers.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
            {comparisonData.carriers.map((carrier, i) => (
              <Card key={carrier.id} className="border-border bg-card" style={{ borderTopColor: CARRIER_COLORS[i], borderTopWidth: "3px" }}>
                <CardContent className="pt-5 space-y-3">
                  <div>
                    <Link
                      href={`/carriers/${carrier.id}`}
                      className="text-lg font-semibold hover:text-primary transition-colors"
                    >
                      {carrier.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      {carrier.ticker && (
                        <span className="font-mono text-sm text-primary">{carrier.ticker}</span>
                      )}
                      <Badge variant="outline" className={categoryColors[carrier.category]}>
                        {categoryLabels[carrier.category] || carrier.category}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>{companyTypeLabels[carrier.companyType] || carrier.companyType} — {carrier.headquartersCountry}</p>
                    <p>{carrier.isPubliclyTraded ? "Publicly Traded" : "Private"}{carrier.parentCompany ? ` (${carrier.parentCompany})` : ""}</p>
                  </div>
                  {carrier.description && (
                    <p className="text-xs text-muted-foreground line-clamp-3">{carrier.description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Financial Comparison Table */}
          <Card className="border-border bg-card p-0">
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-base">
                Financial Comparison
                {comparisonData.financialComparison.latestYear && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    (FY {comparisonData.financialComparison.latestYear})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-semibold">Metric</TableHead>
                    {comparisonData.financialComparison.latestMetrics.map((cm, i) => (
                      <TableHead key={cm.carrierId} className="text-muted-foreground font-semibold text-right">
                        <span style={{ color: CARRIER_COLORS[i] }}>{cm.carrierName.split(" ")[0]}</span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonData.financialComparison.metricDefinitions.map((metric) => {
                    const values = comparisonData.financialComparison.latestMetrics.map(
                      (cm) => cm.metrics[metric.key]
                    );
                    return (
                      <TableRow key={metric.key} className="border-border">
                        <TableCell className="text-sm font-medium">{metric.label}</TableCell>
                        {comparisonData.financialComparison.latestMetrics.map((cm) => (
                          <TableCell key={cm.carrierId} className="text-right font-mono text-sm tabular-nums">
                            {cm.hasCik
                              ? formatMetricValue(cm.metrics[metric.key], metric.format)
                              : <span className="text-xs text-muted-foreground italic">No EDGAR</span>
                            }
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Combined Ratio Overlay */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">Combined Ratio Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                {comparisonData.financialComparison.combinedRatioTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={comparisonData.financialComparison.combinedRatioTrend} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                      <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} domain={["auto", "auto"]} />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`${value}%`, undefined]} />
                      <Legend />
                      <ReferenceLine y={100} stroke="hsl(var(--destructive))" strokeDasharray="6 3" />
                      {comparisonData.carriers.map((carrier, i) => (
                        <Line
                          key={carrier.id}
                          type="monotone"
                          dataKey={carrier.name}
                          stroke={CARRIER_COLORS[i]}
                          strokeWidth={2}
                          dot={{ fill: CARRIER_COLORS[i], r: 4 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                    No combined ratio data available for selected carriers
                  </div>
                )}
              </CardContent>
            </Card>

            {/* NWP Trends */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">Net Written Premium Trends</CardTitle>
              </CardHeader>
              <CardContent>
                {comparisonData.financialComparison.nwpTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={comparisonData.financialComparison.nwpTrend} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                      <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}B`} />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`$${value}B`, undefined]} />
                      <Legend />
                      {comparisonData.carriers.map((carrier, i) => (
                        <Bar key={carrier.id} dataKey={carrier.name} fill={CARRIER_COLORS[i]} radius={[2, 2, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                    No premium data available for selected carriers
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Lines of Business Overlap */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">
                Lines of Business Overlap
                {comparisonData.lobOverlap.sharedLines.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {comparisonData.lobOverlap.sharedLines.length} shared line{comparisonData.lobOverlap.sharedLines.length !== 1 ? "s" : ""}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Shared lines */}
              {comparisonData.lobOverlap.sharedLines.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Shared Lines
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {comparisonData.lobOverlap.sharedLines.map((line) => (
                      <Badge key={line} variant="outline" className="bg-purple-500/15 text-purple-400 border-purple-500/20">
                        {line}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Unique lines per carrier */}
              {comparisonData.lobOverlap.carriers.map((carrier, i) => (
                carrier.uniqueLines.length > 0 && (
                  <div key={carrier.id}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      <span style={{ color: CARRIER_COLORS[i] }}>{carrier.name}</span> — Unique Lines
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {carrier.uniqueLines.map((line) => (
                        <Badge key={line} variant="outline" className="border-border text-muted-foreground">
                          {line}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )
              ))}

              {comparisonData.lobOverlap.sharedLines.length === 0 && (
                <p className="text-sm text-muted-foreground">No shared lines of business between selected carriers.</p>
              )}
            </CardContent>
          </Card>

          {/* Commentary */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">Recent Commentary</CardTitle>
            </CardHeader>
            <CardContent>
              {mergedCommentary.length > 0 ? (
                <div className="space-y-3">
                  {mergedCommentary.map((entry) => (
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
                            {commentaryCategoryLabels[entry.category] || entry.category}
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
                  <p>No commentary yet for selected carriers</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Analysis Section */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                AI-Powered Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Copy the generated prompt below, paste it into{" "}
                <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Claude.ai</a>{" "}
                or ChatGPT, then paste the AI response back here to save your analysis.
              </p>

              {/* Prompt section */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowPrompt(!showPrompt)}>
                    {showPrompt ? "Hide Prompt" : "Show Prompt"}
                    {showPrompt ? <ChevronUp className="ml-1.5 h-3.5 w-3.5" /> : <ChevronDown className="ml-1.5 h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={copyPrompt}>
                    {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                    {copied ? "Copied!" : "Copy Prompt"}
                  </Button>
                </div>
                {showPrompt && (
                  <pre className="rounded-md border border-border bg-muted/50 p-4 text-xs text-muted-foreground whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {comparisonData.promptTemplate}
                  </pre>
                )}
              </div>

              {/* Analysis input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  Paste AI Analysis
                </label>
                <textarea
                  placeholder="Paste your AI-generated analysis here..."
                  value={analysisText}
                  onChange={(e) => setAnalysisText(e.target.value)}
                  rows={8}
                  className="flex w-full rounded-md border border-border bg-input px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>

              {/* Save button */}
              <div className="flex justify-end">
                <Button onClick={saveReport} disabled={isSaving || !analysisText.trim()} size="sm">
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  {isSaving ? "Saving..." : "Save Report"}
                </Button>
              </div>

              {/* Display saved analysis */}
              {analysisText && (
                <div className="rounded-md border border-border bg-muted/30 p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Analysis Preview</p>
                  <div className="text-sm text-foreground whitespace-pre-wrap">{analysisText}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
