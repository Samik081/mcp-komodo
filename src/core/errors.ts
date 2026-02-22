/**
 * Error sanitization layer.
 *
 * Strips sensitive credentials from error messages before they reach
 * the LLM context. All Komodo API errors should go through
 * handleKomodoError() to produce MCP-compliant error responses
 * with isError: true.
 */

/** Mutable array of sensitive strings to redact from error messages. */
const SENSITIVE_PATTERNS: string[] = [];

/**
 * Register a string that should be redacted from all error messages.
 * Called at startup with API key and secret before any API calls.
 */
export function registerSensitivePattern(pattern: string): void {
  if (pattern && pattern.length > 0) {
    SENSITIVE_PATTERNS.push(pattern);
  }
}

/**
 * Replace all registered sensitive patterns and common auth header
 * patterns with [REDACTED].
 */
export function sanitizeMessage(message: string): string {
  let sanitized = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replaceAll(pattern, "[REDACTED]");
  }
  // Strip common auth header patterns
  sanitized = sanitized.replace(
    /x-api-key:\s*\S+/gi,
    "x-api-key: [REDACTED]",
  );
  sanitized = sanitized.replace(
    /x-api-secret:\s*\S+/gi,
    "x-api-secret: [REDACTED]",
  );
  sanitized = sanitized.replace(
    /authorization:\s*\S+/gi,
    "authorization: [REDACTED]",
  );
  return sanitized;
}

/** MCP-compliant error response type with isError flag. */
export type McpErrorResponse = {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
};

/**
 * Wrap a Komodo API error into an MCP-compliant error response.
 * Sanitizes the error message to strip any leaked credentials.
 */
export function handleKomodoError(
  context: string,
  error: unknown,
): McpErrorResponse {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null
        ? JSON.stringify(error)
        : String(error);
  const safeMessage = sanitizeMessage(rawMessage);
  return {
    content: [{ type: "text", text: `Error ${context}: ${safeMessage}` }],
    isError: true,
  };
}
