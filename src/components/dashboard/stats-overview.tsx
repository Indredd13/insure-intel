"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Globe, Shield, Car } from "lucide-react";

interface StatsOverviewProps {
  stats: {
    total: number;
    usPC: number;
    global: number;
    reinsurers: number;
    autoDealerNiche: number;
    publiclyTraded: number;
  };
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  const cards = [
    {
      title: "Total Carriers",
      value: stats.total,
      description: `${stats.publiclyTraded} publicly traded`,
      icon: Building2,
    },
    {
      title: "US P&C Carriers",
      value: stats.usPC,
      description: "Primary carriers & mutuals",
      icon: Building2,
    },
    {
      title: "Global Carriers",
      value: stats.global,
      description: "With US P&C presence",
      icon: Globe,
    },
    {
      title: "Reinsurers",
      value: stats.reinsurers,
      description: "Market cycle indicators",
      icon: Shield,
    },
    {
      title: "Auto Dealer Niche",
      value: stats.autoDealerNiche,
      description: "Specialty & niche players",
      icon: Car,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">{card.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
