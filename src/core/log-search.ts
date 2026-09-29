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
 */

import type { Log, SearchCombinator } from "../types/komodo.js";
import { formatLog } from "./formatters.js";

export async function formatLogSearch(
  search: Log,
  terms: string[],
  combinator: SearchCombinator,
  probe: () => Promise<Log>,
): Promise<string> {
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
