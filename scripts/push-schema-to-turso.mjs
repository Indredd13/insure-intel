import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const statements = [
  `CREATE TABLE IF NOT EXISTS "Carrier" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "ticker" TEXT, "exchange" TEXT, "headquartersCountry" TEXT NOT NULL, "companyType" TEXT NOT NULL, "linesOfBusiness" TEXT NOT NULL DEFAULT '[]', "isPubliclyTraded" BOOLEAN NOT NULL DEFAULT false, "description" TEXT, "website" TEXT, "cikNumber" TEXT, "category" TEXT NOT NULL, "parentCompany" TEXT, "edgarLastSyncedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS "Filing" ("id" TEXT NOT NULL PRIMARY KEY, "carrierId" TEXT NOT NULL, "accessionNumber" TEXT NOT NULL, "formType" TEXT NOT NULL, "filingDate" DATETIME NOT NULL, "reportDate" DATETIME, "primaryDocument" TEXT, "description" TEXT, "edgarUrl" TEXT, "sectionsExtractedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Filing_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "FilingSection" ("id" TEXT NOT NULL PRIMARY KEY, "filingId" TEXT NOT NULL, "sectionKey" TEXT NOT NULL, "sectionTitle" TEXT NOT NULL, "content" TEXT NOT NULL, "wordCount" INTEGER NOT NULL DEFAULT 0, "extractedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "FilingSection_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "Filing" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "FinancialMetric" ("id" TEXT NOT NULL PRIMARY KEY, "carrierId" TEXT NOT NULL, "metricName" TEXT NOT NULL, "xbrlTag" TEXT, "value" REAL NOT NULL, "unit" TEXT NOT NULL, "periodStart" DATETIME, "periodEnd" DATETIME NOT NULL, "fiscalYear" INTEGER, "fiscalPeriod" TEXT, "formType" TEXT NOT NULL DEFAULT '', "filed" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "FinancialMetric_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "Commentary" ("id" TEXT NOT NULL PRIMARY KEY, "carrierId" TEXT NOT NULL, "source" TEXT NOT NULL, "category" TEXT NOT NULL, "quarter" INTEGER NOT NULL, "year" INTEGER NOT NULL, "title" TEXT NOT NULL, "content" TEXT NOT NULL, "sentiment" TEXT NOT NULL, "sourceDate" DATETIME NOT NULL, "sourceUrl" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, CONSTRAINT "Commentary_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "ComparisonReport" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "carrierIds" TEXT NOT NULL, "analysis" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS "Filing_carrierId_idx" ON "Filing"("carrierId")`,
  `CREATE INDEX IF NOT EXISTS "Filing_formType_idx" ON "Filing"("formType")`,
  `CREATE INDEX IF NOT EXISTS "Filing_filingDate_idx" ON "Filing"("filingDate")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Filing_carrierId_accessionNumber_key" ON "Filing"("carrierId", "accessionNumber")`,
  `CREATE INDEX IF NOT EXISTS "FilingSection_filingId_idx" ON "FilingSection"("filingId")`,
  `CREATE INDEX IF NOT EXISTS "FilingSection_sectionKey_idx" ON "FilingSection"("sectionKey")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FilingSection_filingId_sectionKey_key" ON "FilingSection"("filingId", "sectionKey")`,
  `CREATE INDEX IF NOT EXISTS "FinancialMetric_carrierId_idx" ON "FinancialMetric"("carrierId")`,
  `CREATE INDEX IF NOT EXISTS "FinancialMetric_metricName_idx" ON "FinancialMetric"("metricName")`,
  `CREATE INDEX IF NOT EXISTS "FinancialMetric_periodEnd_idx" ON "FinancialMetric"("periodEnd")`,
  `CREATE INDEX IF NOT EXISTS "FinancialMetric_carrierId_metricName_periodEnd_idx" ON "FinancialMetric"("carrierId", "metricName", "periodEnd")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FinancialMetric_carrierId_metricName_periodEnd_formType_key" ON "FinancialMetric"("carrierId", "metricName", "periodEnd", "formType")`,
  `CREATE INDEX IF NOT EXISTS "Commentary_carrierId_idx" ON "Commentary"("carrierId")`,
  `CREATE INDEX IF NOT EXISTS "Commentary_category_idx" ON "Commentary"("category")`,
  `CREATE INDEX IF NOT EXISTS "Commentary_year_quarter_idx" ON "Commentary"("year", "quarter")`,
  `CREATE INDEX IF NOT EXISTS "Commentary_carrierId_year_quarter_idx" ON "Commentary"("carrierId", "year", "quarter")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Commentary_carrierId_title_sourceDate_key" ON "Commentary"("carrierId", "title", "sourceDate")`,
  `CREATE INDEX IF NOT EXISTS "ComparisonReport_createdAt_idx" ON "ComparisonReport"("createdAt")`,
];

console.log("Pushing schema to Turso...");
for (const sql of statements) {
  const tableName = sql.match(/"(\w+)"/)?.[1] || "index";
  try {
    await client.execute(sql);
    console.log(`  ✓ ${tableName}`);
  } catch (err) {
    console.error(`  ✗ ${tableName}: ${err.message}`);
  }
}
console.log("Done!");
