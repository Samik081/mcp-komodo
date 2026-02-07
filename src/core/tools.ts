/**
 * Tool registration helper. Wraps MCP server.registerTool() with
 * access tier checking.
 *
 * Komodo uses a 3-tier model: "read-only" < "read-execute" < "full".
 * Each tool declares its minimum tier. The wrapper skips tools whose
 * tier exceeds the configured access level.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { ZodRawShape } from "zod";
import type { AccessTier } from "../types/index.js";
import type { AppConfig } from "./config.js";
import { logger } from "./logger.js";

const TIER_LEVELS: Record<AccessTier, number> = {
  "read-only": 0,
  "read-execute": 1,
  "full": 2,
};

export interface ToolRegistrationOptions {
  name: string;
  description: string;
  accessTier: AccessTier;
  category: string;
  annotations?: ToolAnnotations;
  inputSchema?: ZodRawShape;
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: "text"; text: string }>;
    isError?: boolean;
  }>;
}

/**
 * Register a tool with the MCP server, respecting access tier.
 *
 * Returns true if the tool was registered, false if filtered out.
 *
 * Unlike AdGuard/Authentik, Komodo handlers return the full MCP response
 * format (including error handling), so the wrapper does not add error wrapping.
 */
export function registerTool(
  server: McpServer,
  config: AppConfig,
  options: ToolRegistrationOptions,
): boolean {
  if (TIER_LEVELS[config.accessTier] < TIER_LEVELS[options.accessTier]) {
    logger.debug(
      `Skipping tool "${options.name}" (requires ${options.accessTier}, running in ${config.accessTier} mode)`,
    );
    return false;
  }

  if (config.categories !== null && !config.categories.includes(options.category)) {
    logger.debug(
      `Skipping tool "${options.name}" (category "${options.category}" not in allowed categories)`,
    );
    return false;
  }

  const annotations: ToolAnnotations = {
    readOnlyHint: options.accessTier === "read-only",
    destructiveHint: false,
    ...options.annotations,
  };

  const toolConfig: {
    description: string;
    inputSchema?: ZodRawShape;
    annotations: ToolAnnotations;
  } = {
    description: options.description,
    annotations,
  };

  if (options.inputSchema) {
    toolConfig.inputSchema = options.inputSchema;
  }

  server.registerTool(options.name, toolConfig, async (args: Record<string, unknown>) => {
    return options.handler(args);
  });

  return true;
}
