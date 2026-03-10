import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncCarrierEdgarData } from "@/lib/edgar";
import { persistEdgarData } from "@/lib/edgar-sync";

export const maxDuration = 60; // Vercel free tier limit

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const offset = Number(body.offset) || 0;
    const limit = Number(body.limit) || 6; // 6 carriers per batch fits within 60s

    const allCarriers = await prisma.carrier.findMany({
      where: { cikNumber: { not: null } },
      orderBy: { name: "asc" },
    });

    const batch = allCarriers.slice(offset, offset + limit);
    const totalCarriers = allCarriers.length;
    const hasMore = offset + limit < totalCarriers;

    const results: Array<{
      name: string;
      ticker: string | null;
      filings: number;
      metrics: number;
      metricsErrors?: number;
      errors?: string[];
      error?: string;
    }> = [];

    for (const carrier of batch) {
      try {
        const { parsedFilings, parsedMetrics } = await syncCarrierEdgarData(carrier.cikNumber!);
        const syncResult = await persistEdgarData(
          carrier.id,
          parsedFilings,
          parsedMetrics
        );

        results.push({
          name: carrier.name,
          ticker: carrier.ticker,
          filings: syncResult.filingsCount,
          metrics: syncResult.metricsCount,
          metricsErrors: syncResult.metricsErrors + syncResult.filingsErrors,
          errors: syncResult.errors.length > 0 ? syncResult.errors.slice(0, 5) : undefined,
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
      message: `Synced batch ${offset + 1}-${offset + batch.length} of ${totalCarriers} carriers — ${totalFilings} filings, ${totalMetrics} metrics`,
      successCount,
      batchSize: batch.length,
      totalCarriers,
      totalFilings,
      totalMetrics,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
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
