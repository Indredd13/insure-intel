import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncCarrierEdgarData } from "@/lib/edgar";
import { persistEdgarData } from "@/lib/edgar-sync";

export async function POST(request: Request) {
  try {
    const { carrierId } = await request.json();

    if (!carrierId) {
      return NextResponse.json({ error: "carrierId is required" }, { status: 400 });
    }

    const carrier = await prisma.carrier.findUnique({ where: { id: carrierId } });
    if (!carrier) {
      return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    }
    if (!carrier.cikNumber) {
      return NextResponse.json({ error: "Carrier has no CIK number" }, { status: 400 });
    }

    // Enable diagnostics for single-carrier sync to help debug missing data
    const { parsedFilings, parsedMetrics } = await syncCarrierEdgarData(
      carrier.cikNumber,
      { diagnostics: true }
    );
    const syncResult = await persistEdgarData(carrierId, parsedFilings, parsedMetrics);

    return NextResponse.json({
      message: `Synced ${carrier.name}: ${syncResult.filingsCount} filings, ${syncResult.metricsCount} metrics`,
      filingsCount: syncResult.filingsCount,
      metricsCount: syncResult.metricsCount,
      errors: syncResult.errors.length > 0 ? syncResult.errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    console.error("Error fetching EDGAR data:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch EDGAR data" },
      { status: 500 }
    );
  }
}
