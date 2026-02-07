/**
 * Environment variable parsing and validation.
 * Reads required and optional config from process.env.
 */

import type { AccessTier } from '../types/index.js';

export interface AppConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
  accessTier: AccessTier;
  categories: string[] | null;
  debug: boolean;
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

function parseCategories(value: string | undefined): string[] | null {
  if (value === undefined || value === '') {
    return null;
  }
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Load and validate application config from environment variables.
 *
 * Required: KOMODO_URL, KOMODO_API_KEY, KOMODO_API_SECRET
 * Optional: KOMODO_ACCESS_TIER (default: 'full'), KOMODO_CATEGORIES, DEBUG
 *
 * Throws clear error (no credentials in message) if required vars are missing.
 */
export function loadConfig(): AppConfig {
  const url = process.env.KOMODO_URL;
  const apiKey = process.env.KOMODO_API_KEY;
  const apiSecret = process.env.KOMODO_API_SECRET;

  const missing: string[] = [];
  if (!url) missing.push('KOMODO_URL');
  if (!apiKey) missing.push('KOMODO_API_KEY');
  if (!apiSecret) missing.push('KOMODO_API_SECRET');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Set these variables to connect to your Komodo instance.',
    );
  }

  return {
    url: url!.replace(/\/+$/, ''),
    apiKey: apiKey!,
    apiSecret: apiSecret!,
    accessTier: parseAccessTier(),
    categories: parseCategories(process.env.KOMODO_CATEGORIES),
    debug: Boolean(process.env.DEBUG),
  };
}
