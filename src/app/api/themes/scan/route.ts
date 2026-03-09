import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scanMultipleTexts } from "@/lib/theme-scanner";
import { THEME_DICTIONARY } from "@/lib/theme-dictionary";

// GET theme scan results across all filing sections
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const carrierId = searchParams.get("carrierId");
    const sectionKey = searchParams.get("sectionKey");

    // Fetch all filing sections with carrier/filing info
    const sections = await prisma.filingSection.findMany({
      where: {
        ...(sectionKey ? { sectionKey } : {}),
        filing: {
          ...(carrierId ? { carrierId } : {}),
          formType: { in: ["10-K", "10-K/A"] },
        },
      },
      select: {
        content: true,
        sectionKey: true,
        filing: {
          select: {
            carrierId: true,
            filingDate: true,
            reportDate: true,
            carrier: {
              select: {
                id: true,
                name: true,
                ticker: true,
                category: true,
              },
            },
          },
        },
      },
    });

    if (sections.length === 0) {
      return NextResponse.json({
        trendByYear: [],
        byCarrier: [],
        keywordDetails: [],
        themes: THEME_DICTIONARY.map((t) => ({
          id: t.id,
          label: t.label,
          color: t.color,
          chartColor: t.chartColor,
        })),
        totalSections: 0,
      });
    }

    // Build carrier lookup
    const carrierMap = new Map<
      string,
      { name: string; ticker: string | null; category: string }
    >();
    for (const s of sections) {
      if (!carrierMap.has(s.filing.carrierId)) {
        carrierMap.set(s.filing.carrierId, {
          name: s.filing.carrier.name,
          ticker: s.filing.carrier.ticker,
          category: s.filing.carrier.category,
        });
      }
    }

    // Prepare texts for scanning
    const texts = sections.map((s) => ({
      text: s.content,
      meta: {
        carrierId: s.filing.carrierId,
        year:
          s.filing.reportDate?.getFullYear() ??
          s.filing.filingDate.getFullYear(),
        sectionKey: s.sectionKey,
      },
    }));

    // Scan all texts
    const { byYear, byCarrier, keywordDetails } = scanMultipleTexts(texts);

    // Format trendByYear for charts
    const years = Object.keys(byYear)
      .map(Number)
      .sort();
    const trendByYear = years.map((year) => {
      const entry: Record<string, number | string> = { year };
      for (const theme of THEME_DICTIONARY) {
        entry[theme.id] = byYear[year]?.[theme.id] ?? 0;
      }
      return entry;
    });

    // Format byCarrier for charts
    const byCarrierList = Object.entries(byCarrier).map(
      ([cid, themeHits]) => {
        const carrier = carrierMap.get(cid);
        return {
          carrierId: cid,
          carrierName: carrier?.name ?? cid,
          carrierTicker: carrier?.ticker ?? null,
          category: carrier?.category ?? "unknown",
          ...themeHits,
        } as Record<string, string | number | null>;
      }
    );

    // Sort by total hits descending
    byCarrierList.sort((a, b) => {
      const aTotal = THEME_DICTIONARY.reduce(
        (s, t) => s + ((a[t.id] as number) || 0),
        0
      );
      const bTotal = THEME_DICTIONARY.reduce(
        (s, t) => s + ((b[t.id] as number) || 0),
        0
      );
      return bTotal - aTotal;
    });

    // Aggregate keyword details: group by keyword across carriers
    const keywordAgg = new Map<
      string,
      {
        keyword: string;
        themeId: string;
        totalCount: number;
        carrierCount: number;
        carriers: Set<string>;
        occurrences: Array<{
          carrierId: string;
          carrierName: string;
          year: number;
          sectionKey: string;
          count: number;
        }>;
      }
    >();

    for (const detail of keywordDetails) {
      const existing = keywordAgg.get(detail.keyword);
      const carrierName =
        carrierMap.get(detail.carrierId)?.name ?? detail.carrierId;

      if (existing) {
        existing.totalCount += detail.count;
        existing.carriers.add(detail.carrierId);
        existing.carrierCount = existing.carriers.size;
        existing.occurrences.push({
          carrierId: detail.carrierId,
          carrierName,
          year: detail.year,
          sectionKey: detail.sectionKey,
          count: detail.count,
        });
      } else {
        keywordAgg.set(detail.keyword, {
          keyword: detail.keyword,
          themeId: detail.themeId,
          totalCount: detail.count,
          carrierCount: 1,
          carriers: new Set([detail.carrierId]),
          occurrences: [
            {
              carrierId: detail.carrierId,
              carrierName,
              year: detail.year,
              sectionKey: detail.sectionKey,
              count: detail.count,
            },
          ],
        });
      }
    }

    // Convert to serializable format, sorted by total count
    const keywordDetailsList = [...keywordAgg.values()]
      .map(({ carriers, ...rest }) => ({
        ...rest,
        carrierCount: carriers.size,
      }))
      .sort((a, b) => b.totalCount - a.totalCount);

    return NextResponse.json({
      trendByYear,
      byCarrier: byCarrierList,
      keywordDetails: keywordDetailsList,
      themes: THEME_DICTIONARY.map((t) => ({
        id: t.id,
        label: t.label,
        color: t.color,
        chartColor: t.chartColor,
      })),
      totalSections: sections.length,
    });
  } catch (error) {
    console.error("Theme scan error:", error);
    return NextResponse.json(
      { error: "Failed to scan themes" },
      { status: 500 }
    );
  }
}
