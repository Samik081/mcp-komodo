/**
 * Server domain tools: list, get, stats, info+processes, Docker prune, Docker delete.
 *
 * Registers 6 MCP tools for Komodo Server resources.
 * A Server is a remote machine managed by Komodo's Periphery agent.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { createClient } from "../core/client.js";
import type { AppConfig } from "../core/config.js";
import { handleKomodoError } from "../core/errors.js";
import {
  formatServerList,
  formatServerDetail,
  formatSystemStats,
  formatSystemInfo,
  formatProcessList,
  formatUpdateCreated,
} from "../core/formatters.js";
import { registerTool } from "../core/tools.js";

type KomodoClient = ReturnType<typeof createClient>;

export function registerServerTools(server: McpServer, client: KomodoClient, config: AppConfig): void {
  // -------------------------------------------------------------------------
  // komodo_list_servers
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_list_servers",
    description:
      "List all Komodo Servers. A Server is a remote machine managed " +
      "by Komodo's Periphery agent. Returns name, status, and region " +
      "for each server.",
    accessTier: "read-only",
    category: "servers",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      tag: z.string().optional().describe("Filter by tag name"),
    },
    handler: async (args) => {
      const tag = args.tag as string | undefined;
      try {
        const servers = await client.read("ListServers", {
          query: tag ? { tags: [tag] } : undefined,
        });
        return {
          content: [{ type: "text" as const, text: formatServerList(servers) }],
        };
      } catch (error) {
        return handleKomodoError("listing servers", error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_get_server
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_get_server",
    description:
      "Get detailed information about a specific Komodo Server by name " +
      "or ID. A Server is a remote machine managed by Komodo's Periphery " +
      "agent. Returns configuration, status, region, and current action state.",
    accessTier: "read-only",
    category: "servers",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      server: z.string().describe("Server name or ID"),
    },
    handler: async (args) => {
      const serverParam = args.server as string;
      try {
        const [serverData, actionState] = await Promise.all([
          client.read("GetServer", { server: serverParam }),
          client.read("GetServerActionState", { server: serverParam }),
        ]);
        return {
          content: [
            {
              type: "text" as const,
              text: formatServerDetail(serverData, actionState),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(
          `getting server '${serverParam}'`,
          error,
        );
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_get_server_stats
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_get_server_stats",
    description:
      "Get current resource usage statistics for a Komodo Server. " +
      "A Server is a remote machine managed by Komodo's Periphery agent. " +
      "Returns CPU percentage, memory usage, disk usage, and system " +
      "load averages.",
    accessTier: "read-only",
    category: "servers",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      server: z.string().describe("Server name or ID"),
    },
    handler: async (args) => {
      const serverParam = args.server as string;
      try {
        const stats = await client.read("GetSystemStats", {
          server: serverParam,
        });
        return {
          content: [
            { type: "text" as const, text: formatSystemStats(stats) },
          ],
        };
      } catch (error) {
        return handleKomodoError(
          `getting stats for server '${serverParam}'`,
          error,
        );
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_get_server_info
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_get_server_info",
    description:
      "Get system information and running processes for a Komodo Server. " +
      "A Server is a remote machine managed by Komodo's Periphery agent. " +
      "Returns OS details, hardware info, and a list of active processes " +
      "sorted by resource usage.",
    accessTier: "read-only",
    category: "servers",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      server: z.string().describe("Server name or ID"),
    },
    handler: async (args) => {
      const serverParam = args.server as string;
      try {
        const [info, processes] = await Promise.all([
          client.read("GetSystemInformation", { server: serverParam }),
          client.read("ListSystemProcesses", { server: serverParam }),
        ]);
        const text = `${formatSystemInfo(info)}\n\n${formatProcessList(processes)}`;
        return {
          content: [{ type: "text" as const, text }],
        };
      } catch (error) {
        return handleKomodoError(
          `getting info for server '${serverParam}'`,
          error,
        );
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_prune_docker
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_prune_docker",
    description:
      "\u26a0\ufe0f PRUNE unused Docker resources on a specific Komodo Server. " +
      "Removes stopped containers, dangling images, unused volumes, or " +
      "unused networks depending on the resource type chosen. This frees " +
      "disk space but deleted resources CANNOT BE RECOVERED. A Server is " +
      "a remote machine managed by Komodo's Periphery agent.",
    accessTier: "read-execute",
    category: "servers",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
    inputSchema: {
      server: z
        .string()
        .describe("Server name or ID to prune resources on"),
      resource_type: z
        .enum([
          "containers",
          "images",
          "volumes",
          "networks",
          "buildx",
          "system",
        ])
        .describe(
          "Type of Docker resources to prune: 'containers' (stopped), " +
            "'images' (dangling/untagged), 'volumes' (not attached), " +
            "'networks' (unused), 'buildx' (build cache), " +
            "'system' (all of the above)",
        ),
    },
    handler: async (args) => {
      const serverParam = args.server as string;
      const resource_type = args.resource_type as "containers" | "images" | "volumes" | "networks" | "buildx" | "system";
      try {
        const operationMap = {
          containers: "PruneContainers",
          images: "PruneImages",
          volumes: "PruneVolumes",
          networks: "PruneNetworks",
          buildx: "PruneBuildx",
          system: "PruneSystem",
        } as const;
        const update = await client.execute(
          operationMap[resource_type],
          { server: serverParam },
        );
        return {
          content: [
            {
              type: "text" as const,
              text: formatUpdateCreated(
                update,
                `Pruning ${resource_type} on server '${serverParam}'`,
              ),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(
          `pruning ${resource_type} on server '${serverParam}'`,
          error,
        );
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_delete_docker_resource
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_delete_docker_resource",
    description:
      "\u26a0\ufe0f DELETE a specific Docker resource (image, volume, or network) " +
      "on a Komodo Server. Unlike prune which removes all unused resources, " +
      "this targets a single named resource. The deleted resource CANNOT " +
      "BE RECOVERED. A Server is a remote machine managed by Komodo's " +
      "Periphery agent.",
    accessTier: "read-execute",
    category: "servers",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
    inputSchema: {
      server: z.string().describe("Server name or ID"),
      resource_type: z
        .enum(["image", "volume", "network"])
        .describe("Type of Docker resource to delete"),
      name: z
        .string()
        .describe(
          "Name or ID of the Docker resource to delete (e.g., image " +
            "tag, volume name, network name)",
        ),
    },
    handler: async (args) => {
      const serverParam = args.server as string;
      const resource_type = args.resource_type as "image" | "volume" | "network";
      const name = args.name as string;
      try {
        const operationMap = {
          image: "DeleteImage",
          volume: "DeleteVolume",
          network: "DeleteNetwork",
        } as const;
        const update = await client.execute(
          operationMap[resource_type],
          { server: serverParam, name },
        );
        return {
          content: [
            {
              type: "text" as const,
              text: formatUpdateCreated(
                update,
                `Deleting ${resource_type} '${name}' on server '${serverParam}'`,
              ),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(
          `deleting ${resource_type} '${name}' on server '${serverParam}'`,
          error,
        );
      }
    },
  });
}
