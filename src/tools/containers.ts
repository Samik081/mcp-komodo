/**
 * Container domain tools: log retrieval and search.
 *
 * Registers 1 MCP tool for Docker container logs on Komodo Servers.
 * CRITICAL: Container logs require BOTH server AND container name parameters,
 * unlike deployment/stack logs which only need the resource name.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Types } from "komodo_client";
import type { createClient } from "../core/client.js";
import type { AppConfig } from "../core/config.js";
import { handleKomodoError } from "../core/errors.js";
import { formatLog } from "../core/formatters.js";
import { registerTool } from "../core/tools.js";

type KomodoClient = ReturnType<typeof createClient>;

export function registerContainerTools(server: McpServer, client: KomodoClient, config: AppConfig): void {
  // -------------------------------------------------------------------------
  // komodo_get_container_log
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_get_container_log",
    description:
      "Get logs from a Docker container running on a Komodo Server. " +
      "Requires both the server name and the container name. " +
      "Optionally search for specific terms in the log output.",
    accessTier: "read-only",
    category: "containers",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      server: z
        .string()
        .describe("Server name or ID where the container is running"),
      container: z.string().describe("Docker container name"),
      tail: z
        .number()
        .min(1)
        .max(5000)
        .optional()
        .describe(
          "Number of log lines to return (default: 50, max: 5000)",
        ),
      search_terms: z
        .array(z.string())
        .optional()
        .describe("Search for lines matching these terms"),
      search_combinator: z
        .enum(["And", "Or"])
        .optional()
        .describe("How to combine search terms (default: 'Or')"),
    },
    handler: async (args) => {
      const serverParam = args.server as string;
      const container = args.container as string;
      const tail = args.tail as number | undefined;
      const search_terms = args.search_terms as string[] | undefined;
      const search_combinator = args.search_combinator as string | undefined;
      try {
        let log;
        if (search_terms && search_terms.length > 0) {
          log = await client.read("SearchContainerLog", {
            server: serverParam,
            container,
            terms: search_terms,
            combinator: (search_combinator as Types.SearchCombinator) || Types.SearchCombinator.Or,
          });
        } else {
          log = await client.read("GetContainerLog", {
            server: serverParam,
            container,
            tail: tail ?? 50,
          });
        }
        return {
          content: [{ type: "text" as const, text: formatLog(log) }],
        };
      } catch (error) {
        return handleKomodoError(
          `getting container log for '${container}' on server '${serverParam}'`,
          error,
        );
      }
    },
  });
}
