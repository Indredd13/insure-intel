import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CarrierYearData {
  carrierId: string;
  name: string;
  ticker: string | null;
  category: string;
  year: number;
  [key: string]: number | string | null | undefined;
}

interface PeerScorecard {
  carrierId: string;
  name: string;
  ticker: string | null;
  category: string;
  categoryLabel: string;
  metrics: {
    combinedRatio: number | null;
    nwpGrowth: number | null;
    netIncomeMargin: number | null;
    expenseRatio: number | null;
    investmentYield: number | null;
  };
  ranks: {
    combinedRatio: number | null;
    nwpGrowth: number | null;
    netIncomeMargin: number | null;
    expenseRatio: number | null;
    investmentYield: number | null;
  };
  compositeRank: number;
  compositeScore: number;
  peerGroupSize: number;
  metricsAvailable: number;
}

interface MarketShareEntry {
  carrierId: string;
  name: string;
  ticker: string | null;
  nwp: number;
  marketShare: number;
}

interface ShareChange {
  carrierId: string;
  name: string;
  ticker: string | null;
  category: string;
  categoryLabel: string;
  latestShare: number;
  previousShare: number;
  change: number;
}

interface QuartilePoint {
  year: number;
  p25: number;
  median: number;
  p75: number;
  carrierCount: number;
}

interface EfficiencyEntry {
  carrierId: string;
  name: string;
  ticker: string | null;
  category: string;
  categoryLabel: string;
  expenseRatio: number | null;
  lossRatio: number | null;
  combinedRatio: number | null;
  quartile: number | null;
  trend: Array<{ year: number; expenseRatio: number | null }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  us_pc: "US P&C",
  global: "Global",
  reinsurer: "Reinsurer",
  auto_dealer_niche: "Auto Dealer",
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function rankValues(
  values: Array<{ id: string; value: number | null }>,
  lowerIsBetter: boolean
): Map<string, number> {
  const rankMap = new Map<string, number>();
  const valid = values
    .filter((v) => v.value !== null)
    .sort((a, b) =>
      lowerIsBetter
        ? (a.value as number) - (b.value as number)
        : (b.value as number) - (a.value as number)
    );

  valid.forEach((v, idx) => {
    rankMap.set(v.id, idx + 1);
  });

  return rankMap;
}

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Fetch all 10-K metrics with carrier info
    const metrics = await prisma.financialMetric.findMany({
      where: { formType: "10-K" },
      select: {
        metricName: true,
        value: true,
        fiscalYear: true,
        carrier: {
          select: { id: true, name: true, ticker: true, category: true },
        },
      },
    });

    // ─── Pivot metrics by carrier+year ──────────────────────────────────

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
    const years = [...new Set(allData.map((d) => d.year))].sort();
    const latestYear = years[years.length - 1];
    const previousYear = years.length >= 2 ? years[years.length - 2] : null;

    // ═══════════════════════════════════════════════════════════════════
    // SECTION A: Peer Group Scoring
    // ═══════════════════════════════════════════════════════════════════

    const latestYearData = allData.filter((d) => d.year === latestYear);
    const categories = [...new Set(latestYearData.map((d) => d.category))];

    const allScorecards: PeerScorecard[] = [];

    for (const cat of categories) {
      const peerGroup = latestYearData.filter((d) => d.category === cat);
      if (peerGroup.length === 0) continue;

      // Compute metrics for each carrier
      const carrierMetrics = peerGroup.map((d) => {
        // NWP growth YoY
        let nwpGrowth: number | null = null;
        if (typeof d.nwp === "number" && previousYear) {
          const prevData = allData.find(
            (p) => p.carrierId === d.carrierId && p.year === previousYear
          );
          if (prevData && typeof prevData.nwp === "number") {
            nwpGrowth =
              ((d.nwp as number) - (prevData.nwp as number)) /
              Math.abs(prevData.nwp as number);
          }
        }

        // Net income margin
        const netIncome = d.net_income as number | undefined;
        const totalRevenue = d.total_revenue as number | undefined;
        const nep = d.nep as number | undefined;
        const revenue = totalRevenue ?? nep;
        const netIncomeMargin =
          netIncome !== undefined && revenue !== undefined && revenue !== 0
            ? netIncome / Math.abs(revenue)
            : null;

        // Investment yield
        const invIncome = d.investment_income as number | undefined;
        const totalAssets = d.total_assets as number | undefined;
        const investmentYield =
          invIncome !== undefined &&
          totalAssets !== undefined &&
          totalAssets !== 0
            ? invIncome / Math.abs(totalAssets)
            : null;

        const cr =
          typeof d.combined_ratio === "number"
            ? (d.combined_ratio as number) * 100
            : null;
        const er =
          typeof d.expense_ratio === "number"
            ? (d.expense_ratio as number) * 100
            : null;

        return {
          carrierId: d.carrierId,
          name: d.name,
          ticker: d.ticker,
          category: d.category,
          metrics: {
            combinedRatio: cr !== null ? Number(cr.toFixed(1)) : null,
            nwpGrowth:
              nwpGrowth !== null
                ? Number((nwpGrowth * 100).toFixed(1))
                : null,
            netIncomeMargin:
              netIncomeMargin !== null
                ? Number((netIncomeMargin * 100).toFixed(1))
                : null,
            expenseRatio: er !== null ? Number(er.toFixed(1)) : null,
            investmentYield:
              investmentYield !== null
                ? Number((investmentYield * 100).toFixed(2))
                : null,
          },
        };
      });

      // Rank within peer group
      const crRanks = rankValues(
        carrierMetrics.map((c) => ({
          id: c.carrierId,
          value: c.metrics.combinedRatio,
        })),
        true // lower is better
      );
      const growthRanks = rankValues(
        carrierMetrics.map((c) => ({
          id: c.carrierId,
          value: c.metrics.nwpGrowth,
        })),
        false // higher is better
      );
      const marginRanks = rankValues(
        carrierMetrics.map((c) => ({
          id: c.carrierId,
          value: c.metrics.netIncomeMargin,
        })),
        false
      );
      const erRanks = rankValues(
        carrierMetrics.map((c) => ({
          id: c.carrierId,
          value: c.metrics.expenseRatio,
        })),
        true
      );
      const yieldRanks = rankValues(
        carrierMetrics.map((c) => ({
          id: c.carrierId,
          value: c.metrics.investmentYield,
        })),
        false
      );

      for (const c of carrierMetrics) {
        const ranks = {
          combinedRatio: crRanks.get(c.carrierId) ?? null,
          nwpGrowth: growthRanks.get(c.carrierId) ?? null,
          netIncomeMargin: marginRanks.get(c.carrierId) ?? null,
          expenseRatio: erRanks.get(c.carrierId) ?? null,
          investmentYield: yieldRanks.get(c.carrierId) ?? null,
        };

        const validRanks = Object.values(ranks).filter(
          (r) => r !== null
        ) as number[];
        const compositeScore =
          validRanks.length > 0
            ? Number(
                (
                  validRanks.reduce((s, r) => s + r, 0) / validRanks.length
                ).toFixed(2)
              )
            : 999;

        allScorecards.push({
          carrierId: c.carrierId,
          name: c.name,
          ticker: c.ticker,
          category: c.category,
          categoryLabel: CATEGORY_LABELS[c.category] || c.category,
          metrics: c.metrics,
          ranks,
          compositeRank: 0, // will be set after sorting
          compositeScore,
          peerGroupSize: peerGroup.length,
          metricsAvailable: validRanks.length,
        });
      }
    }

    // Set composite rank per category
    for (const cat of categories) {
      const catCards = allScorecards
        .filter((s) => s.category === cat)
        .sort((a, b) => a.compositeScore - b.compositeScore);
      catCards.forEach((c, idx) => {
        c.compositeRank = idx + 1;
      });
    }

    allScorecards.sort((a, b) => a.compositeScore - b.compositeScore);

    // ═══════════════════════════════════════════════════════════════════
    // SECTION B: Market Share
    // ═══════════════════════════════════════════════════════════════════

    const marketShareByYear: Array<{
      year: number;
      category: string;
      categoryLabel: string;
      carriers: MarketShareEntry[];
    }> = [];

    for (const year of years) {
      for (const cat of categories) {
        const catYearData = allData.filter(
          (d) =>
            d.year === year &&
            d.category === cat &&
            typeof d.nwp === "number"
        );
        if (catYearData.length === 0) continue;

        const totalNWP = catYearData.reduce(
          (s, d) => s + Math.abs(d.nwp as number),
          0
        );

        const carriers: MarketShareEntry[] = catYearData
          .map((d) => ({
            carrierId: d.carrierId,
            name: d.name,
            ticker: d.ticker,
            nwp: d.nwp as number,
            marketShare:
              totalNWP > 0
                ? Number(
                    (((d.nwp as number) / totalNWP) * 100).toFixed(1)
                  )
                : 0,
          }))
          .sort((a, b) => b.nwp - a.nwp);

        marketShareByYear.push({
          year,
          category: cat,
          categoryLabel: CATEGORY_LABELS[cat] || cat,
          carriers,
        });
      }
    }

    // Share changes: latest vs previous year
    const shareChanges: ShareChange[] = [];
    if (previousYear) {
      for (const cat of categories) {
        const latestShares = marketShareByYear.find(
          (m) => m.year === latestYear && m.category === cat
        );
        const prevShares = marketShareByYear.find(
          (m) => m.year === previousYear && m.category === cat
        );

        if (!latestShares || !prevShares) continue;

        for (const latest of latestShares.carriers) {
          const prev = prevShares.carriers.find(
            (p) => p.carrierId === latest.carrierId
          );
          shareChanges.push({
            carrierId: latest.carrierId,
            name: latest.name,
            ticker: latest.ticker,
            category: cat,
            categoryLabel: CATEGORY_LABELS[cat] || cat,
            latestShare: latest.marketShare,
            previousShare: prev?.marketShare ?? 0,
            change: Number(
              (latest.marketShare - (prev?.marketShare ?? 0)).toFixed(1)
            ),
          });
        }
      }
    }

    shareChanges.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    // Stacked area chart data: pivot by year for each category
    const stackedShareData: Record<
      string,
      Array<Record<string, number | string>>
    > = {};

    for (const cat of categories) {
      const catEntries = marketShareByYear.filter(
        (m) => m.category === cat
      );
      // Get top 8 carriers by latest year NWP
      const latestEntry = catEntries.find((e) => e.year === latestYear);
      const topCarrierIds = (latestEntry?.carriers ?? [])
        .slice(0, 8)
        .map((c) => c.carrierId);

      const chartData: Array<Record<string, number | string>> = [];
      for (const entry of catEntries) {
        const point: Record<string, number | string> = {
          year: entry.year,
        };
        let otherShare = 0;
        for (const c of entry.carriers) {
          if (topCarrierIds.includes(c.carrierId)) {
            point[c.name] = c.marketShare;
          } else {
            otherShare += c.marketShare;
          }
        }
        if (otherShare > 0) {
          point["Other"] = Number(otherShare.toFixed(1));
        }
        chartData.push(point);
      }
      stackedShareData[cat] = chartData;
    }

    // Carrier name lists per category for chart keys
    const carrierNamesByCategory: Record<string, string[]> = {};
    for (const cat of categories) {
      const latestEntry = marketShareByYear.find(
        (m) => m.year === latestYear && m.category === cat
      );
      const names = (latestEntry?.carriers ?? [])
        .slice(0, 8)
        .map((c) => c.name);
      const hasOther = (latestEntry?.carriers ?? []).length > 8;
      if (hasOther) names.push("Other");
      carrierNamesByCategory[cat] = names;
    }

    // ═══════════════════════════════════════════════════════════════════
    // SECTION C: Expense Benchmark
    // ═══════════════════════════════════════════════════════════════════

    // Quartile data by year
    const quartilesByYear: QuartilePoint[] = [];
    for (const year of years) {
      const yearData = allData.filter(
        (d) =>
          d.year === year && typeof d.expense_ratio === "number"
      );
      if (yearData.length < 2) continue;

      const erValues = yearData
        .map((d) => (d.expense_ratio as number) * 100)
        .sort((a, b) => a - b);

      quartilesByYear.push({
        year,
        p25: Number(percentile(erValues, 25).toFixed(1)),
        median: Number(percentile(erValues, 50).toFixed(1)),
        p75: Number(percentile(erValues, 75).toFixed(1)),
        carrierCount: erValues.length,
      });
    }

    // Per-carrier expense trend
    const carrierIds = [
      ...new Set(allData.map((d) => d.carrierId)),
    ];

    const efficiencyEntries: EfficiencyEntry[] = [];
    for (const cid of carrierIds) {
      const carrierData = allData.filter((d) => d.carrierId === cid);
      const latestData = carrierData.find((d) => d.year === latestYear);
      if (!latestData) continue;

      const er =
        typeof latestData.expense_ratio === "number"
          ? Number(((latestData.expense_ratio as number) * 100).toFixed(1))
          : null;
      const lr =
        typeof latestData.loss_ratio === "number"
          ? Number(((latestData.loss_ratio as number) * 100).toFixed(1))
          : null;
      const cr =
        typeof latestData.combined_ratio === "number"
          ? Number(
              ((latestData.combined_ratio as number) * 100).toFixed(1)
            )
          : null;

      // Determine quartile
      let quartile: number | null = null;
      if (er !== null) {
        const latestQuartile = quartilesByYear.find(
          (q) => q.year === latestYear
        );
        if (latestQuartile) {
          if (er <= latestQuartile.p25) quartile = 1;
          else if (er <= latestQuartile.median) quartile = 2;
          else if (er <= latestQuartile.p75) quartile = 3;
          else quartile = 4;
        }
      }

      // Expense ratio trend
      const trend = carrierData
        .filter((d) => typeof d.expense_ratio === "number")
        .sort((a, b) => a.year - b.year)
        .map((d) => ({
          year: d.year,
          expenseRatio: Number(
            ((d.expense_ratio as number) * 100).toFixed(1)
          ),
        }));

      efficiencyEntries.push({
        carrierId: cid,
        name: latestData.name,
        ticker: latestData.ticker,
        category: latestData.category,
        categoryLabel:
          CATEGORY_LABELS[latestData.category] || latestData.category,
        expenseRatio: er,
        lossRatio: lr,
        combinedRatio: cr,
        quartile,
        trend,
      });
    }

    // Sort by expense ratio (lowest first = most efficient)
    efficiencyEntries.sort(
      (a, b) => (a.expenseRatio ?? 999) - (b.expenseRatio ?? 999)
    );

    // Industry stats
    const withER = efficiencyEntries.filter(
      (e) => e.expenseRatio !== null
    );
    const industryMedianER =
      withER.length > 0
        ? Number(
            percentile(
              withER
                .map((e) => e.expenseRatio!)
                .sort((a, b) => a - b),
              50
            ).toFixed(1)
          )
        : null;
    const bestCarrier = withER.length > 0 ? withER[0] : null;
    const worstCarrier =
      withER.length > 0 ? withER[withER.length - 1] : null;

    // ─── Response ──────────────────────────────────────────────────────

    return NextResponse.json({
      latestYear,
      previousYear,
      peerScoring: {
        scorecards: allScorecards,
        categories: categories.map((c) => ({
          key: c,
          label: CATEGORY_LABELS[c] || c,
          count: allScorecards.filter((s) => s.category === c).length,
        })),
      },
      marketShare: {
        byYear: marketShareByYear,
        shareChanges,
        stackedShareData,
        carrierNamesByCategory,
      },
      expenseBenchmark: {
        quartilesByYear,
        efficiencyEntries,
        industryMedianER,
        bestCarrier: bestCarrier
          ? { name: bestCarrier.name, expenseRatio: bestCarrier.expenseRatio }
          : null,
        worstCarrier: worstCarrier
          ? {
              name: worstCarrier.name,
              expenseRatio: worstCarrier.expenseRatio,
            }
          : null,
        carrierCount: withER.length,
      },
    });
  } catch (error) {
    console.error("Benchmarking API error:", error);
    return NextResponse.json(
      { error: "Failed to compute benchmarking data" },
      { status: 500 }
    );
  }
}
