"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface CarrierFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  companyType: string;
  onCompanyTypeChange: (value: string) => void;
  publicOnly: boolean;
  onPublicOnlyChange: (value: boolean) => void;
  onReset: () => void;
}

const categories = [
  { value: "all", label: "All Categories" },
  { value: "us_pc", label: "US P&C Carriers" },
  { value: "global", label: "Global Carriers" },
  { value: "reinsurer", label: "Reinsurers" },
  { value: "auto_dealer_niche", label: "Auto Dealer Niche" },
];

const companyTypes = [
  { value: "all", label: "All Types" },
  { value: "primary_carrier", label: "Primary Carrier" },
  { value: "reinsurer", label: "Reinsurer" },
  { value: "mutual", label: "Mutual" },
  { value: "mga_specialty", label: "MGA / Specialty" },
  { value: "broker", label: "Broker" },
  { value: "market", label: "Market" },
];

export function CarrierFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  companyType,
  onCompanyTypeChange,
  publicOnly,
  onPublicOnlyChange,
  onReset,
}: CarrierFiltersProps) {
  const hasActiveFilters = search || category !== "all" || companyType !== "all" || publicOnly;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[240px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search carriers by name or ticker..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      <Select value={category} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[180px] bg-card border-border">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((cat) => (
            <SelectItem key={cat.value} value={cat.value}>
              {cat.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={companyType} onValueChange={onCompanyTypeChange}>
        <SelectTrigger className="w-[180px] bg-card border-border">
          <SelectValue placeholder="Company Type" />
        </SelectTrigger>
        <SelectContent>
          {companyTypes.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant={publicOnly ? "default" : "outline"}
        size="sm"
        onClick={() => onPublicOnlyChange(!publicOnly)}
        className="border-border"
      >
        Public Only
      </Button>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground">
          <X className="mr-1 h-3 w-3" />
          Clear
        </Button>
      )}
    </div>
  );
}
