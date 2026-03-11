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
  Tag,
  TrendingUp,
  Users,
  Search,
  Hash,
  BarChart3,
  Loader2,
  Sparkles,
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
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ThemeInfo {
  id: string;
  label: string;
  color: string;
  chartColor: string;
}

interface KeywordDetail {
  keyword: string;
  themeId: string;
  totalCount: number;
  carrierCount: number;
  occurrences: Array<{
    carrierId: string;
    carrierName: string;
    year: number;
    sectionKey: string;
    count: number;
  }>;
}

interface ThemeData {
  trendByYear: Array<Record<string, number | string>>;
  byCarrier: Array<
    Record<string, number | string | null> & {
      carrierId: string;
      carrierName: string;
      carrierTicker: string | null;
      category: string;
    }
  >;
  keywordDetails: KeywordDetail[];
  themes: ThemeInfo[];
  totalSections: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  us_pc: "US P&C",
  global: "Global",
  reinsurer: "Reinsurer",
  auto_dealer_niche: "Auto Dealer",
};

const SECTION_LABELS: Record<string, string> = {
  item_1: "Business",
  item_1a: "Risk Factors",
  item_1b: "Staff Comments",
  item_1c: "Cybersecurity",
  item_7: "MD&A",
  item_7a: "Market Risk",
  item_8: "Financials",
};

// ─── Simple Markdown Renderer ───────────────────────────────────────────────

function renderBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="text-foreground font-semibold">{part}</strong> : part
  );
}

function renderAiMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(<h4 key={i} className="font-semibold text-sm mt-4 mb-1 text-emerald-300">{renderBold(line.slice(4))}</h4>);
    } else if (line.startsWith("## ")) {
      elements.push(<h3 key={i} className="font-bold text-base mt-5 mb-1 text-emerald-200">{renderBold(line.slice(3))}</h3>);
    } else if (line.startsWith("# ")) {
      elements.push(<h2 key={i} className="font-bold text-lg mt-5 mb-2 text-emerald-200">{renderBold(line.slice(2))}</h2>);
    } else if (line.match(/^[\-\*]\s/)) {
      elements.push(
        <div key={i} className="flex gap-2 ml-3 my-0.5">
          <span className="text-emerald-400">•</span>
          <span className="text-sm">{renderBold(line.slice(2))}</span>
        </div>
      );
    } else if (line.match(/^\d+\.\s/)) {
      const num = line.match(/^(\d+)\.\s/)![1];
      const content = line.replace(/^\d+\.\s/, "");
      elements.push(
        <div key={i} className="flex gap-2 ml-3 my-0.5">
          <span className="text-emerald-400 min-w-[1.2rem] text-sm">{num}.</span>
          <span className="text-sm">{renderBold(content)}</span>
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="my-1 text-sm leading-relaxed">{renderBold(line)}</p>);
    }
  }

  return elements;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ThemesPage() {
  const [data, setData] = useState<ThemeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState<string>("all");
  const [keywordSearch, setKeywordSearch] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    fetch("/api/themes/scan")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => toast.error("Failed to load theme data"))
      .finally(() => setLoading(false));
  }, []);

  // Filtered keyword details
  const filteredKeywords = useMemo(() => {
    if (!data) return [];
    let keywords = data.keywordDetails;

    if (selectedTheme !== "all") {
      keywords = keywords.filter((k) => k.themeId === selectedTheme);
    }

    if (keywordSearch) {
      const search = keywordSearch.toLowerCase();
      keywords = keywords.filter(
        (k) =>
          k.keyword.includes(search) ||
          k.occurrences.some((o) =>
            o.carrierName.toLowerCase().includes(search)
          )
      );
    }

    return keywords;
  }, [data, selectedTheme, keywordSearch]);

  // Top theme by total mentions
  const topTheme = useMemo(() => {
    if (!data) return null;
    const totals = data.themes.map((t) => ({
      ...t,
      total: data.trendByYear.reduce(
        (sum, yr) => sum + ((yr[t.id] as number) || 0),
        0
      ),
    }));
    totals.sort((a, b) => b.total - a.total);
    return totals[0] ?? null;
  }, [data]);

  const totalMentions = useMemo(() => {
    if (!data) return 0;
    return data.keywordDetails.reduce((s, k) => s + k.totalCount, 0);
  }, [data]);

  const totalKeywordsFound = useMemo(() => {
    if (!data) return 0;
    return data.keywordDetails.length;
  }, [data]);

  // ─── AI Theme Analysis ─────────────────────────────────────────────

  const handleAiThemeScan = async () => {
    if (!data) return;

    setIsAnalyzing(true);
    setAiAnalysis(null);

    try {
      const settings = localStorage.getItem("insure-intel-settings");
      const parsed = settings ? JSON.parse(settings) : null;
      const apiKey = parsed?.aiApiKey;

      if (!apiKey) {
        toast.error("No API key configured. Go to Settings to add your Gemini API key.");
        setIsAnalyzing(false);
        return;
      }

      // Format trend data for the prompt
      const trendTable = data.trendByYear
        .map((yr) => {
          const cols = data.themes.map((t) => `${t.label}: ${yr[t.id] || 0}`);
          return `  ${yr.year}: ${cols.join(", ")}`;
        })
        .join("\n");

      // Top 15 carriers
      const carrierTable = data.byCarrier
        .slice(0, 15)
        .map((c) => {
          const themeCounts = data.themes
            .map((t) => `${t.label}: ${(c[t.id] as number) || 0}`)
            .join(", ");
          return `  ${c.carrierName} (${c.carrierTicker || "N/A"}, ${CATEGORY_LABELS[c.category as string] || c.category}): ${themeCounts}`;
        })
        .join("\n");

      // Top 40 keywords
      const keywordTable = data.keywordDetails
        .slice(0, 40)
        .map((k) => {
          const theme = data.themes.find((t) => t.id === k.themeId);
          const carriers = [...new Set(k.occurrences.map((o) => o.carrierName))].slice(0, 5);
          return `  "${k.keyword}" [${theme?.label || k.themeId}]: ${k.totalCount} mentions across ${k.carrierCount} carriers (${carriers.join(", ")}${k.carrierCount > 5 ? "..." : ""})`;
        })
        .join("\n");

      const prompt = `You are an expert insurance industry analyst. Below is theme tracking data extracted from SEC 10-K filings across ${data.byCarrier.length} insurance carriers, covering ${data.totalSections} filing sections.

THEMES TRACKED: ${data.themes.map((t) => t.label).join(", ")}

THEME TRENDS BY YEAR:
${trendTable}

TOP 15 CARRIERS BY THEME MENTIONS:
${carrierTable}

TOP 40 KEYWORDS WITH HIGHEST FREQUENCY:
${keywordTable}

Based on this data, provide a comprehensive industry intelligence briefing:

## Emerging Trends
What themes are growing fastest? What does the year-over-year trajectory reveal about where the insurance industry is heading?

## Carrier Positioning
Which carriers are leading in specific themes? Are there notable outliers or laggards? What does their theme focus reveal about their strategy?

## Risk Landscape Evolution
How is the industry's risk disclosure profile evolving? Are new risk categories emerging while others fade? What should underwriters watch?

## Market Signals
What do the keyword patterns suggest about upcoming market shifts — pricing cycles, capacity changes, regulatory developments?

## Strategic Recommendations
Based on these patterns, what should insurance professionals (underwriters, brokers, analysts) be watching for? What competitive advantages can be gained from these insights?

Write for a senior insurance professional who needs actionable competitive intelligence. Be specific — reference actual carriers and keywords from the data. Use bullet points where appropriate.`;

      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, apiKey }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "AI analysis failed");
      setAiAnalysis(result.text);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "AI analysis failed";
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Scanning filing sections for themes...
      </div>
    );
  }

  if (!data || data.totalSections === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Tag className="h-8 w-8 text-primary" />
            Theme Tracking
          </h1>
          <p className="mt-1 text-muted-foreground">
            Track insurance industry signal terms across SEC filings
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Tag className="h-12 w-12 mb-4 opacity-30" />
          <p className="mb-2">No filing sections extracted yet</p>
          <p className="text-sm">
            Go to Filing Analysis and extract sections for carriers first
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Tag className="h-8 w-8 text-primary" />
          Theme Tracking
        </h1>
        <p className="mt-1 text-muted-foreground">
          Track insurance industry signal terms across {data.totalSections}{" "}
          filing sections from {data.byCarrier.length} carriers
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Mentions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalMentions.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              keyword hits across all filings
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Keywords Found</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalKeywordsFound}</div>
            <p className="text-xs text-muted-foreground">
              distinct keywords detected
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Top Theme</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: topTheme?.chartColor }}>
              {topTheme?.label ?? "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              {topTheme?.total.toLocaleString() ?? 0} mentions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Themes Tracked</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.themes.length}</div>
            <p className="text-xs text-muted-foreground">
              industry signal categories
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trends" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="trends" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Industry Trends
          </TabsTrigger>
          <TabsTrigger value="carriers" className="gap-2">
            <Users className="h-4 w-4" />
            By Carrier
          </TabsTrigger>
          <TabsTrigger value="keywords" className="gap-2">
            <Search className="h-4 w-4" />
            Keyword Explorer
          </TabsTrigger>
          <TabsTrigger value="ai-intelligence" className="gap-2">
            <Sparkles className="h-4 w-4" />
            AI Intelligence
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════
            TAB 1: Industry Trends
            ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-400" />
                Theme Frequency Over Time
              </CardTitle>
              <CardDescription>
                Keyword mentions by theme across all carriers&apos; 10-K filings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.trendByYear.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={data.trendByYear}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    {data.themes.map((theme) => (
                      <Line
                        key={theme.id}
                        type="monotone"
                        dataKey={theme.id}
                        name={theme.label}
                        stroke={theme.chartColor}
                        strokeWidth={2}
                        dot={{ fill: theme.chartColor, r: 3 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-10 text-center text-muted-foreground">
                  No trend data available
                </p>
              )}
            </CardContent>
          </Card>

          {/* Theme legend with totals */}
          <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
            {data.themes.map((theme) => {
              const total = data.trendByYear.reduce(
                (sum, yr) => sum + ((yr[theme.id] as number) || 0),
                0
              );
              return (
                <Card key={theme.id} className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: theme.chartColor }}
                    />
                    <span className="text-xs font-medium truncate">
                      {theme.label}
                    </span>
                  </div>
                  <div className="text-lg font-bold">
                    {total.toLocaleString()}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════
            TAB 2: By Carrier
            ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="carriers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-400" />
                Theme Distribution by Carrier
              </CardTitle>
              <CardDescription>
                Total keyword mentions per carrier, broken down by theme
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.byCarrier.length > 0 ? (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(400, data.byCarrier.length * 35)}
                >
                  <BarChart
                    data={data.byCarrier.slice(0, 20)}
                    layout="vertical"
                    margin={{ left: 120 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis
                      type="category"
                      dataKey="carrierName"
                      width={110}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    {data.themes.map((theme) => (
                      <Bar
                        key={theme.id}
                        dataKey={theme.id}
                        name={theme.label}
                        fill={theme.chartColor}
                        stackId="themes"
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-10 text-center text-muted-foreground">
                  No carrier data available
                </p>
              )}
            </CardContent>
          </Card>

          {/* Carrier table */}
          <Card>
            <CardHeader>
              <CardTitle>Carrier Theme Breakdown</CardTitle>
              <CardDescription>
                Mention counts by theme for each carrier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Segment</TableHead>
                      {data.themes.map((t) => (
                        <TableHead
                          key={t.id}
                          className="text-right text-xs"
                        >
                          {t.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byCarrier.slice(0, 30).map((carrier) => (
                      <TableRow key={carrier.carrierId}>
                        <TableCell className="font-medium">
                          {carrier.carrierName}
                          {carrier.carrierTicker && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              ({carrier.carrierTicker})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {CATEGORY_LABELS[carrier.category as string] ||
                              carrier.category}
                          </Badge>
                        </TableCell>
                        {data.themes.map((t) => {
                          const val = (carrier[t.id] as number) || 0;
                          return (
                            <TableCell
                              key={t.id}
                              className="text-right font-mono text-sm"
                            >
                              {val > 0 ? (
                                <span style={{ color: t.chartColor }}>
                                  {val}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════
            TAB 3: Keyword Explorer
            ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="keywords" className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Filter by Theme
              </label>
              <select
                value={selectedTheme}
                onChange={(e) => setSelectedTheme(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Themes</option>
                {data.themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Search Keywords / Carriers
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={keywordSearch}
                  onChange={(e) => setKeywordSearch(e.target.value)}
                  placeholder="e.g. social inflation, Chubb..."
                  className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Keywords table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-amber-400" />
                Keyword Details
              </CardTitle>
              <CardDescription>
                {filteredKeywords.length} keywords found —{" "}
                click a row to see which carriers mention it
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Keyword</TableHead>
                      <TableHead>Theme</TableHead>
                      <TableHead className="text-right">
                        Total Mentions
                      </TableHead>
                      <TableHead className="text-right">
                        Carriers
                      </TableHead>
                      <TableHead>Found In</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredKeywords.slice(0, 50).map((kw) => {
                      const theme = data.themes.find(
                        (t) => t.id === kw.themeId
                      );
                      // Unique carriers
                      const uniqueCarriers = [
                        ...new Set(kw.occurrences.map((o) => o.carrierName)),
                      ];
                      // Unique sections
                      const uniqueSections = [
                        ...new Set(kw.occurrences.map((o) => o.sectionKey)),
                      ];

                      return (
                        <TableRow key={kw.keyword}>
                          <TableCell className="font-medium">
                            &ldquo;{kw.keyword}&rdquo;
                          </TableCell>
                          <TableCell>
                            {theme && (
                              <Badge
                                variant="outline"
                                className={cn("text-xs", theme.color)}
                              >
                                {theme.label}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {kw.totalCount}
                          </TableCell>
                          <TableCell className="text-right">
                            {kw.carrierCount}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {uniqueSections.map((s) => (
                                <Badge
                                  key={s}
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {SECTION_LABELS[s] || s}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {filteredKeywords.length > 50 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Showing top 50 of {filteredKeywords.length} keywords
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════
            TAB 4: AI Intelligence
            ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="ai-intelligence" className="space-y-6">
          <Card className="border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 to-transparent">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-400" />
                    Cross-Carrier AI Intelligence
                  </CardTitle>
                  <CardDescription className="mt-1">
                    AI-powered analysis of theme patterns across {data.byCarrier.length} carriers
                    and {data.totalSections} filing sections — powered by Google Gemini
                  </CardDescription>
                </div>
                <button
                  onClick={handleAiThemeScan}
                  disabled={isAnalyzing}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all shrink-0",
                    "bg-gradient-to-r from-emerald-600 to-teal-600 text-white",
                    "hover:from-emerald-700 hover:to-teal-700 hover:shadow-lg hover:shadow-emerald-500/25",
                    isAnalyzing && "opacity-70 cursor-not-allowed"
                  )}
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isAnalyzing ? "Scanning..." : aiAnalysis ? "Re-scan with AI" : "Run AI Intelligence Scan"}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-4 text-emerald-400" />
                  <p className="font-medium">Running cross-carrier intelligence scan...</p>
                  <p className="text-xs mt-1">
                    Analyzing {data.byCarrier.length} carriers × {data.themes.length} themes — this may take 15-30 seconds
                  </p>
                </div>
              ) : aiAnalysis ? (
                <div className="max-h-[900px] overflow-y-auto rounded-lg border border-emerald-500/10 bg-muted/30 p-6">
                  {renderAiMarkdown(aiAnalysis)}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mb-4 opacity-30" />
                  <p className="mb-2">
                    Click &ldquo;Run AI Intelligence Scan&rdquo; to analyze cross-carrier theme patterns
                  </p>
                  <p className="text-sm text-center max-w-lg">
                    Gemini AI will review keyword frequency data across all {data.byCarrier.length} carriers
                    to identify emerging trends, carrier positioning, and strategic market signals you
                    can use for competitive advantage.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
