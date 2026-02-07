/**
 * Builder domain tools: list, get.
 *
 * Registers 2 MCP tools for Komodo Builder resources.
 * A Builder is a build server (or AWS instance) used to compile
 * Docker images for Komodo Builds.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { createClient } from "../core/client.js";
import type { AppConfig } from "../core/config.js";
import { handleKomodoError } from "../core/errors.js";
import { formatBuilderList, formatBuilderDetail } from "../core/formatters.js";
import { registerTool } from "../core/tools.js";

type KomodoClient = ReturnType<typeof createClient>;

export function registerBuilderTools(server: McpServer, client: KomodoClient, config: AppConfig): void {
  // -------------------------------------------------------------------------
  // komodo_list_builders
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_list_builders",
    description:
      "List all Komodo Builders. A Builder is a build server (or AWS " +
      "instance) used to compile Docker images for Komodo Builds. " +
      "Returns name and type for each builder.",
    accessTier: "read-only",
    category: "builders",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      tag: z.string().optional().describe("Filter builders by tag name"),
    },
    handler: async (args) => {
      const tag = args.tag as string | undefined;
      try {
        const builders = await client.read("ListBuilders", {
          query: tag ? { tags: [tag] } : undefined,
        });
        return {
          content: [
            { type: "text" as const, text: formatBuilderList(builders) },
          ],
        };
      } catch (error) {
        return handleKomodoError("listing builders", error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_get_builder
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_get_builder",
    description:
      "Get detailed information about a specific Komodo Builder by name " +
      "or ID. A Builder is a build server used to compile Docker images. " +
      "Returns builder type, server configuration, and current state.",
    accessTier: "read-only",
    category: "builders",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      builder: z.string().describe("Builder name or ID"),
    },
    handler: async (args) => {
      const builder = args.builder as string;
      try {
        const builderData = await client.read("GetBuilder", { builder });
        return {
          content: [
            {
              type: "text" as const,
              text: formatBuilderDetail(builderData),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(`getting builder '${builder}'`, error);
      }
    },
  });
}
