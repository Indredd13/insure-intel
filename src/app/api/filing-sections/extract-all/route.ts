import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseFilingSections } from "@/lib/filing-parser";
import { persistFilingSections } from "@/lib/filing-sections-sync";

export const maxDuration = 120;

// Extract sections for all 10-K filings across all carriers
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const force = (body as { force?: boolean }).force ?? false;

    const filings = await prisma.filing.findMany({
      where: {
        formType: { in: ["10-K", "10-K/A"] },
        edgarUrl: { not: null },
        ...(force ? {} : { sectionsExtractedAt: null }),
      },
      select: {
        id: true,
        edgarUrl: true,
        formType: true,
        filingDate: true,
        carrier: { select: { name: true } },
      },
      orderBy: { filingDate: "desc" },
    });

    if (filings.length === 0) {
      return NextResponse.json({
        message: "No filings to extract",
        extracted: 0,
        filingsProcessed: 0,
        errors: [],
      });
    }

    let totalSections = 0;
    let filingsProcessed = 0;
    const errors: string[] = [];

    for (const filing of filings) {
      try {
        const sections = await parseFilingSections(filing.edgarUrl!);
        if (sections.length > 0) {
          const count = await persistFilingSections(filing.id, sections);
          totalSections += count;
          filingsProcessed++;
        } else {
          errors.push(
            `${filing.carrier.name} (${filing.filingDate.toISOString().split("T")[0]}): No sections found`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(
          `${filing.carrier.name} (${filing.filingDate.toISOString().split("T")[0]}): ${msg}`
        );
      }
    }

    return NextResponse.json({
      message: `Extracted ${totalSections} sections from ${filingsProcessed} of ${filings.length} filings`,
      extracted: totalSections,
      filingsProcessed,
      totalFilings: filings.length,
      errors,
    });
  } catch (error) {
    console.error("Batch section extraction error:", error);
    return NextResponse.json(
      { error: "Failed to extract filing sections" },
      { status: 500 }
    );
  }
}
