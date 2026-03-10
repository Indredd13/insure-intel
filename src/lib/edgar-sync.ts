// ─── EDGAR Database Persistence ─────────────────────────────────────────────
// Bulk-persists parsed EDGAR data into Prisma models using delete + createMany
// to minimize round-trips to remote Turso database.

import { prisma } from "@/lib/prisma";
import type { ParsedFiling, ParsedMetric } from "@/lib/edgar";

export interface SyncResult {
  filingsCount: number;
  metricsCount: number;
  filingsErrors: number;
  metricsErrors: number;
  errors: string[];
}

export async function persistEdgarData(
  carrierId: string,
  parsedFilings: ParsedFiling[],
  parsedMetrics: ParsedMetric[]
): Promise<SyncResult> {
  const result: SyncResult = {
    filingsCount: 0,
    metricsCount: 0,
    filingsErrors: 0,
    metricsErrors: 0,
    errors: [],
  };

  // Bulk persist filings: delete existing + createMany in a transaction
  try {
    await prisma.$transaction([
      prisma.filing.deleteMany({ where: { carrierId } }),
      prisma.filing.createMany({
        data: parsedFilings.map((f) => ({
          carrierId,
          accessionNumber: f.accessionNumber,
          formType: f.formType,
          filingDate: f.filingDate,
          reportDate: f.reportDate,
          primaryDocument: f.primaryDocument,
          description: f.description,
          edgarUrl: f.edgarUrl,
        })),
      }),
    ]);
    result.filingsCount = parsedFilings.length;
  } catch (err) {
    const msg = `Filings bulk insert: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[sync] ${msg}`);
    result.errors.push(msg);
    result.filingsErrors = parsedFilings.length;
  }

  // Bulk persist metrics: delete existing + createMany in a transaction
  try {
    await prisma.$transaction([
      prisma.financialMetric.deleteMany({ where: { carrierId } }),
      prisma.financialMetric.createMany({
        data: parsedMetrics.map((m) => ({
          carrierId,
          metricName: m.metricName,
          xbrlTag: m.xbrlTag,
          value: m.value,
          unit: m.unit,
          periodStart: m.periodStart,
          periodEnd: m.periodEnd,
          fiscalYear: m.fiscalYear,
          fiscalPeriod: m.fiscalPeriod,
          formType: m.formType || "",
          filed: m.filed,
        })),
      }),
    ]);
    result.metricsCount = parsedMetrics.length;
  } catch (err) {
    const msg = `Metrics bulk insert: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[sync] ${msg}`);
    result.errors.push(msg);
    result.metricsErrors = parsedMetrics.length;
  }

  // Update last synced timestamp
  await prisma.carrier.update({
    where: { id: carrierId },
    data: { edgarLastSyncedAt: new Date() },
  });

  return result;
}
