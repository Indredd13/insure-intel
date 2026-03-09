import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeSectionDiff, computeDiffStats } from "@/lib/diff-utils";

// GET diff between two consecutive 10-K filing sections for a carrier
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const carrierId = searchParams.get("carrierId");
    const sectionKey = searchParams.get("sectionKey") || "item_1a";
    const filingId1 = searchParams.get("filingId1");
    const filingId2 = searchParams.get("filingId2");

    if (!carrierId) {
      return NextResponse.json(
        { error: "carrierId is required" },
        { status: 400 }
      );
    }

    let oldFilingId: string;
    let newFilingId: string;

    if (filingId1 && filingId2) {
      oldFilingId = filingId1;
      newFilingId = filingId2;
    } else {
      // Find the two most recent 10-K filings with extracted sections
      const filings = await prisma.filing.findMany({
        where: {
          carrierId,
          formType: { in: ["10-K", "10-K/A"] },
          sectionsExtractedAt: { not: null },
          sections: { some: { sectionKey } },
        },
        select: {
          id: true,
          filingDate: true,
          reportDate: true,
          formType: true,
        },
        orderBy: { filingDate: "desc" },
        take: 2,
      });

      if (filings.length < 2) {
        return NextResponse.json(
          {
            error: "Need at least 2 filings with extracted sections for this carrier",
            availableFilings: filings.length,
          },
          { status: 404 }
        );
      }

      newFilingId = filings[0].id;
      oldFilingId = filings[1].id;
    }

    // Fetch both sections
    const [oldSection, newSection] = await Promise.all([
      prisma.filingSection.findUnique({
        where: { filingId_sectionKey: { filingId: oldFilingId, sectionKey } },
        include: {
          filing: {
            select: {
              filingDate: true,
              reportDate: true,
              formType: true,
              carrier: { select: { name: true, ticker: true } },
            },
          },
        },
      }),
      prisma.filingSection.findUnique({
        where: { filingId_sectionKey: { filingId: newFilingId, sectionKey } },
        include: {
          filing: {
            select: {
              filingDate: true,
              reportDate: true,
              formType: true,
              carrier: { select: { name: true, ticker: true } },
            },
          },
        },
      }),
    ]);

    if (!oldSection || !newSection) {
      return NextResponse.json(
        { error: `Section "${sectionKey}" not found in one or both filings` },
        { status: 404 }
      );
    }

    // Compute diff
    const diff = computeSectionDiff(oldSection.content, newSection.content);
    const stats = computeDiffStats(diff);

    // Get the fiscal years from report dates
    const oldYear =
      oldSection.filing.reportDate?.getFullYear() ??
      oldSection.filing.filingDate.getFullYear();
    const newYear =
      newSection.filing.reportDate?.getFullYear() ??
      newSection.filing.filingDate.getFullYear();

    return NextResponse.json({
      carrierName: newSection.filing.carrier.name,
      carrierTicker: newSection.filing.carrier.ticker,
      sectionKey,
      sectionTitle: newSection.sectionTitle,
      oldFiling: {
        id: oldFilingId,
        year: oldYear,
        filingDate: oldSection.filing.filingDate,
        wordCount: oldSection.wordCount,
      },
      newFiling: {
        id: newFilingId,
        year: newYear,
        filingDate: newSection.filing.filingDate,
        wordCount: newSection.wordCount,
      },
      diff,
      stats,
    });
  } catch (error) {
    console.error("Filing diff error:", error);
    return NextResponse.json(
      { error: "Failed to compute filing diff" },
      { status: 500 }
    );
  }
}
