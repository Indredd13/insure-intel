"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  FileSearch,
  Plus,
  Minus,
  Percent,
  FileText,
  Loader2,
  Download,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Carrier {
  id: string;
  name: string;
  ticker: string | null;
  category: string;
}

interface FilingInfo {
  id: string;
  filingDate: string;
  reportDate: string | null;
  formType: string;
  sectionsExtractedAt: string | null;
  sectionKeys: string[];
}

interface DiffSegment {
  value: string;
  type: "added" | "removed" | "unchanged";
}

interface DiffStats {
  addedWords: number;
  removedWords: number;
  unchangedWords: number;
  changePercent: number;
}

interface DiffData {
  carrierName: string;
  carrierTicker: string | null;
  sectionKey: string;
  sectionTitle: string;
  oldFiling: { id: string; year: number; filingDate: string; wordCount: number };
  newFiling: { id: string; year: number; filingDate: string; wordCount: number };
  diff: DiffSegment[];
  stats: DiffStats;
}

// ─── Section Labels ─────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  item_1: "Business",
  item_1a: "Risk Factors",
  item_1b: "Staff Comments",
  item_1c: "Cybersecurity",
  item_2: "Properties",
  item_3: "Legal",
  item_7: "MD&A",
  item_7a: "Market Risk",
  item_8: "Financials",
  item_9: "Accountants",
  item_9a: "Controls",
  item_9b: "Other Info",
};

// Sections most useful for insurance intelligence
const PRIORITY_SECTIONS = ["item_1a", "item_7", "item_7a", "item_1"];

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
      elements.push(<h4 key={i} className="font-semibold text-sm mt-4 mb-1 text-violet-300">{renderBold(line.slice(4))}</h4>);
    } else if (line.startsWith("## ")) {
      elements.push(<h3 key={i} className="font-bold text-base mt-5 mb-1 text-violet-200">{renderBold(line.slice(3))}</h3>);
    } else if (line.startsWith("# ")) {
      elements.push(<h2 key={i} className="font-bold text-lg mt-5 mb-2 text-violet-200">{renderBold(line.slice(2))}</h2>);
    } else if (line.match(/^[\-\*]\s/)) {
      elements.push(
        <div key={i} className="flex gap-2 ml-3 my-0.5">
          <span className="text-violet-400">•</span>
          <span className="text-sm">{renderBold(line.slice(2))}</span>
        </div>
      );
    } else if (line.match(/^\d+\.\s/)) {
      const num = line.match(/^(\d+)\.\s/)![1];
      const content = line.replace(/^\d+\.\s/, "");
      elements.push(
        <div key={i} className="flex gap-2 ml-3 my-0.5">
          <span className="text-violet-400 min-w-[1.2rem] text-sm">{num}.</span>
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

export default function FilingAnalysisPage() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>("");
  const [filings, setFilings] = useState<FilingInfo[]>([]);
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>("item_1a");
  const [diffData, setDiffData] = useState<DiffData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [loadingCarriers, setLoadingCarriers] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Fetch carriers on mount
  useEffect(() => {
    fetch("/api/carriers")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.carriers ?? [];
        // Only show carriers that have a CIK (can have SEC filings)
        setCarriers(list.filter((c: Carrier & { cikNumber?: string }) => c.cikNumber));
      })
      .catch(() => toast.error("Failed to load carriers"))
      .finally(() => setLoadingCarriers(false));
  }, []);

  // Fetch filings when carrier is selected
  useEffect(() => {
    if (!selectedCarrierId) {
      setFilings([]);
      setAvailableSections([]);
      setDiffData(null);
      return;
    }

    fetch(`/api/filings?carrierId=${selectedCarrierId}&formType=10-K`)
      .then((res) => res.json())
      .then((data) => {
        const filingList = Array.isArray(data) ? data : data.filings ?? [];
        setFilings(filingList);

        // Find sections available across extracted filings
        const extractedFilings = filingList.filter(
          (f: FilingInfo) => f.sectionsExtractedAt
        );

        if (extractedFilings.length >= 2) {
          // Fetch section keys for the extracted filings
          fetchAvailableSections(selectedCarrierId);
        } else {
          setAvailableSections([]);
        }
      })
      .catch(() => toast.error("Failed to load filings"));
  }, [selectedCarrierId]);

  const fetchAvailableSections = useCallback(async (carrierId: string) => {
    try {
      // Get all filings with sections for this carrier
      const filingsRes = await fetch(
        `/api/filings?carrierId=${carrierId}&formType=10-K`
      );
      const filingsData = await filingsRes.json();
      const filingList = Array.isArray(filingsData)
        ? filingsData
        : filingsData.filings ?? [];

      const extracted = filingList.filter(
        (f: FilingInfo) => f.sectionsExtractedAt
      );

      if (extracted.length < 2) {
        setAvailableSections([]);
        return;
      }

      // Fetch sections for the two most recent extracted filings
      const [sections1, sections2] = await Promise.all([
        fetch(`/api/filing-sections?filingId=${extracted[0].id}`).then((r) =>
          r.json()
        ),
        fetch(`/api/filing-sections?filingId=${extracted[1].id}`).then((r) =>
          r.json()
        ),
      ]);

      const keys1 = new Set(
        (sections1 as Array<{ sectionKey: string }>).map((s) => s.sectionKey)
      );
      const keys2 = new Set(
        (sections2 as Array<{ sectionKey: string }>).map((s) => s.sectionKey)
      );

      // Sections available in both filings
      const common = [...keys1].filter((k) => keys2.has(k));

      // Sort by priority
      const sorted = common.sort((a, b) => {
        const ai = PRIORITY_SECTIONS.indexOf(a);
        const bi = PRIORITY_SECTIONS.indexOf(b);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.localeCompare(b);
      });

      setAvailableSections(sorted);

      // Auto-select first priority section
      if (sorted.length > 0 && !sorted.includes(selectedSection)) {
        setSelectedSection(sorted[0]);
      }
    } catch {
      setAvailableSections([]);
    }
  }, [selectedSection]);

  // Fetch diff when section changes
  useEffect(() => {
    if (!selectedCarrierId || !selectedSection || availableSections.length === 0)
      return;
    if (!availableSections.includes(selectedSection)) return;

    setIsLoading(true);
    setDiffData(null);
    setAiAnalysis(null);

    fetch(
      `/api/filing-analysis/diff?carrierId=${selectedCarrierId}&sectionKey=${selectedSection}`
    )
      .then((res) => {
        if (!res.ok) throw new Error("No diff available");
        return res.json();
      })
      .then((data) => setDiffData(data))
      .catch(() => toast.error("Failed to load diff"))
      .finally(() => setIsLoading(false));
  }, [selectedCarrierId, selectedSection, availableSections]);

  // Extract sections for selected carrier
  const handleExtract = async () => {
    if (!selectedCarrierId) return;
    setIsExtracting(true);
    try {
      const res = await fetch("/api/filing-sections/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrierId: selectedCarrierId }),
      });
      const data = await res.json();
      toast.success(data.message || "Sections extracted");

      if (data.errors?.length > 0) {
        for (const err of data.errors.slice(0, 3)) {
          toast.warning(err);
        }
      }

      // Refresh filings and sections
      const filingsRes = await fetch(
        `/api/filings?carrierId=${selectedCarrierId}&formType=10-K`
      );
      const filingsData = await filingsRes.json();
      setFilings(
        Array.isArray(filingsData) ? filingsData : filingsData.filings ?? []
      );
      await fetchAvailableSections(selectedCarrierId);
    } catch {
      toast.error("Extraction failed");
    } finally {
      setIsExtracting(false);
    }
  };

  // ─── AI Analysis ───────────────────────────────────────────────────

  const handleAiAnalysis = async () => {
    if (!diffData) return;

    setIsAnalyzing(true);
    setAiAnalysis(null);

    try {
      // Get API key from localStorage
      const settings = localStorage.getItem("insure-intel-settings");
      const parsed = settings ? JSON.parse(settings) : null;
      const apiKey = parsed?.aiApiKey;

      if (!apiKey) {
        toast.error("No API key configured. Go to Settings to add your Gemini API key.");
        setIsAnalyzing(false);
        return;
      }

      // Reconstruct old and new text from diff segments
      const oldText = diffData.diff
        .filter((s) => s.type === "unchanged" || s.type === "removed")
        .map((s) => s.value)
        .join("");
      const newText = diffData.diff
        .filter((s) => s.type === "unchanged" || s.type === "added")
        .map((s) => s.value)
        .join("");

      // Truncate if extremely large (safety valve — Gemini handles 1M tokens)
      const maxChars = 120000;
      const truncOld = oldText.length > maxChars ? oldText.slice(0, maxChars) + "\n\n[TRUNCATED — section exceeded 120k characters]" : oldText;
      const truncNew = newText.length > maxChars ? newText.slice(0, maxChars) + "\n\n[TRUNCATED — section exceeded 120k characters]" : newText;

      const prompt = `You are an expert insurance industry analyst reviewing SEC 10-K filing changes for ${diffData.carrierName}${diffData.carrierTicker ? ` (${diffData.carrierTicker})` : ""}.

SECTION: ${diffData.sectionTitle} (${diffData.sectionKey})
COMPARISON: FY${diffData.oldFiling.year} → FY${diffData.newFiling.year}

CHANGE STATISTICS:
- Words added: ${diffData.stats.addedWords.toLocaleString()}
- Words removed: ${diffData.stats.removedWords.toLocaleString()}
- Change rate: ${diffData.stats.changePercent}%
- New section size: ${diffData.newFiling.wordCount.toLocaleString()} words (was ${diffData.oldFiling.wordCount.toLocaleString()})

══════════════════════════════════════
PREVIOUS YEAR (FY${diffData.oldFiling.year}) FILING TEXT:
══════════════════════════════════════
${truncOld}

══════════════════════════════════════
CURRENT YEAR (FY${diffData.newFiling.year}) FILING TEXT:
══════════════════════════════════════
${truncNew}

Provide a strategic intelligence briefing analyzing the changes between these two filing years. Structure your analysis as follows:

## Key Changes Summary
What are the most significant additions and removals? What topics were newly introduced or dropped?

## Strategic Signals
What do these changes reveal about the carrier's strategic direction, risk appetite, or market positioning?

## Risk Assessment
Are there new risks being disclosed or previous risks being downplayed? What regulatory or market concerns are emerging?

## Industry Implications
How do these changes reflect broader insurance industry trends (e.g., climate risk, social inflation, cyber exposure, InsurTech disruption, reserve strengthening)?

## Competitive Intelligence
What can competitors or market analysts infer from these disclosure changes? What competitive advantages or vulnerabilities are revealed?

Keep the analysis concise but insightful. Write for an insurance professional who needs actionable intelligence. Use bullet points where appropriate.`;

      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, apiKey }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI analysis failed");
      setAiAnalysis(data.text);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "AI analysis failed";
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ─── Counts ─────────────────────────────────────────────────────────

  const extractedCount = filings.filter((f) => f.sectionsExtractedAt).length;
  const totalTenKs = filings.length;

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <FileSearch className="h-8 w-8 text-primary" />
          Filing Text Analysis
        </h1>
        <p className="mt-1 text-muted-foreground">
          Compare how carriers change their 10-K disclosures year over year
        </p>
      </div>

      {/* Carrier selector + Extract button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[250px]">
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Select Carrier
              </label>
              <select
                value={selectedCarrierId}
                onChange={(e) => setSelectedCarrierId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                disabled={loadingCarriers}
              >
                <option value="">
                  {loadingCarriers ? "Loading..." : "Choose a carrier..."}
                </option>
                {carriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.ticker ? ` (${c.ticker})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedCarrierId && (
              <>
                <div className="text-sm text-muted-foreground">
                  {extractedCount}/{totalTenKs} 10-Ks extracted
                </div>
                <button
                  onClick={handleExtract}
                  disabled={isExtracting || totalTenKs === 0}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                    (isExtracting || totalTenKs === 0) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isExtracting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {isExtracting
                    ? "Extracting..."
                    : extractedCount === totalTenKs
                    ? "Re-extract Sections"
                    : "Extract Sections"}
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* No carrier selected */}
      {!selectedCarrierId && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FileSearch className="h-12 w-12 mb-4 opacity-30" />
          <p>Select a carrier to analyze their 10-K filing changes</p>
        </div>
      )}

      {/* Carrier selected but no sections */}
      {selectedCarrierId && availableSections.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FileText className="h-12 w-12 mb-4 opacity-30" />
          <p className="mb-2">
            {extractedCount === 0
              ? "No sections extracted yet"
              : "Need at least 2 extracted filings to compare"}
          </p>
          <p className="text-sm">
            Click &ldquo;Extract Sections&rdquo; to pull text from SEC filings
          </p>
        </div>
      )}

      {/* Section tabs + diff viewer */}
      {selectedCarrierId && availableSections.length > 0 && (
        <Tabs
          value={selectedSection}
          onValueChange={setSelectedSection}
          className="space-y-6"
        >
          <TabsList className="flex flex-wrap h-auto gap-1">
            {availableSections.map((key) => (
              <TabsTrigger key={key} value={key} className="text-xs">
                {SECTION_LABELS[key] || key}
              </TabsTrigger>
            ))}
          </TabsList>

          {availableSections.map((key) => (
            <TabsContent key={key} value={key} className="space-y-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Computing diff...
                </div>
              ) : diffData && diffData.sectionKey === key ? (
                <>
                  {/* Filing years */}
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Badge variant="outline">
                      FY{diffData.oldFiling.year} 10-K
                    </Badge>
                    <ArrowRight className="h-4 w-4" />
                    <Badge variant="outline">
                      FY{diffData.newFiling.year} 10-K
                    </Badge>
                    <span className="ml-auto">
                      {diffData.sectionTitle}
                    </span>
                  </div>

                  {/* Stats cards */}
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Words Added</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          <Plus className="h-4 w-4 text-emerald-400" />
                          <span className="text-2xl font-bold text-emerald-400">
                            {diffData.stats.addedWords.toLocaleString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Words Removed</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          <Minus className="h-4 w-4 text-red-400" />
                          <span className="text-2xl font-bold text-red-400">
                            {diffData.stats.removedWords.toLocaleString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Change Rate</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          <Percent className="h-4 w-4 text-amber-400" />
                          <span className="text-2xl font-bold">
                            {diffData.stats.changePercent}%
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Section Size</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {diffData.newFiling.wordCount.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          words (was{" "}
                          {diffData.oldFiling.wordCount.toLocaleString()})
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Diff viewer */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-4">
                        <CardTitle className="text-base">
                          Changes: {SECTION_LABELS[key] || key}
                        </CardTitle>
                        <button
                          onClick={handleAiAnalysis}
                          disabled={isAnalyzing}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                            "bg-gradient-to-r from-violet-600 to-indigo-600 text-white",
                            "hover:from-violet-700 hover:to-indigo-700 hover:shadow-lg hover:shadow-violet-500/25",
                            isAnalyzing && "opacity-70 cursor-not-allowed"
                          )}
                        >
                          {isAnalyzing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          {isAnalyzing ? "Analyzing..." : "Analyze with AI"}
                        </button>
                      </div>
                      <CardDescription>
                        <span className="inline-block rounded bg-emerald-500/20 px-1.5 text-emerald-300">
                          Added text
                        </span>{" "}
                        <span className="inline-block rounded bg-red-500/20 px-1.5 text-red-300 line-through">
                          Removed text
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[600px] overflow-y-auto rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                        {diffData.diff.map((seg, i) => (
                          <span
                            key={i}
                            className={cn(
                              seg.type === "added" &&
                                "rounded bg-emerald-500/20 text-emerald-300",
                              seg.type === "removed" &&
                                "rounded bg-red-500/20 text-red-300 line-through"
                            )}
                          >
                            {seg.value}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* AI Analysis */}
                  {(aiAnalysis || isAnalyzing) && (
                    <Card className="border-violet-500/30 bg-gradient-to-b from-violet-950/20 to-transparent">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Sparkles className="h-5 w-5 text-violet-400" />
                          AI Intelligence Briefing
                        </CardTitle>
                        <CardDescription>
                          Powered by Google Gemini — {diffData.carrierName}{" "}
                          {diffData.sectionTitle} (FY{diffData.oldFiling.year} → FY{diffData.newFiling.year})
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {isAnalyzing ? (
                          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin mb-3 text-violet-400" />
                            <p>Analyzing filing changes with Gemini AI...</p>
                            <p className="text-xs mt-1">This may take 15-30 seconds</p>
                          </div>
                        ) : aiAnalysis ? (
                          <div className="max-h-[800px] overflow-y-auto rounded-lg border border-violet-500/10 bg-muted/30 p-5">
                            {renderAiMarkdown(aiAnalysis)}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : null}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
