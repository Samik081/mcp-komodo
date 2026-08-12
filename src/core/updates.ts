/**
 * Post-submission polling for /execute operations.
 *
 * The Komodo /execute HTTP response returns the Update record at
 * SUBMISSION time (status "Queued"/"InProgress", success not yet
 * meaningful). resolveUpdate polls GetUpdate until the update reaches
 * its terminal "Complete" status so tools can report the real outcome.
 */

import { z } from "zod";
import type { Update } from "../types/komodo.js";
import type { KomodoClient } from "./client.js";
import { sanitizeMessage } from "./errors.js";
import { logger } from "./logger.js";

// Kept below the MCP SDK's 60s default client request timeout so a timed-out
// wait still returns the graceful "still running" message instead of tripping
// a transport timeout. The loop never starts a cycle it cannot finish and
// races each read against the remaining budget, so resolveUpdate never
// returns later than the deadline plus scheduling jitter.
const DEFAULT_TIMEOUT_SECONDS = 45;
const DEFAULT_POLL_INTERVAL_MS = 2_000;

/** Sentinel that wins the race when a poll outlives the remaining budget. */
const TIMED_OUT = Symbol("timed-out");

export interface WaitArgs {
  wait?: boolean;
  wait_timeout_seconds?: number;
}

/** Shared `wait` / `wait_timeout_seconds` input schema for /execute tools. */
export const waitInputSchema = {
  wait: z
    .boolean()
    .optional()
    .describe(
      "Wait for the operation to finish and report the real outcome (default: true). Set false for fire-and-forget",
    ),
  wait_timeout_seconds: z
    .number()
    .min(1)
    .max(300)
    .optional()
    .describe("Max seconds to wait for completion, 1-300 (default: 45)"),
};

export async function resolveUpdate(
  client: KomodoClient,
  update: Update,
  args: WaitArgs,
  pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS,
): Promise<Update> {
  const wait = args.wait ?? true;
  const updateId = update._id?.$oid;
  if (!wait || !updateId || update.status === "Complete") {
    return update;
  }
  const timeoutSeconds = args.wait_timeout_seconds ?? DEFAULT_TIMEOUT_SECONDS;
  const deadline = Date.now() + timeoutSeconds * 1000;
  let latest = update;
  // Only start a cycle when there is budget left for the sleep and a read.
  while (Date.now() + pollIntervalMs < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const budgetMs = deadline - Date.now();
    if (budgetMs <= 0) {
      break;
    }
    try {
      // Race the read against the remaining budget: a read that hangs until
      // the client's own request timeout must not push us past the deadline.
      const read = client.read("GetUpdate", { id: updateId });
      const winner = await Promise.race([
        read,
        new Promise<typeof TIMED_OUT>((resolve) =>
          setTimeout(() => resolve(TIMED_OUT), budgetMs),
        ),
      ]);
      if (winner === TIMED_OUT) {
        // The read is abandoned, not awaited — swallow any later rejection.
        read.catch(() => {});
        break;
      }
      latest = winner as Update;
    } catch (error) {
      // A failed poll says nothing about the operation itself, which was
      // already submitted successfully. Keep polling until the deadline and
      // fall back to the latest known state rather than reporting a failure.
      logger.debug(
        sanitizeMessage(
          `GetUpdate poll failed for update ${updateId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
      continue;
    }
    if (latest.status === "Complete") {
      return latest;
    }
  }
  return latest;
}
