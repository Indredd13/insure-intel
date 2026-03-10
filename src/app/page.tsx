"use client";

import { useEffect, useState, useCallback } from "react";
import { StatsOverview } from "@/components/dashboard/stats-overview";
import { CarrierTable } from "@/components/carriers/carrier-table";
import { CarrierFilters } from "@/components/carriers/carrier-filters";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Carrier {
  id: string;
  name: string;
  ticker: string | null;
  exchange: string | null;
  headquartersCountry: string;
  companyType: string;
  linesOfBusiness: string;
  isPubliclyTraded: boolean;
  category: string;
  description: string | null;
  parentCompany: string | null;
}

export default function DashboardPage() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [filteredCarriers, setFilteredCarriers] = useState<Carrier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [companyType, setCompanyType] = useState("all");
  const [publicOnly, setPublicOnly] = useState(false);

  const fetchCarriers = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/carriers");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCarriers(data);
      setFilteredCarriers(data);
    } catch {
      toast.error("Failed to load carriers");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCarriers();
  }, [fetchCarriers]);

  // Apply filters client-side for instant feedback
  useEffect(() => {
    let result = carriers;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.ticker && c.ticker.toLowerCase().includes(q))
      );
    }

    if (category !== "all") {
      result = result.filter((c) => c.category === category);
    }

    if (companyType !== "all") {
      result = result.filter((c) => c.companyType === companyType);
    }

    if (publicOnly) {
      result = result.filter((c) => c.isPubliclyTraded);
    }

    setFilteredCarriers(result);
  }, [carriers, search, category, companyType, publicOnly]);

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (!res.ok) throw new Error("Seed failed");
      const data = await res.json();
      toast.success(data.message);
      await fetchCarriers();
    } catch {
      toast.error("Failed to seed database");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    setSyncProgress("");

    let offset = 0;
    const limit = 2;
    let totalFilings = 0;
    let totalMetrics = 0;
    let totalSynced = 0;
    let totalCarriers = 0;
    let batchErrors: string[] = [];

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        setSyncProgress(
          totalCarriers > 0
            ? `Syncing batch… (${totalSynced} of ${totalCarriers} carriers done)`
            : `Syncing batch starting at ${offset + 1}…`
        );

        const res = await fetch("/api/filings/fetch-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset, limit }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Batch failed (status ${res.status})`);
        }

        const data = await res.json();
        totalFilings += data.totalFilings || 0;
        totalMetrics += data.totalMetrics || 0;
        totalSynced += data.batchSize || 0;
        totalCarriers = data.totalCarriers || totalCarriers;

        // Collect any per-carrier errors
        if (data.results) {
          for (const r of data.results) {
            if (r.error) batchErrors.push(`${r.name}: ${r.error}`);
          }
        }

        if (!data.hasMore) break;
        offset = data.nextOffset;
      }

      const msg = `Synced ${totalSynced} carriers — ${totalFilings} filings, ${totalMetrics} metrics`;
      if (batchErrors.length > 0) {
        toast.warning(`${msg} (${batchErrors.length} carrier errors)`);
      } else {
        toast.success(msg);
      }
      await fetchCarriers();
    } catch (err) {
      toast.error(
        `EDGAR sync failed at carrier ${totalSynced + 1}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setIsSyncingAll(false);
      setSyncProgress("");
    }
  };

  const resetFilters = () => {
    setSearch("");
    setCategory("all");
    setCompanyType("all");
    setPublicOnly(false);
  };

  const stats = {
    total: carriers.length,
    usPC: carriers.filter((c) => c.category === "us_pc").length,
    global: carriers.filter((c) => c.category === "global").length,
    reinsurers: carriers.filter((c) => c.category === "reinsurer").length,
    autoDealerNiche: carriers.filter((c) => c.category === "auto_dealer_niche").length,
    publiclyTraded: carriers.filter((c) => c.isPubliclyTraded).length,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            P&C insurance carrier universe — {filteredCarriers.length} of {carriers.length} carriers
          </p>
        </div>
        <div className="flex items-center gap-3">
          {carriers.length > 0 && (
            <Button
              variant="outline"
              onClick={handleSyncAll}
              disabled={isSyncingAll}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", isSyncingAll && "animate-spin")} />
              {isSyncingAll ? (syncProgress || "Syncing EDGAR...") : "Sync All from EDGAR"}
            </Button>
          )}
          {!isLoading && (
            <Button onClick={handleSeed} disabled={isSeeding} variant={carriers.length > 0 ? "outline" : "default"}>
              {isSeeding ? "Seeding..." : carriers.length > 0 ? "Re-Seed Database" : "Seed Database"}
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <StatsOverview stats={stats} />

      {/* Filters */}
      <CarrierFilters
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        companyType={companyType}
        onCompanyTypeChange={setCompanyType}
        publicOnly={publicOnly}
        onPublicOnlyChange={setPublicOnly}
        onReset={resetFilters}
      />

      {/* Table */}
      <CarrierTable carriers={filteredCarriers} isLoading={isLoading} />
    </div>
  );
}
