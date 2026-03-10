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

/**
 * Deduplicate metrics by their unique key (metricName + periodEnd + formType).
 * SEC XBRL data often has duplicate entries; keep the last one per key.
 */
function deduplicateMetrics(
  carrierId: string,
  metrics: ParsedMetric[]
): Array<{
  carrierId: string;
  metricName: string;
  xbrlTag: string;
  value: number;
  unit: string;
  periodStart: Date | null;
  periodEnd: Date;
  fiscalYear: number | null;
  fiscalPeriod: string | null;
  formType: string;
  filed: Date | null;
}> {
  const map = new Map<
    string,
    {
      carrierId: string;
      metricName: string;
      xbrlTag: string;
      value: number;
      unit: string;
      periodStart: Date | null;
      periodEnd: Date;
      fiscalYear: number | null;
      fiscalPeriod: string | null;
      formType: string;
      filed: Date | null;
    }
  >();

  for (const m of metrics) {
    const key = `${m.metricName}|${m.periodEnd.toISOString()}|${m.formType || ""}`;
    map.set(key, {
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
    });
  }

  return Array.from(map.values());
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

  // Bulk persist filings: delete existing then createMany
  try {
    await prisma.filing.deleteMany({ where: { carrierId } });
    if (parsedFilings.length > 0) {
      await prisma.filing.createMany({
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
      });
    }
    result.filingsCount = parsedFilings.length;
  } catch (err) {
    const msg = `Filings bulk insert: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[sync] ${msg}`);
    result.errors.push(msg);
    result.filingsErrors = parsedFilings.length;
  }

  // Bulk persist metrics: deduplicate, delete existing, then createMany
  try {
    const uniqueMetrics = deduplicateMetrics(carrierId, parsedMetrics);
    console.log(
      `[sync] Carrier ${carrierId}: ${parsedMetrics.length} raw metrics → ${uniqueMetrics.length} unique metrics`
    );

    await prisma.financialMetric.deleteMany({ where: { carrierId } });
    if (uniqueMetrics.length > 0) {
      await prisma.financialMetric.createMany({
        data: uniqueMetrics,
      });
    }
    result.metricsCount = uniqueMetrics.length;
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
