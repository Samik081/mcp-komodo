/**
 * Action domain tools: list, get detail, run.
 *
 * Registers 3 MCP tools for Komodo Action resources.
 * An Action is a custom TypeScript/Deno script that runs on Komodo Core.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { createClient } from "../core/client.js";
import type { AppConfig } from "../core/config.js";
import { handleKomodoError } from "../core/errors.js";
import {
  formatActionList,
  formatActionDetail,
  formatUpdateCreated,
} from "../core/formatters.js";
import { registerTool } from "../core/tools.js";

type KomodoClient = ReturnType<typeof createClient>;

export function registerActionTools(server: McpServer, client: KomodoClient, config: AppConfig): void {
  // -------------------------------------------------------------------------
  // komodo_list_actions
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_list_actions",
    description:
      "List all Komodo Actions. An Action is a custom TypeScript/Deno " +
      "script that runs on the Komodo Core server. Returns name and " +
      "state for each action.",
    accessTier: "read-only",
    category: "actions",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      tag: z.string().optional().describe("Filter actions by tag name"),
    },
    handler: async (args) => {
      const tag = args.tag as string | undefined;
      try {
        const actions = await client.read("ListActions", {
          query: tag ? { tags: [tag] } : undefined,
        });
        return {
          content: [{ type: "text" as const, text: formatActionList(actions) }],
        };
      } catch (error) {
        return handleKomodoError("listing actions", error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_get_action
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_get_action",
    description:
      "Get detailed information about a specific Komodo Action by name " +
      "or ID. An Action is a custom TypeScript/Deno script that runs on " +
      "Komodo Core. Returns the action configuration and current " +
      "action state.",
    accessTier: "read-only",
    category: "actions",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      action: z.string().describe("Action name or ID"),
    },
    handler: async (args) => {
      const action = args.action as string;
      try {
        const [actionData, actionState] = await Promise.all([
          client.read("GetAction", { action }),
          client.read("GetActionActionState", { action }),
        ]);
        return {
          content: [
            {
              type: "text" as const,
              text: formatActionDetail(actionData, actionState),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(`getting action '${action}'`, error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_run_action
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_run_action",
    description:
      "\u26a0\ufe0f RUN a Komodo Action. This executes a custom TypeScript/Deno " +
      "script on the Komodo Core server. Actions can perform arbitrary " +
      "operations depending on their script content. An Action is a " +
      "custom TypeScript/Deno script that runs on Komodo Core.",
    accessTier: "read-execute",
    category: "actions",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
    inputSchema: {
      action: z.string().describe("Action name or ID"),
    },
    handler: async (args) => {
      const action = args.action as string;
      try {
        const update = await client.execute("RunAction", { action });
        return {
          content: [
            {
              type: "text" as const,
              text: formatUpdateCreated(
                update,
                `Running action '${action}'`,
              ),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(`running action '${action}'`, error);
      }
    },
  });
}
