import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Fetch all auto dealer niche carriers with related data
    const carriers = await prisma.carrier.findMany({
      where: { category: "auto_dealer_niche" },
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
      totalCarriers: parsedCarriers.length,
      primaryCarriers: parsedCarriers.filter((c) => c.companyType === "primary_carrier").length,
      mgaAndBrokers: parsedCarriers.filter((c) => c.companyType === "mga_specialty" || c.companyType === "broker").length,
      mutuals: parsedCarriers.filter((c) => c.companyType === "mutual").length,
      withEdgarData: parsedCarriers.filter((c) => c.cikNumber).length,
      uniqueProducts: new Set(parsedCarriers.flatMap((c) => c.linesOfBusiness)).size,
    };

    // Company type breakdown
    const typeMap = new Map<string, string[]>();
    for (const c of parsedCarriers) {
      if (!typeMap.has(c.companyType)) typeMap.set(c.companyType, []);
      typeMap.get(c.companyType)!.push(c.name);
    }
    const typeLabels: Record<string, string> = {
      primary_carrier: "Primary Carrier",
      mga_specialty: "MGA / Specialty",
      broker: "Broker",
      mutual: "Mutual",
    };
    const companyTypeBreakdown = Array.from(typeMap.entries())
      .map(([type, names]) => ({
        type,
        label: typeLabels[type] || type,
        count: names.length,
        carriers: names,
      }))
      .sort((a, b) => b.count - a.count);

    // Product matrix
    const allProducts = new Set<string>();
    for (const c of parsedCarriers) {
      for (const product of c.linesOfBusiness) {
        allProducts.add(product);
      }
    }
    const productMatrix = {
      products: Array.from(allProducts).sort(),
      carriers: parsedCarriers.map((c) => ({
        id: c.id,
        name: c.name,
        companyType: c.companyType,
        products: c.linesOfBusiness,
      })),
    };

    // Ally Financial spotlight (CIK: 0000040730)
    const allyCarrier = carriers.find((c) => c.cikNumber === "0000040730");
    let allySpotlight = null;

    if (allyCarrier && allyCarrier.financialMetrics.length > 0) {
      // Pivot by year
      const yearMetrics = new Map<number, Record<string, number>>();
      for (const m of allyCarrier.financialMetrics) {
        if (!m.fiscalYear) continue;
        if (!yearMetrics.has(m.fiscalYear)) yearMetrics.set(m.fiscalYear, {});
        const record = yearMetrics.get(m.fiscalYear)!;
        if (record[m.metricName] === undefined) {
          record[m.metricName] = m.value;
        }
      }

      const years = Array.from(yearMetrics.keys()).sort((a, b) => a - b);
      const latestYear = years.length > 0 ? years[years.length - 1] : null;
      const previousYear = years.length > 1 ? years[years.length - 2] : null;

      allySpotlight = {
        carrierId: allyCarrier.id,
        hasData: true,
        latestMetrics: latestYear ? yearMetrics.get(latestYear)! : null,
        previousMetrics: previousYear ? yearMetrics.get(previousYear)! : null,
        latestYear,
        combinedRatioTrend: years
          .filter((y) => yearMetrics.get(y)?.combined_ratio !== undefined)
          .map((y) => ({
            year: y,
            value: Number((yearMetrics.get(y)!.combined_ratio * 100).toFixed(1)),
          })),
        premiumTrend: years
          .filter((y) => yearMetrics.get(y)?.nwp !== undefined)
          .map((y) => ({
            year: y,
            value: Number((yearMetrics.get(y)!.nwp / 1e9).toFixed(2)),
          })),
      };
    } else if (allyCarrier) {
      allySpotlight = {
        carrierId: allyCarrier.id,
        hasData: false,
        latestMetrics: null,
        previousMetrics: null,
        latestYear: null,
        combinedRatioTrend: [],
        premiumTrend: [],
      };
    }

    // Recent commentary across all auto dealer carriers
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
      companyTypeBreakdown,
      productMatrix,
      allySpotlight,
      recentCommentary,
    });
  } catch (error) {
    console.error("Error fetching auto dealer data:", error);
    return NextResponse.json(
      { error: "Failed to fetch auto dealer data" },
      { status: 500 }
    );
  }
}
