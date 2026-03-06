/**
 * Komodo API client using native fetch.
 *
 * Replaces the komodo_client SDK with a minimal HTTP wrapper.
 * The Komodo Core API uses a uniform pattern:
 *   POST /{category}/{operation}  with JSON body
 *
 * Categories: /read, /write, /execute
 * Auth: x-api-key + x-api-secret headers
 */

import type { AppConfig } from "./config.js";
import {
  KomodoError,
  registerSensitivePattern,
  sanitizeMessage,
} from "./errors.js";
import { logger } from "./logger.js";

/** Request timeout in milliseconds. */
const REQUEST_TIMEOUT_MS = 30_000;

export class KomodoClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(config: AppConfig) {
    this.baseUrl = config.url;
    this.headers = {
      "x-api-key": config.apiKey,
      "x-api-secret": config.apiSecret,
      "content-type": "application/json",
    };
  }

  /** Call the /read API — queries and reads (no side effects). */
  async read(operation: string, params: object): Promise<any> {
    return this.request("/read", operation, params);
  }

  /** Call the /write API — create, update, delete resources. */
  async write(operation: string, params: object): Promise<any> {
    return this.request("/write", operation, params);
  }

  /** Call the /execute API — trigger operations (deploy, build, etc.). */
  async execute(operation: string, params: object): Promise<any> {
    return this.request("/execute", operation, params);
  }

  /**
   * Validate connectivity by calling GetVersion.
   * Logs the Komodo version on success.
   */
  async validateConnection(): Promise<void> {
    const url = `${this.baseUrl}/read/GetVersion`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.status === 401 || response.status === 403) {
        throw new KomodoError(
          "Authentication failed -- check KOMODO_API_KEY and KOMODO_API_SECRET",
          response.status,
        );
      }

      if (!response.ok) {
        throw new KomodoError(
          `Connection check failed: ${response.status} ${response.statusText}`,
          response.status,
        );
      }

      const data = (await response.json()) as { version?: string };
      logger.info(
        `Connected to Komodo at ${this.baseUrl} (version: ${data.version ?? "unknown"})`,
      );
    } catch (err) {
      if (err instanceof KomodoError) throw err;
      throw new KomodoError(
        sanitizeMessage(
          `Cannot connect to Komodo at ${this.baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  }

  /**
   * Core request method. Sends POST to /{category}/{operation} with
   * JSON body, checks for errors, and returns parsed response.
   */
  private async request(
    category: string,
    operation: string,
    params: object,
  ): Promise<any> {
    const url = `${this.baseUrl}${category}/${operation}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        let detail = `${response.status} ${response.statusText}`;
        try {
          const errBody = (await response.json()) as { error?: string };
          if (errBody.error) {
            detail += ` — ${errBody.error}`;
          }
        } catch {
          // Ignore JSON parse failures on error bodies
        }
        throw new KomodoError(
          sanitizeMessage(`${operation} failed: ${detail}`),
          response.status,
        );
      }

      return await response.json();
    } catch (err) {
      if (err instanceof KomodoError) throw err;
      throw new KomodoError(
        sanitizeMessage(err instanceof Error ? err.message : String(err)),
      );
    }
  }
}

/**
 * Create a Komodo API client from config.
 * Registers credentials as sensitive patterns before creating the client.
 */
export function createClient(config: AppConfig): KomodoClient {
  registerSensitivePattern(config.apiKey);
  registerSensitivePattern(config.apiSecret);
  return new KomodoClient(config);
}

/**
 * Validate connectivity to Komodo.
 * Must be called during startup before accepting MCP connections.
 * Exits the process with code 1 if validation fails.
 */
export async function validateConnection(
  client: KomodoClient,
  config: AppConfig,
): Promise<void> {
  try {
    await client.validateConnection();
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
