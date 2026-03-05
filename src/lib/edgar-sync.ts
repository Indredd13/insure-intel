// ─── EDGAR Database Persistence ─────────────────────────────────────────────
// Upserts parsed EDGAR data into Prisma models and updates sync timestamps.

import { prisma } from "@/lib/prisma";
import type { ParsedFiling, ParsedMetric } from "@/lib/edgar";

export async function persistEdgarData(
  carrierId: string,
  parsedFilings: ParsedFiling[],
  parsedMetrics: ParsedMetric[]
): Promise<{ filingsCount: number; metricsCount: number }> {
  let filingsCount = 0;
  let metricsCount = 0;

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
      filingsCount++;
    } catch (err) {
      console.error(`Failed to upsert filing ${filing.accessionNumber}:`, err);
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
      metricsCount++;
    } catch (err) {
      console.error(`Failed to upsert metric ${metric.metricName} for period ${metric.periodEnd}:`, err);
    }
  }

  // Update last synced timestamp
  await prisma.carrier.update({
    where: { id: carrierId },
    data: { edgarLastSyncedAt: new Date() },
  });

  return { filingsCount, metricsCount };
}
