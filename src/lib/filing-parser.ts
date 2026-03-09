// ─── Filing Section Parser ──────────────────────────────────────────────────
// Fetches 10-K HTML from SEC EDGAR, strips to plain text, and extracts
// standard sections (Item 1A, Item 7, etc.) using regex-based parsing.

import * as cheerio from "cheerio";
import { edgarFetch } from "@/lib/edgar";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ParsedSection {
  sectionKey: string;
  sectionTitle: string;
  content: string;
}

// ─── 10-K Section Definitions ───────────────────────────────────────────────

export const TEN_K_SECTIONS: Record<string, string> = {
  item_1: "Item 1: Business",
  item_1a: "Item 1A: Risk Factors",
  item_1b: "Item 1B: Unresolved Staff Comments",
  item_1c: "Item 1C: Cybersecurity",
  item_2: "Item 2: Properties",
  item_3: "Item 3: Legal Proceedings",
  item_4: "Item 4: Mine Safety Disclosures",
  item_5: "Item 5: Market for Registrant's Common Equity",
  item_6: "Item 6: [Reserved]",
  item_7: "Item 7: Management's Discussion and Analysis",
  item_7a: "Item 7A: Quantitative and Qualitative Disclosures About Market Risk",
  item_8: "Item 8: Financial Statements and Supplementary Data",
  item_9: "Item 9: Changes in and Disagreements With Accountants",
  item_9a: "Item 9A: Controls and Procedures",
  item_9b: "Item 9B: Other Information",
};

// Section header patterns — order matters (1a before 1, 7a before 7, 9b before 9a before 9)
const SECTION_PATTERNS: Array<{ key: string; regex: RegExp }> = [
  { key: "item_1c", regex: /\bitem\s+1c\b[\s.:—\-]/i },
  { key: "item_1b", regex: /\bitem\s+1b\b[\s.:—\-]/i },
  { key: "item_1a", regex: /\bitem\s+1a\b[\s.:—\-]/i },
  { key: "item_1", regex: /\bitem\s+1\b[\s.:—\-]/i },
  { key: "item_2", regex: /\bitem\s+2\b[\s.:—\-]/i },
  { key: "item_3", regex: /\bitem\s+3\b[\s.:—\-]/i },
  { key: "item_4", regex: /\bitem\s+4\b[\s.:—\-]/i },
  { key: "item_5", regex: /\bitem\s+5\b[\s.:—\-]/i },
  { key: "item_6", regex: /\bitem\s+6\b[\s.:—\-]/i },
  { key: "item_7a", regex: /\bitem\s+7a\b[\s.:—\-]/i },
  { key: "item_7", regex: /\bitem\s+7\b[\s.:—\-]/i },
  { key: "item_8", regex: /\bitem\s+8\b[\s.:—\-]/i },
  { key: "item_9b", regex: /\bitem\s+9b\b[\s.:—\-]/i },
  { key: "item_9a", regex: /\bitem\s+9a\b[\s.:—\-]/i },
  { key: "item_9", regex: /\bitem\s+9\b[\s.:—\-]/i },
];

// ─── HTML to Plain Text ─────────────────────────────────────────────────────

function htmlToPlainText(html: string): string {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $("script, style, header, footer, nav, link, meta").remove();
  // Remove hidden elements
  $('[style*="display:none"], [style*="display: none"]').remove();
  // Remove table-of-contents links (common in SEC filings)
  $('a[href^="#"]').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    // Keep the text if it's substantial, remove if it's just a TOC link
    if (text.length < 5) {
      $el.remove();
    } else {
      $el.replaceWith(text);
    }
  });

  // Extract text with paragraph awareness
  // Replace block elements with newlines before extracting text
  $("br").replaceWith("\n");
  $("p, div, tr, li, h1, h2, h3, h4, h5, h6").each((_, el) => {
    $(el).prepend("\n").append("\n");
  });

  let text = $("body").text() || $.text();

  // Clean up whitespace
  text = text
    .replace(/\t/g, " ") // tabs to spaces
    .replace(/[^\S\n]+/g, " ") // collapse horizontal whitespace
    .replace(/\n\s*\n/g, "\n\n") // collapse multiple blank lines
    .replace(/\n{3,}/g, "\n\n") // max two newlines
    .trim();

  return text;
}

// ─── Section Splitter ───────────────────────────────────────────────────────

interface SectionBoundary {
  key: string;
  startIndex: number;
  headerEndIndex: number;
}

function findSectionBoundaries(text: string): SectionBoundary[] {
  const boundaries: SectionBoundary[] = [];

  // Find ALL matches for all section patterns
  for (const { key, regex } of SECTION_PATTERNS) {
    // Use a global regex to find all matches
    const globalRegex = new RegExp(regex.source, "gi");
    let match;
    while ((match = globalRegex.exec(text)) !== null) {
      // Check if this is likely a real section header vs a reference in body text.
      // Real headers tend to be near the start of a line (after newlines).
      const preceding50 = text.substring(Math.max(0, match.index - 50), match.index);
      const hasNewlineBefore = /\n\s*$/.test(preceding50) || match.index < 50;

      if (hasNewlineBefore) {
        boundaries.push({
          key,
          startIndex: match.index,
          headerEndIndex: match.index + match[0].length,
        });
      }
    }
  }

  // Sort by position in document
  boundaries.sort((a, b) => a.startIndex - b.startIndex);

  // Deduplicate: if the same key appears multiple times, keep only the LAST
  // occurrence (the real section, not the table of contents reference)
  const seen = new Map<string, number>();
  for (let i = 0; i < boundaries.length; i++) {
    seen.set(boundaries[i].key, i);
  }
  const deduped = boundaries.filter((_, i) => {
    const b = boundaries[i];
    return seen.get(b.key) === i;
  });

  return deduped;
}

function extractSections(text: string): ParsedSection[] {
  const boundaries = findSectionBoundaries(text);
  const sections: ParsedSection[] = [];

  for (let i = 0; i < boundaries.length; i++) {
    const current = boundaries[i];
    const next = boundaries[i + 1];

    const contentStart = current.headerEndIndex;
    const contentEnd = next ? next.startIndex : text.length;
    const content = text.substring(contentStart, contentEnd).trim();

    // Skip sections with very little content (likely just a header)
    if (content.length < 100) continue;

    sections.push({
      sectionKey: current.key,
      sectionTitle: TEN_K_SECTIONS[current.key] || current.key,
      content,
    });
  }

  return sections;
}

// ─── Main Parser ────────────────────────────────────────────────────────────

export async function parseFilingSections(
  edgarUrl: string
): Promise<ParsedSection[]> {
  const response = await edgarFetch(edgarUrl, { accept: "text/html" });
  const html = await response.text();

  const plainText = htmlToPlainText(html);

  if (plainText.length < 500) {
    return [];
  }

  return extractSections(plainText);
}
