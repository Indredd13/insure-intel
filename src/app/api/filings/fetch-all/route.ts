import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncCarrierEdgarData } from "@/lib/edgar";
import { persistEdgarData } from "@/lib/edgar-sync";

export const maxDuration = 60; // Allow up to 60s for batch sync

export async function POST() {
  try {
    const carriers = await prisma.carrier.findMany({
      where: {
        cikNumber: { not: null },
      },
    });

    const results: Array<{
      name: string;
      ticker: string | null;
      filings: number;
      metrics: number;
      error?: string;
    }> = [];

    for (const carrier of carriers) {
      try {
        const { parsedFilings, parsedMetrics } = await syncCarrierEdgarData(carrier.cikNumber!);
        const { filingsCount, metricsCount } = await persistEdgarData(
          carrier.id,
          parsedFilings,
          parsedMetrics
        );

        results.push({
          name: carrier.name,
          ticker: carrier.ticker,
          filings: filingsCount,
          metrics: metricsCount,
        });
      } catch (err) {
        console.error(`Failed to sync ${carrier.name}:`, err);
        results.push({
          name: carrier.name,
          ticker: carrier.ticker,
          filings: 0,
          metrics: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => !r.error).length;
    const totalFilings = results.reduce((sum, r) => sum + r.filings, 0);
    const totalMetrics = results.reduce((sum, r) => sum + r.metrics, 0);

    return NextResponse.json({
      message: `Synced ${successCount} of ${carriers.length} carriers — ${totalFilings} filings, ${totalMetrics} metrics`,
      successCount,
      totalCarriers: carriers.length,
      totalFilings,
      totalMetrics,
      results,
    });
  } catch (error) {
    console.error("Error in batch EDGAR sync:", error);
    return NextResponse.json(
      { error: "Failed to batch sync EDGAR data" },
      { status: 500 }
    );
  }
}
