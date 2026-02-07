/**
 * Alerter domain tools: list, get.
 *
 * Registers 2 MCP tools for Komodo Alerter resources.
 * An Alerter is a notification endpoint (Slack, Discord, or custom webhook)
 * for Komodo alerts and status changes.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { createClient } from "../core/client.js";
import type { AppConfig } from "../core/config.js";
import { handleKomodoError } from "../core/errors.js";
import { formatAlerterList, formatAlerterDetail } from "../core/formatters.js";
import { registerTool } from "../core/tools.js";

type KomodoClient = ReturnType<typeof createClient>;

export function registerAlerterTools(server: McpServer, client: KomodoClient, config: AppConfig): void {
  // -------------------------------------------------------------------------
  // komodo_list_alerters
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_list_alerters",
    description:
      "List all Komodo Alerters. An Alerter is a notification endpoint " +
      "(Slack, Discord, or custom webhook) for Komodo alerts and status " +
      "changes. Returns name and type for each alerter.",
    accessTier: "read-only",
    category: "alerters",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      tag: z.string().optional().describe("Filter alerters by tag name"),
    },
    handler: async (args) => {
      const tag = args.tag as string | undefined;
      try {
        const alerters = await client.read("ListAlerters", {
          query: tag ? { tags: [tag] } : undefined,
        });
        return {
          content: [
            { type: "text" as const, text: formatAlerterList(alerters) },
          ],
        };
      } catch (error) {
        return handleKomodoError("listing alerters", error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_get_alerter
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_get_alerter",
    description:
      "Get detailed information about a specific Komodo Alerter by name " +
      "or ID. An Alerter is a notification endpoint for Komodo alerts. " +
      "Returns endpoint type, configuration, and enabled status.",
    accessTier: "read-only",
    category: "alerters",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      alerter: z.string().describe("Alerter name or ID"),
    },
    handler: async (args) => {
      const alerter = args.alerter as string;
      try {
        const alerterData = await client.read("GetAlerter", { alerter });
        return {
          content: [
            {
              type: "text" as const,
              text: formatAlerterDetail(alerterData),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(`getting alerter '${alerter}'`, error);
      }
    },
  });
}
