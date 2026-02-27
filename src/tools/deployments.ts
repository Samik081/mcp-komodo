/**
 * Deployment domain tools: list, get, summary, log, inspect, deploy, pull,
 * lifecycle, destroy.
 *
 * Registers 9 MCP tools for Komodo Deployment resources.
 * A Deployment is a single Docker container managed by Komodo,
 * deployed to a specific server.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Types } from "komodo_client";
import type { createClient } from "../core/client.js";
import type { AppConfig } from "../core/config.js";
import { handleKomodoError } from "../core/errors.js";
import {
  formatDeploymentList,
  formatDeploymentDetail,
  formatDeploymentsSummary,
  formatLog,
  formatUpdateCreated,
} from "../core/formatters.js";
import { registerTool } from "../core/tools.js";

type KomodoClient = ReturnType<typeof createClient>;

export function registerDeploymentTools(server: McpServer, client: KomodoClient, config: AppConfig): void {
  // -------------------------------------------------------------------------
  // komodo_list_deployments
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_list_deployments",
    description:
      "List all Komodo Deployments. A Deployment is a single Docker " +
      "container managed by Komodo, deployed to a specific server. " +
      "Returns name, state, image, and server for each deployment.",
    accessTier: "read-only",
    category: "deployments",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      tag: z.string().optional().describe("Filter deployments by tag name"),
    },
    handler: async (args) => {
      const tag = args.tag as string | undefined;
      try {
        const deployments = await client.read("ListDeployments", {
          query: tag ? { tags: [tag] } : undefined,
        });
        return {
          content: [
            { type: "text" as const, text: formatDeploymentList(deployments) },
          ],
        };
      } catch (error) {
        return handleKomodoError("listing deployments", error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_get_deployment
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_get_deployment",
    description:
      "Get detailed information about a specific Komodo Deployment by " +
      "name or ID. A Deployment is a single Docker container managed by " +
      "Komodo. Returns configuration, image, state, container status, " +
      "and current action state.",
    accessTier: "read-only",
    category: "deployments",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      deployment: z.string().describe("Deployment name or ID"),
    },
    handler: async (args) => {
      const deployment = args.deployment as string;
      try {
        const [deploymentData, actionState] = await Promise.all([
          client.read("GetDeployment", { deployment }),
          client.read("GetDeploymentActionState", { deployment }),
        ]);
        return {
          content: [
            {
              type: "text" as const,
              text: formatDeploymentDetail(deploymentData, actionState),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(
          `getting deployment '${deployment}'`,
          error,
        );
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_get_deployment_log
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_get_deployment_log",
    description:
      "Get logs from a Komodo Deployment's Docker container. Optionally " +
      "search for specific terms in the log output. A Deployment is a " +
      "single Docker container managed by Komodo. Returns the most " +
      "recent log lines from the container.",
    accessTier: "read-only",
    category: "deployments",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      deployment: z.string().describe("Deployment name or ID"),
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
      const deployment = args.deployment as string;
      const tail = args.tail as number | undefined;
      const search_terms = args.search_terms as string[] | undefined;
      const search_combinator = args.search_combinator as string | undefined;
      try {
        let log;
        if (search_terms && search_terms.length > 0) {
          log = await client.read("SearchDeploymentLog", {
            deployment,
            terms: search_terms,
            combinator: (search_combinator as Types.SearchCombinator) || Types.SearchCombinator.Or,
          });
        } else {
          log = await client.read("GetDeploymentLog", {
            deployment,
            tail: tail || 50,
          });
        }
        return {
          content: [{ type: "text" as const, text: formatLog(log) }],
        };
      } catch (error) {
        return handleKomodoError(
          `getting logs for deployment '${deployment}'`,
          error,
        );
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_inspect_deployment_container
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_inspect_deployment_container",
    description:
      "Inspect the Docker container associated with a Deployment. " +
      "Returns the full container state including configuration, mounts, " +
      "network settings, and runtime status (equivalent to docker inspect).",
    accessTier: "read-only",
    category: "deployments",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      deployment: z.string().describe("Deployment name or ID"),
    },
    handler: async (args) => {
      const deployment = args.deployment as string;
      try {
        const container = await client.read("InspectDeploymentContainer", { deployment });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(container, null, 2) }],
        };
      } catch (error) {
        return handleKomodoError(`inspecting container for deployment '${deployment}'`, error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_get_deployments_summary
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_get_deployments_summary",
    description:
      "Get a summary of all Komodo Deployments. Returns aggregate counts " +
      "by state: total, running, stopped, not deployed, unhealthy, " +
      "and unknown.",
    accessTier: "read-only",
    category: "deployments",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    handler: async () => {
      try {
        const summary = await client.read("GetDeploymentsSummary", {});
        return {
          content: [
            {
              type: "text" as const,
              text: formatDeploymentsSummary(summary),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError("getting deployments summary", error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_deploy_deployment
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_deploy_deployment",
    description:
      "\u26a0\ufe0f DEPLOY a Komodo Deployment. This stops the current container " +
      "and starts a new one with the latest image and configuration. The " +
      "service will be briefly unavailable during redeployment. A " +
      "Deployment is a single Docker container managed by Komodo.",
    accessTier: "read-execute",
    category: "deployments",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
    inputSchema: {
      deployment: z.string().describe("Deployment name or ID"),
    },
    handler: async (args) => {
      const deployment = args.deployment as string;
      try {
        const update = await client.execute("Deploy", { deployment });
        return {
          content: [
            {
              type: "text" as const,
              text: formatUpdateCreated(
                update,
                `Deploying deployment '${deployment}'`,
              ),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(
          `deploying deployment '${deployment}'`,
          error,
        );
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_pull_deployment
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_pull_deployment",
    description:
      "\u26a0\ufe0f PULL the image for a Komodo Deployment (docker pull). " +
      "Downloads the latest image without redeploying the container. " +
      "Use this to pre-pull an image before a deploy, or to check " +
      "for updates.",
    accessTier: "read-execute",
    category: "deployments",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      deployment: z.string().describe("Deployment name or ID"),
    },
    handler: async (args) => {
      const deployment = args.deployment as string;
      try {
        const update = await client.execute("PullDeployment", {
          deployment,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: formatUpdateCreated(
                update,
                `Pulling image for deployment '${deployment}'`,
              ),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(
          `pulling image for deployment '${deployment}'`,
          error,
        );
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_deployment_lifecycle
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_deployment_lifecycle",
    description:
      "\u26a0\ufe0f LIFECYCLE: Control a Komodo Deployment's container lifecycle. " +
      "A Deployment is a single Docker container managed by Komodo. " +
      "Actions: 'start' brings container up, 'stop' brings it down " +
      "gracefully, 'restart' stops then starts, 'pause' freezes without " +
      "stopping (uses Docker pause), 'unpause' resumes from pause. " +
      "Stop/restart cause downtime.",
    accessTier: "read-execute",
    category: "deployments",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
    inputSchema: {
      deployment: z.string().describe("Deployment name or ID"),
      action: z
        .enum(["start", "stop", "restart", "pause", "unpause"])
        .describe("Lifecycle action to perform"),
    },
    handler: async (args) => {
      const deployment = args.deployment as string;
      const action = args.action as "start" | "stop" | "restart" | "pause" | "unpause";
      try {
        const operationMap = {
          start: "StartDeployment",
          stop: "StopDeployment",
          restart: "RestartDeployment",
          pause: "PauseDeployment",
          unpause: "UnpauseDeployment",
        } as const;
        const update = await client.execute(operationMap[action], {
          deployment,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: formatUpdateCreated(
                update,
                `${action} deployment '${deployment}'`,
              ),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(
          `${action} deployment '${deployment}'`,
          error,
        );
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_destroy_deployment
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_destroy_deployment",
    description:
      "\ud83d\udd34 DESTROY a Komodo Deployment permanently. This stops the " +
      "container and removes the deployment configuration from Komodo. " +
      "THIS CANNOT BE UNDONE. The container and its data will be " +
      "deleted. Only use this when you're certain the deployment should " +
      "be permanently removed. A Deployment is a single Docker container " +
      "managed by Komodo.",
    accessTier: "read-execute",
    category: "deployments",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
    inputSchema: {
      deployment: z.string().describe("Deployment name or ID"),
    },
    handler: async (args) => {
      const deployment = args.deployment as string;
      try {
        const update = await client.execute("DestroyDeployment", {
          deployment,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: formatUpdateCreated(
                update,
                `Destroying deployment '${deployment}' - this is permanent`,
              ),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(
          `destroying deployment '${deployment}'`,
          error,
        );
      }
    },
  });
}
