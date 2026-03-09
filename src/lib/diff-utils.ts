// ─── Text Diff Utilities ────────────────────────────────────────────────────
// Wraps the `diff` library to produce structured diff output for the UI.

import { diffSentences, diffWords, type Change } from "diff";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DiffSegment {
  value: string;
  type: "added" | "removed" | "unchanged";
}

export interface DiffStats {
  addedWords: number;
  removedWords: number;
  unchangedWords: number;
  changePercent: number;
}

// ─── Diff Computation ───────────────────────────────────────────────────────

export function computeSectionDiff(
  oldText: string,
  newText: string,
  mode: "words" | "sentences" = "sentences"
): DiffSegment[] {
  const changes: Change[] =
    mode === "sentences"
      ? diffSentences(oldText, newText)
      : diffWords(oldText, newText);

  return changes.map((change) => ({
    value: change.value,
    type: change.added ? "added" : change.removed ? "removed" : "unchanged",
  }));
}

export function computeDiffStats(segments: DiffSegment[]): DiffStats {
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  for (const seg of segments) {
    const words = seg.value.split(/\s+/).filter(Boolean).length;
    if (seg.type === "added") added += words;
    else if (seg.type === "removed") removed += words;
    else unchanged += words;
  }

  const total = added + removed + unchanged;
  return {
    addedWords: added,
    removedWords: removed,
    unchangedWords: unchanged,
    changePercent: total > 0 ? Number((((added + removed) / total) * 100).toFixed(1)) : 0,
  };
}
