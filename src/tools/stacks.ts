/**
 * Stack domain tools: list, get, services, summary, log, inspect, deploy,
 * pull, lifecycle, destroy.
 *
 * Registers 10 MCP tools for Komodo Stack resources.
 * A Stack is a multi-container deployment defined by a Docker Compose file,
 * deployed to a specific server.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Types } from "komodo_client";
import type { createClient } from "../core/client.js";
import type { AppConfig } from "../core/config.js";
import { handleKomodoError } from "../core/errors.js";
import {
  formatStackList,
  formatStackDetail,
  formatStackServiceList,
  formatStacksSummary,
  formatLog,
  formatUpdateCreated,
} from "../core/formatters.js";
import { registerTool } from "../core/tools.js";

type KomodoClient = ReturnType<typeof createClient>;

export function registerStackTools(server: McpServer, client: KomodoClient, config: AppConfig): void {
  // -------------------------------------------------------------------------
  // komodo_list_stacks
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_list_stacks",
    description:
      "List all Komodo Stacks. A Stack is a multi-container deployment " +
      "defined by a Docker Compose file, deployed to a specific server. " +
      "Returns name, state, server, and service count for each stack.",
    accessTier: "read-only",
    category: "stacks",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      tag: z.string().optional().describe("Filter stacks by tag name"),
    },
    handler: async (args) => {
      const tag = args.tag as string | undefined;
      try {
        const stacks = await client.read("ListStacks", {
          query: tag ? { tags: [tag] } : undefined,
        });
        return {
          content: [{ type: "text" as const, text: formatStackList(stacks) }],
        };
      } catch (error) {
        return handleKomodoError("listing stacks", error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_get_stack
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_get_stack",
    description:
      "Get detailed information about a specific Komodo Stack by name " +
      "or ID. A Stack is a multi-container deployment defined by a Docker " +
      "Compose file. Returns configuration, state, services, git repo " +
      "info, and current action state.",
    accessTier: "read-only",
    category: "stacks",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      stack: z.string().describe("Stack name or ID"),
    },
    handler: async (args) => {
      const stack = args.stack as string;
      try {
        const [stackData, actionState] = await Promise.all([
          client.read("GetStack", { stack }),
          client.read("GetStackActionState", { stack }),
        ]);
        return {
          content: [
            {
              type: "text" as const,
              text: formatStackDetail(stackData, actionState),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(`getting stack '${stack}'`, error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_get_stack_log
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_get_stack_log",
    description:
      "Get logs from a Komodo Stack's Docker Compose services. Optionally " +
      "search for specific terms in the log output. A Stack is a " +
      "multi-container deployment defined by a Docker Compose file. " +
      "Returns the most recent log lines from all or specified services.",
    accessTier: "read-only",
    category: "stacks",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      stack: z.string().describe("Stack name or ID"),
      services: z
        .array(z.string())
        .optional()
        .describe(
          "Filter to specific service names (default: all services)",
        ),
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
        .describe(
          "How to combine search terms: 'And' = all terms must match, " +
          "'Or' = any term matches (default: 'Or')",
        ),
    },
    handler: async (args) => {
      const stack = args.stack as string;
      const services = args.services as string[] | undefined;
      const tail = args.tail as number | undefined;
      const search_terms = args.search_terms as string[] | undefined;
      const search_combinator = args.search_combinator as string | undefined;
      try {
        let log;
        if (search_terms && search_terms.length > 0) {
          log = await client.read("SearchStackLog", {
            stack,
            services: services || [],
            terms: search_terms,
            combinator: (search_combinator as Types.SearchCombinator) || Types.SearchCombinator.Or,
          });
        } else {
          log = await client.read("GetStackLog", {
            stack,
            services: services || [],
            tail: tail || 50,
          });
        }
        return {
          content: [{ type: "text" as const, text: formatLog(log) }],
        };
      } catch (error) {
        return handleKomodoError(
          `getting logs for stack '${stack}'`,
          error,
        );
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_inspect_stack_container
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_inspect_stack_container",
    description:
      "Inspect a Docker container for a specific service within a Stack. " +
      "Returns the full container state including configuration, mounts, " +
      "network settings, and runtime status (equivalent to docker inspect).",
    accessTier: "read-only",
    category: "stacks",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      stack: z.string().describe("Stack name or ID"),
      service: z.string().describe("Service name within the stack to inspect"),
    },
    handler: async (args) => {
      const stack = args.stack as string;
      const service = args.service as string;
      try {
        const container = await client.read("InspectStackContainer", { stack, service });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(container, null, 2) }],
        };
      } catch (error) {
        return handleKomodoError(`inspecting container for service '${service}' in stack '${stack}'`, error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_list_stack_services
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_list_stack_services",
    description:
      "List all services in a Komodo Stack. Returns the service name, " +
      "Docker image, container state, and whether an image update is " +
      "available for each service in the Compose file.",
    accessTier: "read-only",
    category: "stacks",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      stack: z.string().describe("Stack name or ID"),
    },
    handler: async (args) => {
      const stack = args.stack as string;
      try {
        const services = await client.read("ListStackServices", { stack });
        return {
          content: [
            {
              type: "text" as const,
              text: formatStackServiceList(services),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(
          `listing services for stack '${stack}'`,
          error,
        );
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_get_stacks_summary
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_get_stacks_summary",
    description:
      "Get a summary of all Komodo Stacks. Returns aggregate counts " +
      "by state: total, running, stopped, down, unhealthy, and unknown.",
    accessTier: "read-only",
    category: "stacks",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    handler: async () => {
      try {
        const summary = await client.read("GetStacksSummary", {});
        return {
          content: [
            {
              type: "text" as const,
              text: formatStacksSummary(summary),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError("getting stacks summary", error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_deploy_stack
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_deploy_stack",
    description:
      "\u26a0\ufe0f DEPLOY a Komodo Stack. This redeploys all services in the stack, " +
      "taking down containers and bringing them back up with the latest " +
      "configuration. Services will be briefly unavailable during " +
      "redeployment. A Stack is a multi-container deployment defined by " +
      "a Docker Compose file.",
    accessTier: "read-execute",
    category: "stacks",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
    inputSchema: {
      stack: z.string().describe("Stack name or ID"),
      only_if_changed: z
        .boolean()
        .optional()
        .describe(
          "Only deploy if the stack configuration has changed since last " +
            "deployment (Komodo's smart deploy feature). Default: false.",
        ),
      services: z
        .array(z.string())
        .optional()
        .describe(
          "Deploy only specific services by name. If omitted or empty, " +
            "all services are deployed.",
        ),
    },
    handler: async (args) => {
      const stack = args.stack as string;
      const only_if_changed = args.only_if_changed as boolean | undefined;
      const services = args.services as string[] | undefined;
      try {
        const operation = only_if_changed
          ? "DeployStackIfChanged"
          : "DeployStack";
        const update = await client.execute(operation, {
          stack,
          services: services || [],
        });
        return {
          content: [
            {
              type: "text" as const,
              text: formatUpdateCreated(update, `Deploying stack '${stack}'`),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(`deploying stack '${stack}'`, error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_pull_stack
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_pull_stack",
    description:
      "\u26a0\ufe0f PULL images for a Komodo Stack (docker compose pull). " +
      "Downloads the latest images without redeploying. Use this to " +
      "pre-pull images before a deploy, or to check for updates. " +
      "Optionally filter to specific services.",
    accessTier: "read-execute",
    category: "stacks",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      stack: z.string().describe("Stack name or ID"),
      services: z
        .array(z.string())
        .optional()
        .describe(
          "Pull only specific services by name. If omitted or empty, " +
            "all services are pulled.",
        ),
    },
    handler: async (args) => {
      const stack = args.stack as string;
      const services = args.services as string[] | undefined;
      try {
        const update = await client.execute("PullStack", {
          stack,
          services: services || [],
        });
        return {
          content: [
            {
              type: "text" as const,
              text: formatUpdateCreated(
                update,
                `Pulling images for stack '${stack}'`,
              ),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(
          `pulling images for stack '${stack}'`,
          error,
        );
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_stack_lifecycle
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_stack_lifecycle",
    description:
      "\u26a0\ufe0f LIFECYCLE: Control a Komodo Stack's container lifecycle. " +
      "Start brings up all containers, stop brings them down gracefully, " +
      "restart stops then starts, pause freezes without stopping, " +
      "unpause resumes. A Stack is a multi-container deployment defined " +
      "by a Docker Compose file.",
    accessTier: "read-execute",
    category: "stacks",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
    inputSchema: {
      stack: z.string().describe("Stack name or ID"),
      action: z
        .enum(["start", "stop", "restart", "pause", "unpause"])
        .describe("Lifecycle action to perform"),
    },
    handler: async (args) => {
      const stack = args.stack as string;
      const action = args.action as "start" | "stop" | "restart" | "pause" | "unpause";
      try {
        const operationMap = {
          start: "StartStack",
          stop: "StopStack",
          restart: "RestartStack",
          pause: "PauseStack",
          unpause: "UnpauseStack",
        } as const;
        const update = await client.execute(operationMap[action], { stack });
        return {
          content: [
            {
              type: "text" as const,
              text: formatUpdateCreated(
                update,
                `${action} stack '${stack}'`,
              ),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(`${action} stack '${stack}'`, error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_destroy_stack
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_destroy_stack",
    description:
      "\ud83d\udd34 DESTROY a Komodo Stack permanently. This stops all containers " +
      "and removes the stack configuration from Komodo. THIS CANNOT BE " +
      "UNDONE. Only use this when you're certain the stack should be " +
      "deleted. A Stack is a multi-container deployment defined by a " +
      "Docker Compose file.",
    accessTier: "read-execute",
    category: "stacks",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
    inputSchema: {
      stack: z.string().describe("Stack name or ID"),
    },
    handler: async (args) => {
      const stack = args.stack as string;
      try {
        const update = await client.execute("DestroyStack", { stack });
        return {
          content: [
            {
              type: "text" as const,
              text: formatUpdateCreated(
                update,
                `Destroying stack '${stack}' - this is permanent`,
              ),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(`destroying stack '${stack}'`, error);
      }
    },
  });
}
