import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseFilingSections } from "@/lib/filing-parser";
import { persistFilingSections } from "@/lib/filing-sections-sync";

// Extract sections for a single filing or all 10-K filings for a carrier
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { filingId, carrierId, force } = body as {
      filingId?: string;
      carrierId?: string;
      force?: boolean;
    };

    if (!filingId && !carrierId) {
      return NextResponse.json(
        { error: "Provide either filingId or carrierId" },
        { status: 400 }
      );
    }

    // Get filings to process
    const filings = await prisma.filing.findMany({
      where: {
        ...(filingId ? { id: filingId } : {}),
        ...(carrierId ? { carrierId } : {}),
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
        message: "No filings to extract (all may already be extracted)",
        extracted: 0,
        errors: [],
      });
    }

    let totalSections = 0;
    const errors: string[] = [];

    for (const filing of filings) {
      try {
        const sections = await parseFilingSections(filing.edgarUrl!);
        if (sections.length > 0) {
          const count = await persistFilingSections(filing.id, sections);
          totalSections += count;
        } else {
          errors.push(
            `${filing.carrier.name} (${filing.filingDate.toISOString().split("T")[0]}): No sections found`
          );
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Unknown error";
        errors.push(
          `${filing.carrier.name} (${filing.filingDate.toISOString().split("T")[0]}): ${msg}`
        );
      }
    }

    return NextResponse.json({
      message: `Extracted ${totalSections} sections from ${filings.length - errors.length} filings`,
      extracted: totalSections,
      filingsProcessed: filings.length - errors.length,
      errors,
    });
  } catch (error) {
    console.error("Section extraction error:", error);
    return NextResponse.json(
      { error: "Failed to extract filing sections" },
      { status: 500 }
    );
  }
}
