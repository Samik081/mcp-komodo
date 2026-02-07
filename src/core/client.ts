/**
 * Komodo API client factory with startup validation.
 *
 * CRITICAL: KomodoClient is a FACTORY FUNCTION -- do NOT use `new`.
 * Sensitive patterns are registered BEFORE the client is created
 * so that any error during initialization is also sanitized.
 */

import { KomodoClient } from "komodo_client";
import type { AppConfig } from "./config.js";
import { logger } from "./logger.js";
import { registerSensitivePattern, sanitizeMessage } from "./errors.js";

/**
 * Create a Komodo API client from config.
 * Registers credentials as sensitive patterns before creating the client.
 */
export function createClient(config: AppConfig) {
  registerSensitivePattern(config.apiKey);
  registerSensitivePattern(config.apiSecret);

  return KomodoClient(config.url, {
    type: "api-key",
    params: { key: config.apiKey, secret: config.apiSecret },
  });
}

/**
 * Validate connectivity to Komodo by calling GetVersion.
 * Must be called during startup before accepting MCP connections.
 * Exits the process with code 1 if validation fails.
 */
export async function validateConnection(
  client: ReturnType<typeof createClient>,
  config: AppConfig,
): Promise<void> {
  try {
    const version = await client.read("GetVersion", {});
    logger.info(
      `Connected to Komodo at ${config.url} (version: ${version.version})`,
    );
  } catch (error) {
    logger.error(`Failed to connect to Komodo at ${config.url}`);
    logger.error(
      "Check that KOMODO_URL is correct and Komodo Core is running.",
    );
    if (error instanceof Error) {
      logger.error(`Details: ${sanitizeMessage(error.message)}`);
    }
    process.exit(1);
  }
}
