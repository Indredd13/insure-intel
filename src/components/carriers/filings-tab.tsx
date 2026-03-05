"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { RefreshCw, ExternalLink, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface Filing {
  id: string;
  accessionNumber: string;
  formType: string;
  filingDate: string;
  reportDate: string | null;
  primaryDocument: string | null;
  description: string | null;
  edgarUrl: string | null;
}

interface FilingsTabProps {
  carrierId: string;
  cikNumber: string | null;
  edgarLastSyncedAt: string | null;
  onSyncComplete: () => void;
}

const FORM_FILTERS = ["All", "10-K", "10-Q", "8-K"] as const;

const formBadgeColors: Record<string, string> = {
  "10-K": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "10-Q": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "8-K": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "10-K/A": "bg-blue-500/10 text-blue-300 border-blue-500/15",
  "10-Q/A": "bg-emerald-500/10 text-emerald-300 border-emerald-500/15",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function FilingsTab({ carrierId, cikNumber, edgarLastSyncedAt, onSyncComplete }: FilingsTabProps) {
  const [filings, setFilings] = useState<Filing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [formFilter, setFormFilter] = useState<string>("All");

  const fetchFilings = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/filings?carrierId=${carrierId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setFilings(data);
    } catch {
      // Silent — empty state handles it
    } finally {
      setIsLoading(false);
    }
  }, [carrierId]);

  useEffect(() => {
    fetchFilings();
  }, [fetchFilings]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/filings/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrierId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Sync failed");
      }
      const data = await res.json();
      toast.success(data.message);
      await fetchFilings();
      onSyncComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync EDGAR data");
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredFilings =
    formFilter === "All"
      ? filings
      : filings.filter((f) => f.formType === formFilter);

  // No CIK — show info message
  if (!cikNumber) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex h-64 flex-col items-center justify-center gap-3 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/50" />
          <div>
            <h3 className="font-semibold text-foreground">No SEC Filings Available</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md">
              EDGAR filing data is only available for SEC-reporting (publicly traded) carriers.
              This company does not have a CIK number on file.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">SEC Filings</h3>
          {edgarLastSyncedAt && (
            <p className="text-xs text-muted-foreground">
              Last synced: {formatDate(edgarLastSyncedAt)}
            </p>
          )}
        </div>
        <Button
          onClick={handleSync}
          disabled={isSyncing}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isSyncing && "animate-spin")} />
          {isSyncing ? "Syncing..." : "Fetch from EDGAR"}
        </Button>
      </div>

      {/* Form type filter */}
      <div className="flex gap-2">
        {FORM_FILTERS.map((filter) => (
          <Button
            key={filter}
            variant={formFilter === filter ? "default" : "outline"}
            size="sm"
            onClick={() => setFormFilter(filter)}
            className="border-border"
          >
            {filter}
            {filter !== "All" && (
              <span className="ml-1.5 text-xs opacity-60">
                {filings.filter((f) => f.formType === filter).length}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading ? (
        <Card className="border-border bg-card">
          <CardContent className="flex h-48 items-center justify-center text-muted-foreground">
            Loading filings...
          </CardContent>
        </Card>
      ) : filings.length === 0 ? (
        /* Empty state */
        <Card className="border-border bg-card">
          <CardContent className="flex h-48 flex-col items-center justify-center gap-3 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/50" />
            <div>
              <p className="font-medium">No filings synced yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Click &quot;Fetch from EDGAR&quot; to pull SEC filings for this carrier.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Filing table */
        <Card className="border-border bg-card p-0">
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {filteredFilings.length} filing{filteredFilings.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground font-semibold">Filing Date</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Form</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Report Date</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Description</TableHead>
                  <TableHead className="text-muted-foreground font-semibold w-[80px]">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFilings.map((filing) => (
                  <TableRow key={filing.id} className="border-border">
                    <TableCell className="font-mono text-sm tabular-nums">
                      {formatDate(filing.filingDate)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={formBadgeColors[filing.formType] || "border-border text-muted-foreground"}
                      >
                        {filing.formType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {filing.reportDate ? formatDate(filing.reportDate) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                      {filing.description || "—"}
                    </TableCell>
                    <TableCell>
                      {filing.edgarUrl && (
                        <a
                          href={filing.edgarUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          SEC
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
