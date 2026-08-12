/**
 * Shared types for the Komodo MCP server.
 */

export type { McpErrorResponse } from "../core/errors.js";

/**
 * Access tier controlling which tools are registered at startup.
 *
 * - "read-only": Only read tools (39 tools) -- no execute or write
 * - "read-execute": Read + execute tools (55 tools) -- no write
 * - "full": All tools including write (63 tools)
 */
export type AccessTier = "read-only" | "read-execute" | "full";
