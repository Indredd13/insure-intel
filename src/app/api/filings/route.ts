import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const carrierId = searchParams.get("carrierId");
    const formType = searchParams.get("formType");

    // If no carrierId, return cross-carrier list (latest 100)
    if (!carrierId) {
      const filings = await prisma.filing.findMany({
        include: {
          carrier: {
            select: { name: true, ticker: true, id: true },
          },
        },
        orderBy: { filingDate: "desc" },
        take: 100,
        ...(formType ? { where: { formType } } : {}),
      });
      return NextResponse.json(filings);
    }

    const where: Record<string, unknown> = { carrierId };
    if (formType) {
      where.formType = formType;
    }

    const filings = await prisma.filing.findMany({
      where,
      orderBy: { filingDate: "desc" },
    });

    return NextResponse.json(filings);
  } catch (error) {
    console.error("Error fetching filings:", error);
    return NextResponse.json(
      { error: "Failed to fetch filings" },
      { status: 500 }
    );
  }
}
