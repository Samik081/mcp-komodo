/**
 * Log search result handling shared by the container, deployment, and
 * stack log tools.
 *
 * Komodo runs log searches as `docker logs ... 2>&1 | grep ...`, so the
 * result carries grep's exit status: zero matches comes back as
 * success=false with no output. A missing container looks identical,
 * because docker's error is folded into the pipe and filtered out by
 * grep. To tell the two apart, an empty failed search is followed by one
 * non-search probe (tail=1) against the same target.
 *
 * The Search*Log ops also take no tail/limit and return every matching
 * line in the log, so matches are capped client-side to the last `tail`.
 */

import type { Log, SearchCombinator } from "../types/komodo.js";
import { formatLog } from "./formatters.js";

export async function formatLogSearch(
  search: Log,
  terms: string[],
  combinator: SearchCombinator,
  tail: number,
  probe: () => Promise<Log>,
): Promise<string> {
  if (search.success && search.stdout.trim()) {
    return formatMatches(search, tail);
  }
  if (search.success || search.stdout.trim() || search.stderr.trim()) {
    return formatLog(search);
  }
  const probeLog = await probe();
  if (!probeLog.success) {
    return formatLog(probeLog);
  }
  const quoted = terms.map((t) => `"${t}"`).join(", ");
  return `[OK] ${search.stage}\nNo lines matched: ${quoted} (${combinator})`;
}

function formatMatches(search: Log, tail: number): string {
  const lines = search.stdout.replace(/\n+$/, "").split("\n");
  if (lines.length <= tail) return formatLog(search);
  return (
    `[OK] ${search.stage}\n` +
    `Showing last ${tail} of ${lines.length} matching lines ` +
    "(raise tail or narrow search_terms to see more)\n" +
    lines.slice(-tail).join("\n")
  );
}
