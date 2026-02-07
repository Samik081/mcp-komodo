/**
 * Build domain tools: list, get detail, run, cancel.
 *
 * Registers 4 MCP tools for Komodo Build resources.
 * A Build is a Docker image build configuration that compiles source code
 * into container images using a configured Builder.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { createClient } from "../core/client.js";
import type { AppConfig } from "../core/config.js";
import { handleKomodoError } from "../core/errors.js";
import {
  formatBuildList,
  formatBuildDetail,
  formatUpdateCreated,
} from "../core/formatters.js";
import { registerTool } from "../core/tools.js";

type KomodoClient = ReturnType<typeof createClient>;

export function registerBuildTools(server: McpServer, client: KomodoClient, config: AppConfig): void {
  // -------------------------------------------------------------------------
  // komodo_list_builds
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_list_builds",
    description:
      "List all Komodo Builds. A Build is a Docker image build " +
      "configuration that compiles source code into container images " +
      "using a configured Builder. Returns name and version info for " +
      "each build.",
    accessTier: "read-only",
    category: "builds",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      tag: z.string().optional().describe("Filter builds by tag name"),
    },
    handler: async (args) => {
      const tag = args.tag as string | undefined;
      try {
        const builds = await client.read("ListBuilds", {
          query: tag ? { tags: [tag] } : undefined,
        });
        return {
          content: [{ type: "text" as const, text: formatBuildList(builds) }],
        };
      } catch (error) {
        return handleKomodoError("listing builds", error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_get_build
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_get_build",
    description:
      "Get detailed information about a specific Komodo Build by name " +
      "or ID. A Build is a Docker image build configuration. Returns " +
      "builder, image name, version, build path, and current action state.",
    accessTier: "read-only",
    category: "builds",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      build: z.string().describe("Build name or ID"),
    },
    handler: async (args) => {
      const build = args.build as string;
      try {
        const [buildData, actionState] = await Promise.all([
          client.read("GetBuild", { build }),
          client.read("GetBuildActionState", { build }),
        ]);
        return {
          content: [
            {
              type: "text" as const,
              text: formatBuildDetail(buildData, actionState),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(`getting build '${build}'`, error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_run_build
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_run_build",
    description:
      "\u26a0\ufe0f RUN a Komodo Build to create a Docker image. This clones the " +
      "repo (if needed), runs docker build, and pushes the resulting image " +
      "to the configured registry. Builds can take several minutes. A " +
      "Build is a Docker image build configuration that compiles source " +
      "code into container images using a configured Builder.",
    accessTier: "read-execute",
    category: "builds",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    inputSchema: {
      build: z.string().describe("Build name or ID"),
    },
    handler: async (args) => {
      const build = args.build as string;
      try {
        const update = await client.execute("RunBuild", { build });
        return {
          content: [
            {
              type: "text" as const,
              text: formatUpdateCreated(update, `Running build '${build}'`),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(`running build '${build}'`, error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_cancel_build
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_cancel_build",
    description:
      "Cancel a running Komodo Build. Stops the build process if it is " +
      "currently in progress. Has no effect if the build is not running. " +
      "A Build is a Docker image build configuration.",
    accessTier: "read-execute",
    category: "builds",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      build: z.string().describe("Build name or ID"),
    },
    handler: async (args) => {
      const build = args.build as string;
      try {
        const update = await client.execute("CancelBuild", { build });
        return {
          content: [
            {
              type: "text" as const,
              text: formatUpdateCreated(
                update,
                `Cancelling build '${build}'`,
              ),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(`cancelling build '${build}'`, error);
      }
    },
  });
}
