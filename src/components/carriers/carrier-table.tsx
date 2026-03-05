"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
  parentCompany: string | null;
}

interface CarrierTableProps {
  carriers: Carrier[];
  isLoading: boolean;
}

const categoryLabels: Record<string, string> = {
  us_pc: "US P&C",
  global: "Global",
  reinsurer: "Reinsurer",
  auto_dealer_niche: "Auto Dealer",
};

const companyTypeLabels: Record<string, string> = {
  primary_carrier: "Primary",
  reinsurer: "Reinsurer",
  mutual: "Mutual",
  mga_specialty: "MGA",
  broker: "Broker",
  market: "Market",
};

const categoryColors: Record<string, string> = {
  us_pc: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  global: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  reinsurer: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  auto_dealer_niche: "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

export function CarrierTable({ carriers, isLoading }: CarrierTableProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading carriers...
      </div>
    );
  }

  if (carriers.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No carriers found matching your filters.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground font-semibold">Company</TableHead>
            <TableHead className="text-muted-foreground font-semibold">Ticker</TableHead>
            <TableHead className="text-muted-foreground font-semibold">Category</TableHead>
            <TableHead className="text-muted-foreground font-semibold">Type</TableHead>
            <TableHead className="text-muted-foreground font-semibold">HQ</TableHead>
            <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {carriers.map((carrier) => (
            <TableRow
              key={carrier.id}
              className="border-border cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => router.push(`/carriers/${carrier.id}`)}
            >
              <TableCell>
                <div>
                  <span className="font-medium text-foreground">{carrier.name}</span>
                  {carrier.parentCompany && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({carrier.parentCompany})
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {carrier.ticker ? (
                  <span className="font-mono text-sm text-primary">
                    {carrier.ticker}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={categoryColors[carrier.category] || ""}
                >
                  {categoryLabels[carrier.category] || carrier.category}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {companyTypeLabels[carrier.companyType] || carrier.companyType}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {carrier.headquartersCountry}
                </span>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
