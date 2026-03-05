"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Building2,
  Globe,
  ExternalLink,
} from "lucide-react";
import { FilingsTab } from "@/components/carriers/filings-tab";
import { FinancialsTab } from "@/components/carriers/financials-tab";
import { CommentaryTab } from "@/components/carriers/commentary-tab";

interface Carrier {
  id: string;
  name: string;
  ticker: string | null;
  exchange: string | null;
  headquartersCountry: string;
  companyType: string;
  linesOfBusiness: string;
  isPubliclyTraded: boolean;
  description: string | null;
  website: string | null;
  cikNumber: string | null;
  category: string;
  parentCompany: string | null;
  edgarLastSyncedAt: string | null;
}

const categoryLabels: Record<string, string> = {
  us_pc: "US P&C",
  global: "Global",
  reinsurer: "Reinsurer",
  auto_dealer_niche: "Auto Dealer Niche",
};

const companyTypeLabels: Record<string, string> = {
  primary_carrier: "Primary Carrier",
  reinsurer: "Reinsurer",
  mutual: "Mutual",
  mga_specialty: "MGA / Specialty",
  broker: "Broker",
  market: "Market",
};

const categoryColors: Record<string, string> = {
  us_pc: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  global: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  reinsurer: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  auto_dealer_niche: "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

export default function CarrierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [carrier, setCarrier] = useState<Carrier | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCarrier = useCallback(async () => {
    try {
      const res = await fetch(`/api/carriers/${id}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setCarrier(data);
    } catch {
      setCarrier(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCarrier();
  }, [fetchCarrier]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        Loading carrier details...
      </div>
    );
  }

  if (!carrier) {
    return (
      <div className="space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Carrier not found.
        </div>
      </div>
    );
  }

  const linesOfBusiness: string[] = JSON.parse(carrier.linesOfBusiness || "[]");

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{carrier.name}</h1>
            <Badge
              variant="outline"
              className={categoryColors[carrier.category] || ""}
            >
              {categoryLabels[carrier.category] || carrier.category}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {carrier.ticker && (
              <span className="font-mono text-primary font-semibold">
                {carrier.ticker}
                {carrier.exchange && (
                  <span className="ml-1 text-muted-foreground font-normal">
                    ({carrier.exchange})
                  </span>
                )}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" />
              {carrier.headquartersCountry}
            </span>
            <span className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              {companyTypeLabels[carrier.companyType] || carrier.companyType}
            </span>
            {carrier.isPubliclyTraded ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                Publicly Traded
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                Private
              </Badge>
            )}
          </div>
        </div>
        {carrier.website && (
          <a
            href={carrier.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Website
          </a>
        )}
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="filings">Filings</TabsTrigger>
          <TabsTrigger value="commentary">Commentary</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Company Info */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {carrier.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {carrier.description}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Headquarters</span>
                    <p className="mt-0.5 font-medium">{carrier.headquartersCountry}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Company Type</span>
                    <p className="mt-0.5 font-medium">
                      {companyTypeLabels[carrier.companyType] || carrier.companyType}
                    </p>
                  </div>
                  {carrier.parentCompany && (
                    <div>
                      <span className="text-muted-foreground">Parent Company</span>
                      <p className="mt-0.5 font-medium">{carrier.parentCompany}</p>
                    </div>
                  )}
                  {carrier.cikNumber && (
                    <div>
                      <span className="text-muted-foreground">SEC CIK</span>
                      <p className="mt-0.5 font-mono text-primary">{carrier.cikNumber}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Lines of Business */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">Lines of Business</CardTitle>
              </CardHeader>
              <CardContent>
                {linesOfBusiness.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {linesOfBusiness.map((line) => (
                      <Badge
                        key={line}
                        variant="outline"
                        className="border-border text-muted-foreground"
                      >
                        {line}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No lines of business recorded.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Financials Tab — Live XBRL data */}
        <TabsContent value="financials">
          <FinancialsTab
            carrierId={carrier.id}
            cikNumber={carrier.cikNumber}
          />
        </TabsContent>

        {/* Filings Tab — Live EDGAR data */}
        <TabsContent value="filings">
          <FilingsTab
            carrierId={carrier.id}
            cikNumber={carrier.cikNumber}
            edgarLastSyncedAt={carrier.edgarLastSyncedAt}
            onSyncComplete={fetchCarrier}
          />
        </TabsContent>

        {/* Commentary Tab */}
        <TabsContent value="commentary">
          <CommentaryTab carrierId={carrier.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
