import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Fetch all reinsurer carriers with related data
    const carriers = await prisma.carrier.findMany({
      where: { category: "reinsurer" },
      include: {
        financialMetrics: {
          where: { formType: "10-K" },
          orderBy: { periodEnd: "desc" },
        },
        commentaries: {
          orderBy: { sourceDate: "desc" },
          take: 5,
        },
      },
      orderBy: { name: "asc" },
    });

    // Parse carriers with LOB
    const parsedCarriers = carriers.map((c) => ({
      id: c.id,
      name: c.name,
      ticker: c.ticker,
      exchange: c.exchange,
      headquartersCountry: c.headquartersCountry,
      companyType: c.companyType,
      linesOfBusiness: JSON.parse(c.linesOfBusiness || "[]") as string[],
      isPubliclyTraded: c.isPubliclyTraded,
      parentCompany: c.parentCompany,
      cikNumber: c.cikNumber,
      description: c.description,
      website: c.website,
    }));

    // Stats
    const stats = {
      totalReinsurers: parsedCarriers.length,
      publiclyTraded: parsedCarriers.filter((c) => c.isPubliclyTraded).length,
      withEdgarData: parsedCarriers.filter((c) => c.cikNumber).length,
      countriesRepresented: new Set(parsedCarriers.map((c) => c.headquartersCountry)).size,
      privateSubsidiaries: parsedCarriers.filter((c) => c.parentCompany).length,
    };

    // Geographic distribution
    const geoMap = new Map<string, string[]>();
    for (const c of parsedCarriers) {
      const country = c.headquartersCountry;
      if (!geoMap.has(country)) geoMap.set(country, []);
      geoMap.get(country)!.push(c.name);
    }
    const geographicDistribution = Array.from(geoMap.entries())
      .map(([country, names]) => ({ country, count: names.length, carriers: names }))
      .sort((a, b) => b.count - a.count);

    // Ownership breakdown
    const ownershipBreakdown = {
      publicCount: parsedCarriers.filter((c) => c.isPubliclyTraded).length,
      privateCount: parsedCarriers.filter((c) => !c.isPubliclyTraded).length,
      withParent: parsedCarriers
        .filter((c) => c.parentCompany)
        .map((c) => ({ name: c.name, parent: c.parentCompany! })),
    };

    // Lines of business matrix
    const allLines = new Set<string>();
    for (const c of parsedCarriers) {
      for (const line of c.linesOfBusiness) {
        allLines.add(line);
      }
    }
    const lobMatrix = {
      lines: Array.from(allLines).sort(),
      carriers: parsedCarriers.map((c) => ({
        id: c.id,
        name: c.name,
        lines: c.linesOfBusiness,
      })),
    };

    // Financial comparison — pivot metrics for carriers with CIK
    const carriersWithData = carriers.filter((c) => c.cikNumber && c.financialMetrics.length > 0);
    const combinedRatioTrend: Record<number, Record<string, number | null>> = {};
    const premiumTrend: Record<number, Record<string, number | null>> = {};

    for (const carrier of carriersWithData) {
      // Pivot by year
      const yearMetrics = new Map<number, Record<string, number>>();
      for (const m of carrier.financialMetrics) {
        if (!m.fiscalYear) continue;
        if (!yearMetrics.has(m.fiscalYear)) yearMetrics.set(m.fiscalYear, {});
        const record = yearMetrics.get(m.fiscalYear)!;
        if (record[m.metricName] === undefined) {
          record[m.metricName] = m.value;
        }
      }

      for (const [year, metrics] of yearMetrics) {
        // Combined ratio
        if (metrics.combined_ratio !== undefined) {
          if (!combinedRatioTrend[year]) combinedRatioTrend[year] = {};
          combinedRatioTrend[year][carrier.name] = Number((metrics.combined_ratio * 100).toFixed(1));
        }
        // NWP
        if (metrics.nwp !== undefined) {
          if (!premiumTrend[year]) premiumTrend[year] = {};
          premiumTrend[year][carrier.name] = Number((metrics.nwp / 1e9).toFixed(2));
        }
      }
    }

    const financialComparison = {
      combinedRatioTrend: Object.entries(combinedRatioTrend)
        .map(([year, data]) => ({ year: parseInt(year), ...data }))
        .sort((a, b) => a.year - b.year),
      premiumTrend: Object.entries(premiumTrend)
        .map(([year, data]) => ({ year: parseInt(year), ...data }))
        .sort((a, b) => a.year - b.year),
      carriersWithData: carriersWithData.map((c) => ({
        id: c.id,
        name: c.name,
        ticker: c.ticker!,
      })),
    };

    // Recent commentary across all reinsurer carriers
    const allCommentaries = await prisma.commentary.findMany({
      where: {
        carrierId: { in: carriers.map((c) => c.id) },
      },
      include: {
        carrier: { select: { name: true } },
      },
      orderBy: { sourceDate: "desc" },
      take: 20,
    });

    const recentCommentary = allCommentaries.map((c) => ({
      id: c.id,
      carrierId: c.carrierId,
      carrierName: c.carrier.name,
      title: c.title,
      content: c.content,
      category: c.category,
      sentiment: c.sentiment,
      sourceDate: c.sourceDate.toISOString(),
      source: c.source,
      quarter: c.quarter,
      year: c.year,
    }));

    return NextResponse.json({
      carriers: parsedCarriers,
      stats,
      geographicDistribution,
      ownershipBreakdown,
      lobMatrix,
      financialComparison,
      recentCommentary,
    });
  } catch (error) {
    console.error("Error fetching reinsurance data:", error);
    return NextResponse.json(
      { error: "Failed to fetch reinsurance data" },
      { status: 500 }
    );
  }
}
