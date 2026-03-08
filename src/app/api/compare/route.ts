import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const carrierIds = searchParams.get("carriers");

    if (!carrierIds) {
      return NextResponse.json(
        { error: "carriers query parameter is required (comma-separated IDs)" },
        { status: 400 }
      );
    }

    const ids = carrierIds.split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.length < 2 || ids.length > 3) {
      return NextResponse.json(
        { error: "Please select 2 or 3 carriers to compare" },
        { status: 400 }
      );
    }

    // Fetch carriers with all related data
    const carriers = await prisma.carrier.findMany({
      where: { id: { in: ids } },
      include: {
        financialMetrics: {
          where: { formType: "10-K" },
          orderBy: { periodEnd: "desc" },
        },
        commentaries: {
          orderBy: { sourceDate: "desc" },
          take: 10,
        },
      },
    });

    if (carriers.length < 2) {
      return NextResponse.json(
        { error: "Could not find all selected carriers" },
        { status: 404 }
      );
    }

    // Parse carriers
    const parsedCarriers = carriers.map((c) => {
      const lob = JSON.parse(c.linesOfBusiness || "[]") as string[];
      return {
        id: c.id,
        name: c.name,
        ticker: c.ticker,
        exchange: c.exchange,
        headquartersCountry: c.headquartersCountry,
        companyType: c.companyType,
        linesOfBusiness: lob,
        isPubliclyTraded: c.isPubliclyTraded,
        parentCompany: c.parentCompany,
        cikNumber: c.cikNumber,
        description: c.description,
        website: c.website,
        category: c.category,
      };
    });

    // --- Financial Comparison ---
    // Pivot each carrier's metrics by year
    const carrierFinancials: Record<string, Map<number, Record<string, number>>> = {};

    for (const carrier of carriers) {
      const yearMap = new Map<number, Record<string, number>>();
      for (const m of carrier.financialMetrics) {
        if (!m.fiscalYear) continue;
        if (!yearMap.has(m.fiscalYear)) yearMap.set(m.fiscalYear, {});
        const record = yearMap.get(m.fiscalYear)!;
        if (record[m.metricName] === undefined) {
          record[m.metricName] = m.value;
        }
      }
      carrierFinancials[carrier.id] = yearMap;
    }

    // Collect all years across all carriers
    const allYears = new Set<number>();
    for (const yearMap of Object.values(carrierFinancials)) {
      for (const year of yearMap.keys()) {
        allYears.add(year);
      }
    }
    const years = Array.from(allYears).sort((a, b) => a - b);

    // Build combined ratio trend (one column per carrier)
    const combinedRatioTrend = years
      .map((year) => {
        const point: Record<string, number | null> = { year };
        let hasData = false;
        for (const carrier of carriers) {
          const metrics = carrierFinancials[carrier.id]?.get(year);
          if (metrics?.combined_ratio !== undefined) {
            point[carrier.name] = Number((metrics.combined_ratio * 100).toFixed(1));
            hasData = true;
          } else {
            point[carrier.name] = null;
          }
        }
        return hasData ? point : null;
      })
      .filter(Boolean);

    // Build NWP trend
    const nwpTrend = years
      .map((year) => {
        const point: Record<string, number | null> = { year };
        let hasData = false;
        for (const carrier of carriers) {
          const metrics = carrierFinancials[carrier.id]?.get(year);
          if (metrics?.nwp !== undefined) {
            point[carrier.name] = Number((metrics.nwp / 1e9).toFixed(2));
            hasData = true;
          } else {
            point[carrier.name] = null;
          }
        }
        return hasData ? point : null;
      })
      .filter(Boolean);

    // Latest year metrics for comparison table
    const latestYear = years.length > 0 ? years[years.length - 1] : null;
    const metricNames = [
      { key: "combined_ratio", label: "Combined Ratio", format: "ratio" },
      { key: "loss_ratio", label: "Loss Ratio", format: "ratio" },
      { key: "expense_ratio", label: "Expense Ratio", format: "ratio" },
      { key: "nwp", label: "Net Written Premiums", format: "currency" },
      { key: "nep", label: "Net Earned Premiums", format: "currency" },
      { key: "net_income", label: "Net Income", format: "currency" },
      { key: "investment_income", label: "Investment Income", format: "currency" },
      { key: "stockholders_equity", label: "Stockholders' Equity", format: "currency" },
      { key: "total_revenue", label: "Total Revenue", format: "currency" },
    ];

    const latestMetrics = carriers.map((carrier) => {
      const metrics = latestYear
        ? carrierFinancials[carrier.id]?.get(latestYear) || {}
        : {};
      return {
        carrierId: carrier.id,
        carrierName: carrier.name,
        hasCik: !!carrier.cikNumber,
        metrics,
      };
    });

    // --- LOB Overlap ---
    const carrierLobs = parsedCarriers.map((c) => ({
      id: c.id,
      name: c.name,
      lines: c.linesOfBusiness,
    }));

    const allLines = new Set<string>();
    for (const c of carrierLobs) {
      for (const line of c.lines) allLines.add(line);
    }

    const sharedLines = Array.from(allLines).filter((line) =>
      carrierLobs.every((c) => c.lines.includes(line))
    );

    const lobOverlap = {
      allLines: Array.from(allLines).sort(),
      sharedLines: sharedLines.sort(),
      carriers: carrierLobs.map((c) => ({
        id: c.id,
        name: c.name,
        uniqueLines: c.lines.filter((l) => !sharedLines.includes(l)).sort(),
        totalLines: c.lines.length,
      })),
    };

    // --- Commentary ---
    const commentarySummary = carriers.map((carrier) => ({
      carrierId: carrier.id,
      carrierName: carrier.name,
      entries: carrier.commentaries.map((c) => ({
        id: c.id,
        title: c.title,
        content: c.content,
        category: c.category,
        sentiment: c.sentiment,
        sourceDate: c.sourceDate.toISOString(),
        source: c.source,
        quarter: c.quarter,
        year: c.year,
      })),
    }));

    // --- AI Prompt Template ---
    const carrierSummaries = parsedCarriers
      .map((c) => {
        const metrics = latestYear
          ? carrierFinancials[c.id]?.get(latestYear)
          : null;
        const metricStr = metrics
          ? Object.entries(metrics)
              .map(([k, v]) => {
                if (k.includes("ratio")) return `${k}: ${(v * 100).toFixed(1)}%`;
                if (v > 1e9) return `${k}: $${(v / 1e9).toFixed(1)}B`;
                if (v > 1e6) return `${k}: $${(v / 1e6).toFixed(0)}M`;
                return `${k}: ${v}`;
              })
              .join(", ")
          : "No EDGAR financial data available";

        return `**${c.name}** (${c.ticker || "Private"}, ${c.category}, ${c.headquartersCountry})
- Type: ${c.companyType}
- Lines of Business: ${c.linesOfBusiness.join(", ")}
- Description: ${c.description || "N/A"}
- Latest Financials (${latestYear || "N/A"}): ${metricStr}`;
      })
      .join("\n\n");

    const sharedLobStr =
      sharedLines.length > 0 ? sharedLines.join(", ") : "None";

    const promptTemplate = `You are an insurance industry analyst. Please provide a competitive intelligence analysis comparing the following ${parsedCarriers.length} insurance carriers:

${carrierSummaries}

**Shared Lines of Business**: ${sharedLobStr}

Please analyze:
1. **Competitive Positioning** — How do these carriers compare in terms of market position, financial strength, and strategic focus?
2. **Financial Performance** — Compare their underwriting profitability (combined ratios), premium growth, and capital strength.
3. **Strategic Differences** — What are the key differentiators between these carriers? Where do they overlap and where do they diverge?
4. **Market Outlook** — Based on their positioning, which carrier appears better positioned for the current market environment?
5. **Key Risks** — What are the primary risks for each carrier?

Provide your analysis in a clear, structured format with specific data points where available.`;

    return NextResponse.json({
      carriers: parsedCarriers,
      financialComparison: {
        combinedRatioTrend,
        nwpTrend,
        latestMetrics,
        metricDefinitions: metricNames,
        latestYear,
      },
      lobOverlap,
      commentarySummary,
      promptTemplate,
    });
  } catch (error) {
    console.error("Error building comparison:", error);
    return NextResponse.json(
      { error: "Failed to build comparison" },
      { status: 500 }
    );
  }
}
