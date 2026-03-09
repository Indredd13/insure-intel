// ─── Filing Sections Persistence ────────────────────────────────────────────
// Upserts parsed filing sections into Prisma and updates extraction timestamps.

import { prisma } from "@/lib/prisma";
import type { ParsedSection } from "@/lib/filing-parser";

export async function persistFilingSections(
  filingId: string,
  sections: ParsedSection[]
): Promise<number> {
  let count = 0;

  for (const section of sections) {
    try {
      await prisma.filingSection.upsert({
        where: {
          filingId_sectionKey: {
            filingId,
            sectionKey: section.sectionKey,
          },
        },
        create: {
          filingId,
          sectionKey: section.sectionKey,
          sectionTitle: section.sectionTitle,
          content: section.content,
          wordCount: section.content.split(/\s+/).filter(Boolean).length,
        },
        update: {
          sectionTitle: section.sectionTitle,
          content: section.content,
          wordCount: section.content.split(/\s+/).filter(Boolean).length,
          extractedAt: new Date(),
        },
      });
      count++;
    } catch (err) {
      console.error(
        `Failed to upsert section ${section.sectionKey} for filing ${filingId}:`,
        err
      );
    }
  }

  // Update extraction timestamp on the filing
  await prisma.filing.update({
    where: { id: filingId },
    data: { sectionsExtractedAt: new Date() },
  });

  return count;
}
