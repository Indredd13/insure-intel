import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET filing sections by filingId, optionally filtered by sectionKey
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filingId = searchParams.get("filingId");
    const sectionKey = searchParams.get("sectionKey");

    if (!filingId) {
      return NextResponse.json(
        { error: "filingId is required" },
        { status: 400 }
      );
    }

    const sections = await prisma.filingSection.findMany({
      where: {
        filingId,
        ...(sectionKey ? { sectionKey } : {}),
      },
      select: {
        id: true,
        sectionKey: true,
        sectionTitle: true,
        content: true,
        wordCount: true,
        extractedAt: true,
      },
      orderBy: { sectionKey: "asc" },
    });

    return NextResponse.json(sections);
  } catch (error) {
    console.error("Filing sections GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch filing sections" },
      { status: 500 }
    );
  }
}
