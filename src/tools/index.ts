/**
 * Tool registration barrel file.
 *
 * Imports all domain tool modules and exports a single
 * registerAllTools() function that wires them into the MCP server.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KomodoClient } from "../core/client.js";
import type { AppConfig } from "../core/config.js";
import { validateToolLists } from "../core/tools.js";
import { registerActionTools } from "./actions.js";
import { registerAlerterTools } from "./alerters.js";
import { registerBuilderTools } from "./builders.js";
import { registerBuildTools } from "./builds.js";
import { registerContainerTools } from "./containers.js";
import { registerDeploymentTools } from "./deployments.js";
import { registerProcedureTools } from "./procedures.js";
import { registerRepoTools } from "./repos.js";
import { registerResourceSyncTools } from "./resource-syncs.js";
import { registerServerTools } from "./servers.js";
import { registerStackTools } from "./stacks.js";
import { registerUpdateTools } from "./updates.js";
import { registerWriteTools } from "./write.js";

export function registerAllTools(
  server: McpServer,
  client: KomodoClient,
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

  validateToolLists(config);
}
