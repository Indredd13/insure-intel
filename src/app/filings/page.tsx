"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  carrierId: string;
  accessionNumber: string;
  formType: string;
  filingDate: string;
  reportDate: string | null;
  primaryDocument: string | null;
  description: string | null;
  edgarUrl: string | null;
  carrier?: {
    name: string;
    ticker: string | null;
    id: string;
  };
}

const formTypeColors: Record<string, string> = {
  "10-K": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "10-Q": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "8-K": "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

export default function FilingsPage() {
  const [filings, setFilings] = useState<Filing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [formTypeFilter, setFormTypeFilter] = useState("all");

  const fetchFilings = async (formType?: string) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (formType && formType !== "all") {
        params.set("formType", formType);
      }
      const res = await fetch(`/api/filings?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch filings");
      const data = await res.json();
      setFilings(data);
    } catch {
      toast.error("Failed to load filings");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFilings(formTypeFilter);
  }, [formTypeFilter]);

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/filings/fetch-all", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      const data = await res.json();
      toast.success(data.message);
      await fetchFilings(formTypeFilter);
    } catch {
      toast.error("Failed to sync EDGAR data");
    } finally {
      setIsSyncing(false);
    }
  };

  const formTypeCounts = {
    all: filings.length,
    "10-K": filings.filter((f) => f.formType === "10-K").length,
    "10-Q": filings.filter((f) => f.formType === "10-Q").length,
    "8-K": filings.filter((f) => f.formType === "8-K").length,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SEC Filings</h1>
          <p className="mt-1 text-muted-foreground">
            Cross-carrier EDGAR filing feed — latest filings across all tracked carriers
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleSyncAll}
          disabled={isSyncing}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
          {isSyncing ? "Syncing..." : "Sync All from EDGAR"}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Filings", count: formTypeCounts.all, color: "text-foreground" },
          { label: "10-K (Annual)", count: formTypeCounts["10-K"], color: "text-blue-400" },
          { label: "10-Q (Quarterly)", count: formTypeCounts["10-Q"], color: "text-emerald-400" },
          { label: "8-K (Current)", count: formTypeCounts["8-K"], color: "text-amber-400" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border bg-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className={cn("mt-1 text-2xl font-bold", stat.color)}>
                {stat.count}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={formTypeFilter} onValueChange={setFormTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Form Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Form Types</SelectItem>
            <SelectItem value="10-K">10-K (Annual)</SelectItem>
            <SelectItem value="10-Q">10-Q (Quarterly)</SelectItem>
            <SelectItem value="8-K">8-K (Current)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filings Table */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">
            Recent Filings
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              (showing up to 100)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              Loading filings...
            </div>
          ) : filings.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <h3 className="font-semibold text-foreground">No Filings Yet</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-md">
                  Click &quot;Sync All from EDGAR&quot; to fetch SEC filings for all publicly traded carriers.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Date</TableHead>
                    <TableHead className="text-muted-foreground">Carrier</TableHead>
                    <TableHead className="text-muted-foreground">Form</TableHead>
                    <TableHead className="text-muted-foreground">Description</TableHead>
                    <TableHead className="text-muted-foreground text-right">Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filings.map((filing) => (
                    <TableRow key={filing.id} className="border-border">
                      <TableCell className="font-mono text-sm">
                        {new Date(filing.filingDate).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        {filing.carrier ? (
                          <Link
                            href={`/carriers/${filing.carrier.id}`}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            {filing.carrier.name}
                            {filing.carrier.ticker && (
                              <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                                ({filing.carrier.ticker})
                              </span>
                            )}
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={formTypeColors[filing.formType] || ""}
                        >
                          {filing.formType}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {filing.description || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {filing.edgarUrl && (
                          <a
                            href={filing.edgarUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
