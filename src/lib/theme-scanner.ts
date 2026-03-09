// ─── Theme Scanner ──────────────────────────────────────────────────────────
// Scans filing section text for insurance keyword occurrences.
// Uses simple indexOf matching — fast, no external dependencies.

import { THEME_DICTIONARY } from "@/lib/theme-dictionary";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ThemeScanResult {
  themeId: string;
  themeLabel: string;
  totalHits: number;
  keywordHits: Record<string, number>;
}

// ─── Scanner ────────────────────────────────────────────────────────────────

export function scanTextForThemes(text: string): ThemeScanResult[] {
  const lowerText = text.toLowerCase();
  const results: ThemeScanResult[] = [];

  for (const theme of THEME_DICTIONARY) {
    const keywordHits: Record<string, number> = {};
    let totalHits = 0;

    for (const keyword of theme.keywords) {
      let count = 0;
      let pos = 0;
      while ((pos = lowerText.indexOf(keyword, pos)) !== -1) {
        count++;
        pos += keyword.length;
      }
      if (count > 0) {
        keywordHits[keyword] = count;
        totalHits += count;
      }
    }

    if (totalHits > 0) {
      results.push({
        themeId: theme.id,
        themeLabel: theme.label,
        totalHits,
        keywordHits,
      });
    }
  }

  return results;
}

// Scan and aggregate across multiple texts
export function scanMultipleTexts(
  texts: Array<{ text: string; meta: { carrierId: string; year: number; sectionKey: string } }>
): {
  byTheme: Record<string, number>;
  byCarrier: Record<string, Record<string, number>>;
  byYear: Record<number, Record<string, number>>;
  keywordDetails: Array<{
    keyword: string;
    themeId: string;
    carrierId: string;
    year: number;
    sectionKey: string;
    count: number;
  }>;
} {
  const byTheme: Record<string, number> = {};
  const byCarrier: Record<string, Record<string, number>> = {};
  const byYear: Record<number, Record<string, number>> = {};
  const keywordDetails: Array<{
    keyword: string;
    themeId: string;
    carrierId: string;
    year: number;
    sectionKey: string;
    count: number;
  }> = [];

  for (const { text, meta } of texts) {
    const results = scanTextForThemes(text);

    for (const result of results) {
      // Aggregate by theme
      byTheme[result.themeId] = (byTheme[result.themeId] || 0) + result.totalHits;

      // Aggregate by carrier
      if (!byCarrier[meta.carrierId]) byCarrier[meta.carrierId] = {};
      byCarrier[meta.carrierId][result.themeId] =
        (byCarrier[meta.carrierId][result.themeId] || 0) + result.totalHits;

      // Aggregate by year
      if (!byYear[meta.year]) byYear[meta.year] = {};
      byYear[meta.year][result.themeId] =
        (byYear[meta.year][result.themeId] || 0) + result.totalHits;

      // Keyword-level detail
      for (const [keyword, count] of Object.entries(result.keywordHits)) {
        keywordDetails.push({
          keyword,
          themeId: result.themeId,
          carrierId: meta.carrierId,
          year: meta.year,
          sectionKey: meta.sectionKey,
          count,
        });
      }
    }
  }

  return { byTheme, byCarrier, byYear, keywordDetails };
}
