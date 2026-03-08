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

type CyclePosition = "soft" | "firming" | "hard" | "softening";

interface CategoryCycle {
  category: string;
  label: string;
  position: CyclePosition;
  latestCR: number | null;
  crDirection: number;
  premiumGrowthRate: number | null;
  carriersWithData: number;
}

interface TrendPoint {
  year: number;
  avgCR: number | null;
  avgNWPGrowth: number | null;
  crMomentum: number | null;
  premiumAcceleration: number | null;
  carriersWithCR: number;
}

interface YearAheadOutlook {
  overallDirection: "hardening" | "softening" | "stable";
  confidence: "high" | "medium" | "low";
  signals: string[];
  byCategory: Array<{
    category: string;
    label: string;
    prediction: string;
    rationale: string;
  }>;
}

interface CarrierInvestmentProfile {
  carrierId: string;
  name: string;
  ticker: string | null;
  category: string;
  underwritingResult: number;
  investmentIncome: number;
  netIncome: number;
  dependencyRatio: number | null;
  isProppedUp: boolean;
  year: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  us_pc: "US P&C",
  global: "Global",
  reinsurer: "Reinsurer",
  auto_dealer_niche: "Auto Dealer",
};

function determineCyclePosition(
  crTrend: number[],
  premiumGrowthTrend: number[]
): CyclePosition {
  if (crTrend.length < 2) return "firming";

  const latestCR = crTrend[crTrend.length - 1];
  const prevCR = crTrend[crTrend.length - 2];
  const crDirection = latestCR - prevCR;
  const latestGrowth =
    premiumGrowthTrend.length > 0
      ? premiumGrowthTrend[premiumGrowthTrend.length - 1]
      : 0;

  if (latestCR < 98 && crDirection < -0.5) return "soft";
  if (crDirection > 0.5 && latestGrowth > 5) return "firming";
  if (latestCR > 100 && crDirection >= 0) return "hard";
  if (latestCR > 96 && crDirection < -0.5) return "softening";

  if (latestCR < 98) return "soft";
  if (latestCR > 100) return "hard";
  return "firming";
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

    // Fetch reinsurance-related commentary
    const commentary = await prisma.commentary.findMany({
      where: {
        OR: [
          { category: "Reinsurance" },
          { category: "reinsurance_signal" },
        ],
      },
      include: { carrier: { select: { name: true, category: true } } },
      orderBy: { sourceDate: "desc" },
      take: 20,
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

    // ═══════════════════════════════════════════════════════════════════
    // SECTION A: Rate Cycle Predictor
    // ═══════════════════════════════════════════════════════════════════

    // — Industry trend (all categories) —
    const industryTrend: TrendPoint[] = [];
    let prevAvgCR: number | null = null;
    let prevAvgNWPGrowth: number | null = null;

    for (const year of years) {
      const yearData = allData.filter((d) => d.year === year);
      const withCR = yearData.filter(
        (d) => typeof d.combined_ratio === "number"
      );
      const avgCR =
        withCR.length > 0
          ? withCR.reduce((s, d) => s + (d.combined_ratio as number), 0) /
            withCR.length
          : null;

      // Compute avg NWP growth for carriers in this year
      let avgNWPGrowth: number | null = null;
      const withNWP = yearData.filter(
        (d) => typeof d.nwp === "number"
      );
      if (withNWP.length > 0) {
        const growths: number[] = [];
        for (const d of withNWP) {
          const prevYearData = allData.find(
            (p) => p.carrierId === d.carrierId && p.year === year - 1
          );
          if (prevYearData && typeof prevYearData.nwp === "number") {
            const growth =
              ((d.nwp as number) - (prevYearData.nwp as number)) /
              Math.abs(prevYearData.nwp as number);
            growths.push(growth * 100);
          }
        }
        if (growths.length > 0) {
          avgNWPGrowth =
            growths.reduce((s, g) => s + g, 0) / growths.length;
        }
      }

      const crMomentum =
        avgCR !== null && prevAvgCR !== null
          ? (avgCR - prevAvgCR) * 100
          : null;

      const premiumAcceleration =
        avgNWPGrowth !== null && prevAvgNWPGrowth !== null
          ? avgNWPGrowth - prevAvgNWPGrowth
          : null;

      industryTrend.push({
        year,
        avgCR: avgCR !== null ? Number((avgCR * 100).toFixed(1)) : null,
        avgNWPGrowth:
          avgNWPGrowth !== null ? Number(avgNWPGrowth.toFixed(1)) : null,
        crMomentum:
          crMomentum !== null ? Number(crMomentum.toFixed(2)) : null,
        premiumAcceleration:
          premiumAcceleration !== null
            ? Number(premiumAcceleration.toFixed(2))
            : null,
        carriersWithCR: withCR.length,
      });

      prevAvgCR = avgCR;
      prevAvgNWPGrowth = avgNWPGrowth;
    }

    // — Cycle position by category —
    const categories = ["us_pc", "global", "reinsurer"];
    const cyclePositionByCategory: CategoryCycle[] = [];

    for (const cat of categories) {
      const catData = allData.filter((d) => d.category === cat);
      const crByYear: number[] = [];
      const growthByYear: number[] = [];

      for (const year of years) {
        const yearCat = catData.filter((d) => d.year === year);
        const withCR = yearCat.filter(
          (d) => typeof d.combined_ratio === "number"
        );
        if (withCR.length > 0) {
          crByYear.push(
            (withCR.reduce((s, d) => s + (d.combined_ratio as number), 0) /
              withCR.length) *
              100
          );
        }

        const withNWP = yearCat.filter(
          (d) => typeof d.nwp === "number"
        );
        if (withNWP.length > 0) {
          const growths: number[] = [];
          for (const d of withNWP) {
            const prev = catData.find(
              (p) => p.carrierId === d.carrierId && p.year === year - 1
            );
            if (prev && typeof prev.nwp === "number") {
              growths.push(
                (((d.nwp as number) - (prev.nwp as number)) /
                  Math.abs(prev.nwp as number)) *
                  100
              );
            }
          }
          if (growths.length > 0) {
            growthByYear.push(
              growths.reduce((s, g) => s + g, 0) / growths.length
            );
          }
        }
      }

      const position = determineCyclePosition(crByYear, growthByYear);
      const latestCR =
        crByYear.length > 0
          ? Number(crByYear[crByYear.length - 1].toFixed(1))
          : null;
      const crDirection =
        crByYear.length >= 2
          ? Number(
              (crByYear[crByYear.length - 1] - crByYear[crByYear.length - 2]).toFixed(2)
            )
          : 0;

      cyclePositionByCategory.push({
        category: cat,
        label: CATEGORY_LABELS[cat] || cat,
        position,
        latestCR,
        crDirection,
        premiumGrowthRate:
          growthByYear.length > 0
            ? Number(growthByYear[growthByYear.length - 1].toFixed(1))
            : null,
        carriersWithData: new Set(
          catData.filter((d) => typeof d.combined_ratio === "number").map((d) => d.carrierId)
        ).size,
      });
    }

    // — Year-ahead outlook —
    const signals: string[] = [];
    let hardeningScore = 0;

    const latestTrend = industryTrend.filter((t) => t.avgCR !== null);
    if (latestTrend.length >= 2) {
      const latest = latestTrend[latestTrend.length - 1];
      const previous = latestTrend[latestTrend.length - 2];

      if (latest.avgCR! > previous.avgCR!) {
        signals.push(
          `Industry combined ratio rose from ${previous.avgCR}% to ${latest.avgCR}%, suggesting loss costs are outpacing rate increases`
        );
        hardeningScore++;
      } else {
        signals.push(
          `Industry combined ratio improved from ${previous.avgCR}% to ${latest.avgCR}%, indicating rate adequacy`
        );
        hardeningScore--;
      }

      if (latest.avgNWPGrowth !== null && latest.avgNWPGrowth > 5) {
        signals.push(
          `Premium growth at ${latest.avgNWPGrowth.toFixed(1)}% signals carriers are pushing rate increases`
        );
        hardeningScore++;
      } else if (latest.avgNWPGrowth !== null && latest.avgNWPGrowth < 2) {
        signals.push(
          `Slow premium growth of ${latest.avgNWPGrowth.toFixed(1)}% suggests competitive pricing pressure`
        );
        hardeningScore--;
      }

      if (latest.premiumAcceleration !== null && latest.premiumAcceleration > 1) {
        signals.push(
          "Premium growth is accelerating — rate increases are gaining momentum"
        );
        hardeningScore++;
      }
    }

    // Reinsurer stress signal
    const reinsurerCycle = cyclePositionByCategory.find(
      (c) => c.category === "reinsurer"
    );
    if (reinsurerCycle && reinsurerCycle.latestCR !== null) {
      if (reinsurerCycle.latestCR > 100) {
        signals.push(
          `Reinsurers are unprofitable at ${reinsurerCycle.latestCR}% CR — expect tighter capacity and rate pressure on primary carriers`
        );
        hardeningScore++;
      } else if (reinsurerCycle.latestCR < 95) {
        signals.push(
          `Reinsurers are highly profitable at ${reinsurerCycle.latestCR}% CR — capacity is ample, easing rate pressure`
        );
        hardeningScore--;
      }
    }

    // Commentary sentiment signal
    const negativeCommentary = commentary.filter(
      (c) => c.sentiment === "negative"
    );
    if (commentary.length > 0) {
      const negativePct = (negativeCommentary.length / commentary.length) * 100;
      if (negativePct > 50) {
        signals.push(
          `${negativePct.toFixed(0)}% of reinsurance commentary is negative, signaling market stress`
        );
        hardeningScore++;
      }
    }

    const overallDirection =
      hardeningScore >= 3
        ? "hardening"
        : hardeningScore >= 1
        ? "hardening"
        : hardeningScore <= -2
        ? "softening"
        : "stable";

    const confidence =
      Math.abs(hardeningScore) >= 3
        ? "high"
        : Math.abs(hardeningScore) >= 2
        ? "medium"
        : "low";

    const yearAheadOutlook: YearAheadOutlook = {
      overallDirection: overallDirection as YearAheadOutlook["overallDirection"],
      confidence: confidence as YearAheadOutlook["confidence"],
      signals,
      byCategory: cyclePositionByCategory.map((c) => {
        let prediction = "stable";
        let rationale = "Insufficient data for a directional call";
        if (c.position === "firming" || c.position === "hard") {
          prediction = "hardening";
          rationale = `CR at ${c.latestCR}% with ${c.crDirection > 0 ? "upward" : "stabilizing"} pressure. Expect continued rate increases.`;
        } else if (c.position === "soft") {
          prediction = "softening";
          rationale = `CR at ${c.latestCR}% and improving. Competitive pricing likely to continue.`;
        } else if (c.position === "softening") {
          prediction = "softening";
          rationale = `CR declining from ${c.latestCR}%. Market transitioning to more competitive conditions.`;
        }
        return {
          category: c.category,
          label: c.label,
          prediction,
          rationale,
        };
      }),
    };

    // — AI prompt template —
    const promptTemplate = `You are an insurance industry analyst. Based on the following financial data from SEC EDGAR filings, provide a detailed market outlook for the coming year.

## Industry Combined Ratio Trend
${industryTrend
  .filter((t) => t.avgCR !== null)
  .map(
    (t) =>
      `${t.year}: CR=${t.avgCR}%, NWP Growth=${t.avgNWPGrowth?.toFixed(1) ?? "N/A"}%`
  )
  .join("\n")}

## Cycle Position by Segment
${cyclePositionByCategory
  .map(
    (c) =>
      `${c.label}: ${c.position.toUpperCase()} (CR: ${c.latestCR ?? "N/A"}%, Direction: ${c.crDirection > 0 ? "rising" : "declining"}, Sample: ${c.carriersWithData} carriers)`
  )
  .join("\n")}

## Algorithmic Signals
${signals.map((s) => `- ${s}`).join("\n")}

Please provide:
1. Your overall market outlook for the next 12 months
2. Which segments (US P&C, Global, Reinsurer) will see the most rate movement and why
3. Key risks that could change the outlook (catastrophes, regulatory changes, interest rates)
4. Strategic implications for a mid-market P&C carrier`;

    // ═══════════════════════════════════════════════════════════════════
    // SECTION B: Investment Dependency
    // ═══════════════════════════════════════════════════════════════════

    const latestYearNum = years[years.length - 1];
    const latestYearData = allData.filter((d) => d.year === latestYearNum);

    const carrierProfiles: CarrierInvestmentProfile[] = [];
    const scatterData: Array<{
      name: string;
      ticker: string | null;
      x: number;
      y: number;
      category: string;
    }> = [];

    for (const d of latestYearData) {
      const nep = d.nep as number | undefined;
      const losses = d.incurred_losses as number | undefined;
      const expenses = d.underwriting_expenses as number | undefined;
      const invIncome = d.investment_income as number | undefined;
      const netIncome = d.net_income as number | undefined;

      if (nep === undefined || netIncome === undefined) continue;

      const underwritingResult =
        nep - (losses ?? 0) - (expenses ?? 0);
      const investmentIncome = invIncome ?? 0;
      const dependencyRatio =
        netIncome !== 0
          ? Number((investmentIncome / Math.abs(netIncome)).toFixed(2))
          : null;
      const isProppedUp = underwritingResult < 0 && netIncome > 0;

      carrierProfiles.push({
        carrierId: d.carrierId,
        name: d.name,
        ticker: d.ticker,
        category: d.category,
        underwritingResult,
        investmentIncome,
        netIncome,
        dependencyRatio,
        isProppedUp,
        year: d.year,
      });

      scatterData.push({
        name: d.name,
        ticker: d.ticker,
        x: Number((underwritingResult / 1e9).toFixed(2)),
        y: Number((investmentIncome / 1e9).toFixed(2)),
        category: d.category,
      });
    }

    carrierProfiles.sort(
      (a, b) => (b.dependencyRatio ?? 0) - (a.dependencyRatio ?? 0)
    );

    // Industry investment dependency trend
    const investmentTrend: Array<{
      year: number;
      totalUnderwriting: number;
      totalInvestment: number;
      carriersWithData: number;
    }> = [];

    for (const year of years) {
      const yearData = allData.filter((d) => d.year === year);
      let totalUW = 0;
      let totalInv = 0;
      let count = 0;

      for (const d of yearData) {
        const nep = d.nep as number | undefined;
        const losses = d.incurred_losses as number | undefined;
        const invIncome = d.investment_income as number | undefined;

        if (nep === undefined) continue;

        totalUW += nep - (losses ?? 0) - ((d.underwriting_expenses as number) ?? 0);
        totalInv += invIncome ?? 0;
        count++;
      }

      if (count > 0) {
        investmentTrend.push({
          year,
          totalUnderwriting: Number((totalUW / 1e9).toFixed(2)),
          totalInvestment: Number((totalInv / 1e9).toFixed(2)),
          carriersWithData: count,
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // SECTION C: Reinsurance Pass-Through
    // ═══════════════════════════════════════════════════════════════════

    // Reinsurer avg CR by year
    const reinsurerCRByYear: Array<{ year: number; avgCR: number; count: number }> = [];
    for (const year of years) {
      const reinsurers = allData.filter(
        (d) => d.category === "reinsurer" && d.year === year && typeof d.combined_ratio === "number"
      );
      if (reinsurers.length > 0) {
        reinsurerCRByYear.push({
          year,
          avgCR: Number(
            (
              (reinsurers.reduce(
                (s, d) => s + (d.combined_ratio as number),
                0
              ) /
                reinsurers.length) *
              100
            ).toFixed(1)
          ),
          count: reinsurers.length,
        });
      }
    }

    // Primary carrier NWP growth by year
    const primaryNWPGrowthByYear: Array<{ year: number; avgGrowth: number }> = [];
    for (const year of years) {
      const primaries = allData.filter(
        (d) =>
          d.category === "us_pc" &&
          d.year === year &&
          typeof d.nwp === "number"
      );
      const growths: number[] = [];
      for (const d of primaries) {
        const prev = allData.find(
          (p) => p.carrierId === d.carrierId && p.year === year - 1
        );
        if (prev && typeof prev.nwp === "number") {
          growths.push(
            (((d.nwp as number) - (prev.nwp as number)) /
              Math.abs(prev.nwp as number)) *
              100
          );
        }
      }
      if (growths.length > 0) {
        primaryNWPGrowthByYear.push({
          year,
          avgGrowth: Number(
            (growths.reduce((s, g) => s + g, 0) / growths.length).toFixed(1)
          ),
        });
      }
    }

    // Overlay: reinsurer CR at year N vs primary NWP growth at year N+1
    const overlayData = reinsurerCRByYear.map(({ year, avgCR, count }) => {
      const laggedGrowth = primaryNWPGrowthByYear.find(
        (g) => g.year === year + 1
      );
      return {
        year,
        reinsurerAvgCR: avgCR,
        primaryNWPGrowthNextYear: laggedGrowth?.avgGrowth ?? null,
        reinsurerCount: count,
      };
    });

    // Ceded premium ratio: (GWP - NWP) / GWP
    const cededPremiumTrend: Array<{
      year: number;
      avgCededRatio: number;
      carriersWithData: number;
    }> = [];

    for (const year of years) {
      const withBoth = allData.filter(
        (d) =>
          d.year === year &&
          typeof d.gwp === "number" &&
          typeof d.nwp === "number" &&
          (d.gwp as number) > 0
      );
      if (withBoth.length > 0) {
        const ratios = withBoth.map(
          (d) =>
            (((d.gwp as number) - (d.nwp as number)) /
              (d.gwp as number)) *
            100
        );
        cededPremiumTrend.push({
          year,
          avgCededRatio: Number(
            (ratios.reduce((s, r) => s + r, 0) / ratios.length).toFixed(1)
          ),
          carriersWithData: withBoth.length,
        });
      }
    }

    // ─── Response ──────────────────────────────────────────────────────

    return NextResponse.json({
      rateCycle: {
        cyclePositionByCategory,
        industryTrend,
        yearAheadOutlook,
        promptTemplate,
      },
      investmentDependency: {
        carrierProfiles,
        scatterData,
        industryTrend: investmentTrend,
        latestYear: latestYearNum,
      },
      reinsurancePassThrough: {
        overlayData,
        cededPremiumTrend,
        commentary: commentary.map((c) => ({
          id: c.id,
          title: c.title,
          content: c.content,
          sentiment: c.sentiment,
          quarter: c.quarter,
          year: c.year,
          carrierName: c.carrier.name,
          carrierCategory: c.carrier.category,
          sourceDate: c.sourceDate,
        })),
      },
    });
  } catch (error) {
    console.error("Predictive API error:", error);
    return NextResponse.json(
      { error: "Failed to compute predictive intelligence data" },
      { status: 500 }
    );
  }
}
