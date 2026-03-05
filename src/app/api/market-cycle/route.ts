import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface CarrierInfo {
  id: string;
  name: string;
  ticker: string | null;
  category: string;
}

interface MetricRow {
  metricName: string;
  value: number;
  fiscalYear: number | null;
  carrier: CarrierInfo;
}

interface CarrierYearData {
  carrierId: string;
  name: string;
  ticker: string | null;
  category: string;
  [key: string]: string | number | null | undefined;
}

interface IndustryTrendPoint {
  year: number;
  avgCombinedRatio: number;
  avgLossRatio: number | null;
  avgExpenseRatio: number | null;
  carriersWithData: number;
}

interface CategoryTrendPoint {
  year: number;
  us_pc: number | null;
  global: number | null;
  reinsurer: number | null;
}

interface PremiumGrowthPoint {
  year: number;
  totalNWP: number;
  yoyGrowthPct: number | null;
}

interface PerformerEntry {
  carrierId: string;
  name: string;
  ticker: string | null;
  combinedRatio: number;
  category: string;
}

export async function GET() {
  try {
    // Fetch all annual financial metrics with carrier info
    const metrics = (await prisma.financialMetric.findMany({
      where: { formType: "10-K" },
      select: {
        metricName: true,
        value: true,
        fiscalYear: true,
        carrier: {
          select: { id: true, name: true, ticker: true, category: true },
        },
      },
    })) as MetricRow[];

    // Pivot: group by carrier+year
    const carrierYearMap = new Map<string, CarrierYearData>();
    for (const m of metrics) {
      if (!m.fiscalYear) continue;
      const key = `${m.carrier.id}|${m.fiscalYear}`;
      if (!carrierYearMap.has(key)) {
        carrierYearMap.set(key, {
          carrierId: m.carrier.id,
          name: m.carrier.name,
          ticker: m.carrier.ticker,
          category: m.carrier.category,
          year: m.fiscalYear,
        });
      }
      const record = carrierYearMap.get(key)!;
      if (record[m.metricName] === undefined) {
        record[m.metricName] = m.value;
      }
    }

    const allData = Array.from(carrierYearMap.values());

    // Collect all years that have data
    const yearsSet = new Set<number>();
    for (const d of allData) {
      yearsSet.add(d.year as number);
    }
    const years = Array.from(yearsSet).sort((a, b) => a - b);

    // --- Industry Trend: avg combined ratio by year ---
    const industryTrend: IndustryTrendPoint[] = [];
    for (const year of years) {
      const yearData = allData.filter(
        (d) => d.year === year && d.combined_ratio !== undefined
      );
      if (yearData.length === 0) continue;

      const avgCR =
        yearData.reduce((sum, d) => sum + (d.combined_ratio as number), 0) /
        yearData.length;

      const lossData = yearData.filter((d) => d.loss_ratio !== undefined);
      const avgLR =
        lossData.length > 0
          ? lossData.reduce((sum, d) => sum + (d.loss_ratio as number), 0) /
            lossData.length
          : null;

      const expenseData = yearData.filter(
        (d) => d.expense_ratio !== undefined
      );
      const avgER =
        expenseData.length > 0
          ? expenseData.reduce(
              (sum, d) => sum + (d.expense_ratio as number),
              0
            ) / expenseData.length
          : null;

      industryTrend.push({
        year,
        avgCombinedRatio: Number((avgCR * 100).toFixed(1)),
        avgLossRatio: avgLR !== null ? Number((avgLR * 100).toFixed(1)) : null,
        avgExpenseRatio:
          avgER !== null ? Number((avgER * 100).toFixed(1)) : null,
        carriersWithData: yearData.length,
      });
    }

    // --- Category Trend: avg combined ratio by category by year ---
    const categoryTrend: CategoryTrendPoint[] = [];
    const categories = ["us_pc", "global", "reinsurer"];
    for (const year of years) {
      const point: CategoryTrendPoint = {
        year,
        us_pc: null,
        global: null,
        reinsurer: null,
      };
      for (const cat of categories) {
        const catData = allData.filter(
          (d) =>
            d.year === year &&
            d.category === cat &&
            d.combined_ratio !== undefined
        );
        if (catData.length > 0) {
          const avg =
            catData.reduce(
              (sum, d) => sum + (d.combined_ratio as number),
              0
            ) / catData.length;
          point[cat as keyof CategoryTrendPoint] = Number(
            (avg * 100).toFixed(1)
          ) as number;
        }
      }
      if (
        point.us_pc !== null ||
        point.global !== null ||
        point.reinsurer !== null
      ) {
        categoryTrend.push(point);
      }
    }

    // --- Premium Growth: total NWP by year ---
    const premiumGrowth: PremiumGrowthPoint[] = [];
    for (const year of years) {
      const yearData = allData.filter(
        (d) => d.year === year && d.nwp !== undefined
      );
      if (yearData.length === 0) continue;
      const totalNWP = yearData.reduce(
        (sum, d) => sum + (d.nwp as number),
        0
      );
      premiumGrowth.push({ year, totalNWP, yoyGrowthPct: null });
    }
    // Compute YoY
    for (let i = 1; i < premiumGrowth.length; i++) {
      const prev = premiumGrowth[i - 1].totalNWP;
      const curr = premiumGrowth[i].totalNWP;
      if (prev > 0) {
        premiumGrowth[i].yoyGrowthPct = Number(
          (((curr - prev) / prev) * 100).toFixed(1)
        );
      }
    }

    // --- Cycle Indicator ---
    const latestTrend =
      industryTrend.length > 0
        ? industryTrend[industryTrend.length - 1]
        : null;
    const previousTrend =
      industryTrend.length > 1
        ? industryTrend[industryTrend.length - 2]
        : null;

    let direction: "hardening" | "softening" | "stable" = "stable";
    let changePct = 0;
    if (latestTrend && previousTrend) {
      changePct = Number(
        (latestTrend.avgCombinedRatio - previousTrend.avgCombinedRatio).toFixed(
          1
        )
      );
      // Lower combined ratio = hardening (better for insurers)
      if (changePct < -1) direction = "hardening";
      else if (changePct > 1) direction = "softening";
    }

    const cycleIndicator = {
      direction,
      latestCR: latestTrend?.avgCombinedRatio ?? null,
      previousCR: previousTrend?.avgCombinedRatio ?? null,
      changePct,
      latestYear: latestTrend?.year ?? null,
      previousYear: previousTrend?.year ?? null,
    };

    // --- Top/Bottom Performers ---
    const latestYear =
      industryTrend.length > 0
        ? industryTrend[industryTrend.length - 1].year
        : null;
    const latestYearCarriers = latestYear
      ? allData
          .filter(
            (d) => d.year === latestYear && d.combined_ratio !== undefined
          )
          .map((d) => ({
            carrierId: d.carrierId,
            name: d.name as string,
            ticker: d.ticker as string | null,
            combinedRatio: Number(
              ((d.combined_ratio as number) * 100).toFixed(1)
            ),
            category: d.category as string,
          }))
          .sort((a, b) => a.combinedRatio - b.combinedRatio)
      : [];

    const topPerformers: PerformerEntry[] = latestYearCarriers.slice(0, 10);
    const bottomPerformers: PerformerEntry[] = latestYearCarriers
      .slice(-10)
      .reverse();

    // --- Stats ---
    const latestPremium =
      premiumGrowth.length > 0
        ? premiumGrowth[premiumGrowth.length - 1]
        : null;

    const stats = {
      avgCombinedRatio: latestTrend?.avgCombinedRatio ?? null,
      totalNWP: latestPremium?.totalNWP ?? null,
      carriersWithData: latestTrend?.carriersWithData ?? 0,
      yoyPremiumChange: latestPremium?.yoyGrowthPct ?? null,
      latestYear: latestYear,
    };

    return NextResponse.json({
      industryTrend,
      categoryTrend,
      premiumGrowth,
      cycleIndicator,
      topPerformers,
      bottomPerformers,
      stats,
    });
  } catch (error) {
    console.error("Error computing market cycle data:", error);
    return NextResponse.json(
      { error: "Failed to compute market cycle data" },
      { status: 500 }
    );
  }
}
