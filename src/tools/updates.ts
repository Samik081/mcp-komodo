/**
 * Update domain tools: list updates, get update detail.
 *
 * Registers 2 MCP tools for Komodo Update (operation history) resources.
 * An Update records the result of any execute operation (deploy, start,
 * stop, build, etc.), including full command logs with stdout/stderr.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { createClient } from "../core/client.js";
import type { AppConfig } from "../core/config.js";
import { handleKomodoError } from "../core/errors.js";
import {
  formatUpdateList,
  formatUpdateDetail,
} from "../core/formatters.js";
import { registerTool } from "../core/tools.js";

type KomodoClient = ReturnType<typeof createClient>;

export function registerUpdateTools(server: McpServer, client: KomodoClient, config: AppConfig): void {
  // -------------------------------------------------------------------------
  // komodo_list_updates
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_list_updates",
    description:
      "List Komodo operation history (updates). Every execute operation " +
      "(deploy, start, stop, build, pull, etc.) creates an Update record. " +
      "Filter by resource type, resource name/ID, operation, or success " +
      "status. Returns operation, target, status, and timestamp for each " +
      "update. Use komodo_get_update with an update ID to see full logs.",
    accessTier: "read-only",
    category: "updates",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      target_type: z
        .enum([
          "Server", "Stack", "Deployment", "Build", "Repo",
          "Procedure", "Action", "Builder", "Alerter", "ResourceSync",
          "ServerTemplate",
        ])
        .optional()
        .describe("Filter by resource type (e.g. 'Stack', 'Deployment')"),
      target_id: z
        .string()
        .optional()
        .describe("Filter by resource name or ID"),
      operation: z
        .string()
        .optional()
        .describe(
          "Filter by operation name (e.g. 'DeployStack', 'Deploy', " +
          "'RunBuild', 'StartStack', 'PullStack')",
        ),
      success: z
        .boolean()
        .optional()
        .describe("Filter by success status (true = succeeded, false = failed)"),
      page: z
        .number()
        .min(0)
        .optional()
        .describe(
          "Page number for pagination (0 = most recent). Use the " +
          "next_page value from a previous response to get more results.",
        ),
    },
    handler: async (args) => {
      const target_type = args.target_type as string | undefined;
      const target_id = args.target_id as string | undefined;
      const operation = args.operation as string | undefined;
      const success = args.success as boolean | undefined;
      const page = args.page as number | undefined;
      try {
        const query: Record<string, unknown> = {};
        if (target_type) query["target.type"] = target_type;
        if (target_id) query["target.id"] = target_id;
        if (operation) query["operation"] = operation;
        if (success !== undefined) query["success"] = success;

        const response = await client.read("ListUpdates", {
          query: Object.keys(query).length > 0 ? query : undefined,
          page: page ?? 0,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: formatUpdateList(response.updates, response.next_page),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError("listing updates", error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_get_update
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_get_update",
    description:
      "Get detailed information about a specific Komodo Update (operation " +
      "record) by ID. Returns the full operation details including status, " +
      "success/failure, operator, timestamps, and complete execution logs " +
      "with stdout/stderr for each stage. Use this to check deploy results, " +
      "diagnose failures, or monitor in-progress operations.",
    accessTier: "read-only",
    category: "updates",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      id: z.string().describe("Update ID (returned by execute operations or komodo_list_updates)"),
    },
    handler: async (args) => {
      const id = args.id as string;
      try {
        const update = await client.read("GetUpdate", { id });
        return {
          content: [
            {
              type: "text" as const,
              text: formatUpdateDetail(update),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(`getting update '${id}'`, error);
      }
    },
  });
}
