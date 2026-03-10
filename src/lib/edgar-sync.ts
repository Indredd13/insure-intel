// ─── EDGAR Database Persistence ─────────────────────────────────────────────
// Upserts parsed EDGAR data into Prisma models and updates sync timestamps.

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

  // Upsert filings
  for (const filing of parsedFilings) {
    try {
      await prisma.filing.upsert({
        where: {
          carrierId_accessionNumber: {
            carrierId,
            accessionNumber: filing.accessionNumber,
          },
        },
        create: {
          carrierId,
          accessionNumber: filing.accessionNumber,
          formType: filing.formType,
          filingDate: filing.filingDate,
          reportDate: filing.reportDate,
          primaryDocument: filing.primaryDocument,
          description: filing.description,
          edgarUrl: filing.edgarUrl,
        },
        update: {
          formType: filing.formType,
          filingDate: filing.filingDate,
          reportDate: filing.reportDate,
          primaryDocument: filing.primaryDocument,
          description: filing.description,
          edgarUrl: filing.edgarUrl,
        },
      });
      result.filingsCount++;
    } catch (err) {
      const msg = `Filing ${filing.accessionNumber}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[sync] ${msg}`);
      result.errors.push(msg);
      result.filingsErrors++;
    }
  }

  // Upsert financial metrics
  for (const metric of parsedMetrics) {
    try {
      await prisma.financialMetric.upsert({
        where: {
          carrierId_metricName_periodEnd_formType: {
            carrierId,
            metricName: metric.metricName,
            periodEnd: metric.periodEnd,
            formType: metric.formType || "",
          },
        },
        create: {
          carrierId,
          metricName: metric.metricName,
          xbrlTag: metric.xbrlTag,
          value: metric.value,
          unit: metric.unit,
          periodStart: metric.periodStart,
          periodEnd: metric.periodEnd,
          fiscalYear: metric.fiscalYear,
          fiscalPeriod: metric.fiscalPeriod,
          formType: metric.formType || "",
          filed: metric.filed,
        },
        update: {
          xbrlTag: metric.xbrlTag,
          value: metric.value,
          unit: metric.unit,
          periodStart: metric.periodStart,
          fiscalYear: metric.fiscalYear,
          fiscalPeriod: metric.fiscalPeriod,
          filed: metric.filed,
        },
      });
      result.metricsCount++;
    } catch (err) {
      const msg = `Metric ${metric.metricName} @ ${metric.periodEnd.toISOString()}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[sync] ${msg}`);
      result.errors.push(msg);
      result.metricsErrors++;
    }
  }

  // Update last synced timestamp
  await prisma.carrier.update({
    where: { id: carrierId },
    data: { edgarLastSyncedAt: new Date() },
  });

  return result;
}
