/**
 * ResourceSync domain tools: list, get detail, trigger sync.
 *
 * Registers 3 MCP tools for Komodo ResourceSync resources.
 * A ResourceSync is a GitOps sync that manages Komodo resources from
 * TOML configuration files in a Git repository.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { createClient } from "../core/client.js";
import type { AppConfig } from "../core/config.js";
import { handleKomodoError } from "../core/errors.js";
import {
  formatResourceSyncList,
  formatResourceSyncDetail,
  formatUpdateCreated,
} from "../core/formatters.js";
import { registerTool } from "../core/tools.js";

type KomodoClient = ReturnType<typeof createClient>;

export function registerResourceSyncTools(server: McpServer, client: KomodoClient, config: AppConfig): void {
  // -------------------------------------------------------------------------
  // komodo_list_resource_syncs
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_list_resource_syncs",
    description:
      "List all Komodo Resource Syncs. A Resource Sync is a GitOps sync " +
      "that manages Komodo resources from TOML configuration files in a " +
      "Git repository. Returns name, state, and repo info for each sync.",
    accessTier: "read-only",
    category: "resource-syncs",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      tag: z
        .string()
        .optional()
        .describe("Filter resource syncs by tag name"),
    },
    handler: async (args) => {
      const tag = args.tag as string | undefined;
      try {
        const syncs = await client.read("ListResourceSyncs", {
          query: tag ? { tags: [tag] } : undefined,
        });
        return {
          content: [
            { type: "text" as const, text: formatResourceSyncList(syncs) },
          ],
        };
      } catch (error) {
        return handleKomodoError("listing resource syncs", error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_get_resource_sync
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_get_resource_sync",
    description:
      "Get detailed information about a specific Komodo Resource Sync " +
      "by name or ID. A Resource Sync manages Komodo resources from TOML " +
      "files in a Git repo. Returns git configuration, managed resources, " +
      "and current sync state.",
    accessTier: "read-only",
    category: "resource-syncs",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      resource_sync: z.string().describe("Resource Sync name or ID"),
    },
    handler: async (args) => {
      const resource_sync = args.resource_sync as string;
      try {
        const [syncData, actionState] = await Promise.all([
          client.read("GetResourceSync", { sync: resource_sync }),
          client.read("GetResourceSyncActionState", {
            sync: resource_sync,
          }),
        ]);
        return {
          content: [
            {
              type: "text" as const,
              text: formatResourceSyncDetail(syncData, actionState),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(
          `getting resource sync '${resource_sync}'`,
          error,
        );
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_trigger_sync
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_trigger_sync",
    description:
      "\u26a0\ufe0f TRIGGER a Komodo Resource Sync. This pulls the latest TOML " +
      "configuration from the Git repo and applies changes to managed " +
      "Komodo resources. May create, update, or delete resources based " +
      "on config changes. A Resource Sync is a GitOps sync that manages " +
      "Komodo resources from TOML files in a Git repository.",
    accessTier: "read-execute",
    category: "resource-syncs",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
    inputSchema: {
      resource_sync: z.string().describe("Resource Sync name or ID"),
    },
    handler: async (args) => {
      const resource_sync = args.resource_sync as string;
      try {
        const update = await client.execute("RunSync", {
          sync: resource_sync,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: formatUpdateCreated(
                update,
                `Triggering sync '${resource_sync}'`,
              ),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(
          `triggering sync '${resource_sync}'`,
          error,
        );
      }
    },
  });
}
