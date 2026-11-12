/**
 * Environment variable parsing and validation.
 * Reads required and optional config from process.env.
 */

import type { AccessTier } from "../types/index.js";

export interface AppConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
  accessTier: AccessTier;
  categories: string[] | null;
  toolBlacklist: string[] | null;
  toolWhitelist: string[] | null;
  excludeToolTitles: boolean;
  debug: boolean;
  transport: "stdio" | "http";
  httpPort: number;
  httpHost: string;
  /**
   * Extra hostnames accepted in Host/Origin headers (MCP_ALLOWED_HOSTS), on
   * top of the loopback names implied by a loopback httpHost.
   */
  allowedHosts: string[];
  /** Idle time after which an HTTP session is closed. 0 disables reaping. */
  sessionIdleTimeoutMs: number;
  /** Whether inspect tools may return plaintext env values (show_env_values). */
  allowEnvValues: boolean;
}

/**
 * Determine the access tier from KOMODO_ACCESS_TIER.
 *
 * Valid values: "read-only", "read-execute", "full" (default).
 */
function parseAccessTier(): AccessTier {
  const tier = process.env.KOMODO_ACCESS_TIER;
  if (tier === "read-only" || tier === "read-execute") {
    return tier;
  }

  return "full";
}

/**
 * Determine whether plaintext env values may be shown from
 * KOMODO_ALLOW_ENV_VALUES ("true" | "false"). Any other value falls back
 * to the tier default: allowed on read-execute and full, refused on
 * read-only.
 */
function parseAllowEnvValues(accessTier: AccessTier): boolean {
  const value = process.env.KOMODO_ALLOW_ENV_VALUES;
  if (value === "true") return true;
  if (value === "false") return false;
  return accessTier !== "read-only";
}

function parseCategories(value: string | undefined): string[] | null {
  if (value === undefined || value === "") {
    return null;
  }
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Parse MCP_ALLOWED_HOSTS: comma-separated hostnames accepted in the Host and
 * Origin headers of HTTP requests. Ports are ignored; IPv6 must be bracketed.
 */
export function parseAllowedHosts(value: string | undefined): string[] {
  const hosts: string[] = [];
  for (const entry of (value ?? "").split(",")) {
    const raw = entry.trim();
    if (raw === "") continue;
    let url: URL | undefined;
    try {
      url = new URL(`http://${raw}`);
    } catch {
      // handled below
    }
    if (
      !url ||
      raw.includes("/") ||
      url.username !== "" ||
      url.search !== "" ||
      url.hash !== ""
    ) {
      throw new Error(
        `Invalid MCP_ALLOWED_HOSTS entry: "${raw}". Expected a hostname or IP (e.g. "mcp.example.com", "[::1]"), without scheme or path.`,
      );
    }
    hosts.push(url.hostname.toLowerCase());
  }
  return hosts;
}

function parseToolList(value: string | undefined): string[] | null {
  if (value === undefined || value === "") {
    return null;
  }
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Load and validate application config from environment variables.
 *
 * Required: KOMODO_URL, KOMODO_API_KEY, KOMODO_API_SECRET
 * Optional: KOMODO_ACCESS_TIER (default: 'full'), KOMODO_CATEGORIES,
 * KOMODO_ALLOW_ENV_VALUES (default: allowed unless read-only), DEBUG
 *
 * Throws clear error (no credentials in message) if required vars are missing.
 */
export function loadConfig(): AppConfig {
  const url = process.env.KOMODO_URL;
  const apiKey = process.env.KOMODO_API_KEY;
  const apiSecret = process.env.KOMODO_API_SECRET;

  if (!url || !apiKey || !apiSecret) {
    const missing: string[] = [];
    if (!url) missing.push("KOMODO_URL");
    if (!apiKey) missing.push("KOMODO_API_KEY");
    if (!apiSecret) missing.push("KOMODO_API_SECRET");
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "Set these variables to connect to your Komodo instance.",
    );
  }

  const excludeToolTitles = process.env.MCP_EXCLUDE_TOOL_TITLES === "true";

  const transport =
    process.env.MCP_TRANSPORT === "http"
      ? ("http" as const)
      : ("stdio" as const);
  const rawPort = process.env.MCP_PORT ?? "3000";
  const httpPort = parseInt(rawPort, 10);
  if (Number.isNaN(httpPort) || httpPort < 1 || httpPort > 65535) {
    throw new Error(
      `Invalid MCP_PORT: "${rawPort}". Must be an integer between 1 and 65535.`,
    );
  }
  const httpHost = process.env.MCP_HOST ?? "127.0.0.1";
  const allowedHosts = parseAllowedHosts(process.env.MCP_ALLOWED_HOSTS);

  // Idle HTTP sessions are closed after this many seconds (0 disables).
  const rawIdleTimeout = process.env.MCP_SESSION_IDLE_TIMEOUT ?? "1800";
  const sessionIdleTimeoutSec = Number(rawIdleTimeout);
  if (
    !Number.isInteger(sessionIdleTimeoutSec) ||
    sessionIdleTimeoutSec < 0 ||
    rawIdleTimeout.trim() === ""
  ) {
    throw new Error(
      `Invalid MCP_SESSION_IDLE_TIMEOUT: "${rawIdleTimeout}". Must be a non-negative integer (seconds, 0 disables).`,
    );
  }
  const sessionIdleTimeoutMs = sessionIdleTimeoutSec * 1000;

  const accessTier = parseAccessTier();

  return {
    url: url.replace(/\/+$/, ""),
    apiKey,
    apiSecret,
    accessTier,
    categories: parseCategories(process.env.KOMODO_CATEGORIES),
    toolBlacklist: parseToolList(process.env.KOMODO_TOOL_BLACKLIST),
    toolWhitelist: parseToolList(process.env.KOMODO_TOOL_WHITELIST),
    excludeToolTitles,
    debug: Boolean(process.env.DEBUG),
    transport,
    httpPort,
    httpHost,
    allowedHosts,
    sessionIdleTimeoutMs,
    allowEnvValues: parseAllowEnvValues(accessTier),
  };
}
