import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const reports = await prisma.comparisonReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Resolve carrier names for each report
    const enrichedReports = await Promise.all(
      reports.map(async (report) => {
        const carrierIds = JSON.parse(report.carrierIds) as string[];
        const carriers = await prisma.carrier.findMany({
          where: { id: { in: carrierIds } },
          select: { id: true, name: true, ticker: true },
        });
        return {
          ...report,
          carrierIds,
          carriers,
        };
      })
    );

    return NextResponse.json(enrichedReports);
  } catch (error) {
    console.error("Error fetching comparison reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch comparison reports" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, carrierIds, analysis } = body;

    if (!title || !carrierIds || !Array.isArray(carrierIds) || carrierIds.length < 2) {
      return NextResponse.json(
        { error: "title and carrierIds (array of 2-3 IDs) are required" },
        { status: 400 }
      );
    }

    const report = await prisma.comparisonReport.create({
      data: {
        title,
        carrierIds: JSON.stringify(carrierIds),
        analysis: analysis || "",
      },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error("Error creating comparison report:", error);
    return NextResponse.json(
      { error: "Failed to create comparison report" },
      { status: 500 }
    );
  }
}
