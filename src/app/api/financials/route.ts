import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const carrierId = searchParams.get("carrierId");
    const metricName = searchParams.get("metricName");
    const annualOnly = searchParams.get("annualOnly") === "true";

    if (!carrierId) {
      return NextResponse.json({ error: "carrierId is required" }, { status: 400 });
    }

    const where: Record<string, unknown> = { carrierId };
    if (metricName) {
      where.metricName = metricName;
    }
    if (annualOnly) {
      where.formType = "10-K";
    }

    const metrics = await prisma.financialMetric.findMany({
      where,
      orderBy: { periodEnd: "desc" },
    });

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Error fetching financial metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch financial metrics" },
      { status: 500 }
    );
  }
}
