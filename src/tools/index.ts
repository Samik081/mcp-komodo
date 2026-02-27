/**
 * Tool registration barrel file.
 *
 * Imports all domain tool modules and exports a single
 * registerAllTools() function that wires them into the MCP server.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { createClient } from "../core/client.js";
import type { AppConfig } from "../core/config.js";
import { registerServerTools } from "./servers.js";
import { registerStackTools } from "./stacks.js";
import { registerDeploymentTools } from "./deployments.js";
import { registerContainerTools } from "./containers.js";
import { registerBuildTools } from "./builds.js";
import { registerRepoTools } from "./repos.js";
import { registerProcedureTools } from "./procedures.js";
import { registerActionTools } from "./actions.js";
import { registerBuilderTools } from "./builders.js";
import { registerAlerterTools } from "./alerters.js";
import { registerResourceSyncTools } from "./resource-syncs.js";
import { registerUpdateTools } from "./updates.js";
import { registerWriteTools } from "./write.js";

export function registerAllTools(
  server: McpServer,
  client: ReturnType<typeof createClient>,
  config: AppConfig,
): void {
  registerServerTools(server, client, config);
  registerStackTools(server, client, config);
  registerDeploymentTools(server, client, config);
  registerContainerTools(server, client, config);
  registerBuildTools(server, client, config);
  registerRepoTools(server, client, config);
  registerProcedureTools(server, client, config);
  registerActionTools(server, client, config);
  registerBuilderTools(server, client, config);
  registerAlerterTools(server, client, config);
  registerResourceSyncTools(server, client, config);
  registerUpdateTools(server, client, config);
  registerWriteTools(server, client, config);
}
