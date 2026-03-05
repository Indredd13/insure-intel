"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MessageSquare, Plus, X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface Commentary {
  id: string;
  carrierId: string;
  source: string;
  category: string;
  quarter: number;
  year: number;
  title: string;
  content: string;
  sentiment: string;
  sourceDate: string;
  sourceUrl: string | null;
  createdAt: string;
}

interface CommentaryTabProps {
  carrierId: string;
}

const CATEGORY_FILTERS = [
  { key: "all", label: "All" },
  { key: "rate_commentary", label: "Rate" },
  { key: "reinsurance_signal", label: "Reinsurance" },
  { key: "reserve_development", label: "Reserves" },
  { key: "strategic_direction", label: "Strategy" },
  { key: "catastrophe_update", label: "Catastrophe" },
] as const;

const categoryBadgeColors: Record<string, string> = {
  rate_commentary: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  reinsurance_signal: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  reserve_development: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  strategic_direction: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  catastrophe_update: "bg-red-500/15 text-red-400 border-red-500/20",
};

const categoryLabels: Record<string, string> = {
  rate_commentary: "Rate Commentary",
  reinsurance_signal: "Reinsurance Signal",
  reserve_development: "Reserve Development",
  strategic_direction: "Strategic Direction",
  catastrophe_update: "Catastrophe Update",
};

const sourceLabels: Record<string, string> = {
  earnings_call: "Earnings Call",
  investor_day: "Investor Day",
  press_release: "Press Release",
  analyst_report: "Analyst Report",
};

const sentimentConfig: Record<string, { color: string; label: string }> = {
  positive: { color: "bg-emerald-400", label: "Positive" },
  neutral: { color: "bg-muted-foreground", label: "Neutral" },
  negative: { color: "bg-red-400", label: "Negative" },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const currentYear = new Date().getFullYear();

export function CommentaryTab({ carrierId }: CommentaryTabProps) {
  const [commentaries, setCommentaries] = useState<Commentary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formSource, setFormSource] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formQuarter, setFormQuarter] = useState("");
  const [formYear, setFormYear] = useState(currentYear.toString());
  const [formSentiment, setFormSentiment] = useState("neutral");
  const [formContent, setFormContent] = useState("");
  const [formSourceDate, setFormSourceDate] = useState("");
  const [formSourceUrl, setFormSourceUrl] = useState("");

  const fetchCommentaries = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/commentary?carrierId=${carrierId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCommentaries(data);
    } catch {
      // Silent — empty state handles it
    } finally {
      setIsLoading(false);
    }
  }, [carrierId]);

  useEffect(() => {
    fetchCommentaries();
  }, [fetchCommentaries]);

  const resetForm = () => {
    setFormTitle("");
    setFormSource("");
    setFormCategory("");
    setFormQuarter("");
    setFormYear(currentYear.toString());
    setFormSentiment("neutral");
    setFormContent("");
    setFormSourceDate("");
    setFormSourceUrl("");
  };

  const handleSubmit = async () => {
    if (!formTitle || !formSource || !formCategory || !formQuarter || !formContent || !formSourceDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/commentary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrierId,
          title: formTitle,
          source: formSource,
          category: formCategory,
          quarter: formQuarter,
          year: formYear,
          sentiment: formSentiment,
          content: formContent,
          sourceDate: formSourceDate,
          sourceUrl: formSourceUrl || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create commentary");
      }

      toast.success("Commentary added successfully");
      resetForm();
      setShowForm(false);
      await fetchCommentaries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add commentary");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCommentaries =
    categoryFilter === "all"
      ? commentaries
      : commentaries.filter((c) => c.category === categoryFilter);

  // Group commentaries by quarter
  const grouped = useMemo(() => {
    const groups = new Map<string, Commentary[]>();
    for (const c of filteredCommentaries) {
      const key = `Q${c.quarter} ${c.year}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }
    return groups;
  }, [filteredCommentaries]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Market Commentary</h3>
        <Button
          onClick={() => setShowForm(!showForm)}
          variant={showForm ? "outline" : "default"}
          size="sm"
        >
          {showForm ? (
            <>
              <X className="mr-2 h-3.5 w-3.5" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="mr-2 h-3.5 w-3.5" />
              Add Commentary
            </>
          )}
        </Button>
      </div>

      {/* Add Commentary Form */}
      {showForm && (
        <Card className="border-border bg-card">
          <CardContent className="space-y-4 pt-6">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Title *</label>
              <Input
                placeholder="e.g., Q4 2025 Earnings Call — Rate Environment Update"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="border-border bg-input"
              />
            </div>

            {/* Row: Source, Category, Quarter, Year */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Source *</label>
                <Select value={formSource} onValueChange={setFormSource}>
                  <SelectTrigger className="border-border bg-input">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="earnings_call">Earnings Call</SelectItem>
                    <SelectItem value="investor_day">Investor Day</SelectItem>
                    <SelectItem value="press_release">Press Release</SelectItem>
                    <SelectItem value="analyst_report">Analyst Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Category *</label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="border-border bg-input">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rate_commentary">Rate Commentary</SelectItem>
                    <SelectItem value="reinsurance_signal">Reinsurance Signal</SelectItem>
                    <SelectItem value="reserve_development">Reserve Development</SelectItem>
                    <SelectItem value="strategic_direction">Strategic Direction</SelectItem>
                    <SelectItem value="catastrophe_update">Catastrophe Update</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Quarter *</label>
                <Select value={formQuarter} onValueChange={setFormQuarter}>
                  <SelectTrigger className="border-border bg-input">
                    <SelectValue placeholder="Quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Q1</SelectItem>
                    <SelectItem value="2">Q2</SelectItem>
                    <SelectItem value="3">Q3</SelectItem>
                    <SelectItem value="4">Q4</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Year *</label>
                <Input
                  type="number"
                  min={2018}
                  max={currentYear + 1}
                  value={formYear}
                  onChange={(e) => setFormYear(e.target.value)}
                  className="border-border bg-input"
                />
              </div>
            </div>

            {/* Row: Date, Sentiment */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Source Date *</label>
                <Input
                  type="date"
                  value={formSourceDate}
                  onChange={(e) => setFormSourceDate(e.target.value)}
                  className="border-border bg-input"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Sentiment *</label>
                <div className="flex gap-2">
                  {(["positive", "neutral", "negative"] as const).map((s) => (
                    <Button
                      key={s}
                      variant={formSentiment === s ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFormSentiment(s)}
                      className={cn(
                        "flex-1 capitalize border-border",
                        formSentiment === s && s === "positive" && "bg-emerald-600 hover:bg-emerald-700 border-emerald-600",
                        formSentiment === s && s === "negative" && "bg-red-600 hover:bg-red-700 border-red-600"
                      )}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Commentary *</label>
              <textarea
                placeholder="Key takeaway or quote from the source..."
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={4}
                className="flex w-full rounded-md border border-border bg-input px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {/* Source URL */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Source URL (optional)</label>
              <Input
                type="url"
                placeholder="https://..."
                value={formSourceUrl}
                onChange={(e) => setFormSourceUrl(e.target.value)}
                className="border-border bg-input"
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save Commentary"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category filter */}
      <div className="flex gap-2">
        {CATEGORY_FILTERS.map((filter) => (
          <Button
            key={filter.key}
            variant={categoryFilter === filter.key ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter(filter.key)}
            className="border-border"
          >
            {filter.label}
            {filter.key !== "all" && (
              <span className="ml-1.5 text-xs opacity-60">
                {commentaries.filter((c) => c.category === filter.key).length}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <Card className="border-border bg-card">
          <CardContent className="flex h-48 items-center justify-center text-muted-foreground">
            Loading commentary...
          </CardContent>
        </Card>
      ) : commentaries.length === 0 ? (
        /* Empty state */
        <Card className="border-border bg-card">
          <CardContent className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
            <div>
              <h3 className="font-semibold text-foreground">No Commentary Yet</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-md">
                Add earnings call commentary, rate insights, reinsurance signals, and strategic
                direction notes to build a rich intelligence profile for this carrier.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : filteredCommentaries.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="flex h-48 items-center justify-center text-muted-foreground">
            No commentary matching this filter.
          </CardContent>
        </Card>
      ) : (
        /* Grouped commentary entries */
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([quarterLabel, entries]) => (
            <div key={quarterLabel} className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {quarterLabel}
              </h4>
              <div className="space-y-3">
                {entries.map((entry) => (
                  <Card key={entry.id} className="border-border bg-card">
                    <CardContent className="pt-5">
                      {/* Entry header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Sentiment dot */}
                          <div
                            className={cn(
                              "h-2 w-2 rounded-full shrink-0",
                              sentimentConfig[entry.sentiment]?.color || "bg-muted-foreground"
                            )}
                            title={sentimentConfig[entry.sentiment]?.label || entry.sentiment}
                          />
                          <h5 className="font-semibold text-foreground truncate">
                            {entry.title}
                          </h5>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className={categoryBadgeColors[entry.category] || "border-border text-muted-foreground"}
                          >
                            {categoryLabels[entry.category] || entry.category}
                          </Badge>
                          <Badge variant="outline" className="border-border text-muted-foreground">
                            {sourceLabels[entry.source] || entry.source}
                          </Badge>
                        </div>
                      </div>

                      {/* Content */}
                      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                        {entry.content}
                      </p>

                      {/* Footer: date + source link */}
                      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="tabular-nums">{formatDate(entry.sourceDate)}</span>
                        {entry.sourceUrl && (
                          <a
                            href={entry.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Source
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
