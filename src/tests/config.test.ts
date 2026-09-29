import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../core/config.js";

describe("loadConfig: allowEnvValues", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    process.env.KOMODO_URL = "https://komodo.test";
    process.env.KOMODO_API_KEY = "key";
    process.env.KOMODO_API_SECRET = "secret";
    delete process.env.KOMODO_ACCESS_TIER;
    delete process.env.KOMODO_ALLOW_ENV_VALUES;
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it.each([
    ["full", true],
    ["read-execute", true],
    ["read-only", false],
  ])("defaults from the %s tier to %s", (tier, expected) => {
    process.env.KOMODO_ACCESS_TIER = tier;
    expect(loadConfig().allowEnvValues).toBe(expected);
  });

  it("KOMODO_ALLOW_ENV_VALUES=true opts the read-only tier in", () => {
    process.env.KOMODO_ACCESS_TIER = "read-only";
    process.env.KOMODO_ALLOW_ENV_VALUES = "true";
    expect(loadConfig().allowEnvValues).toBe(true);
  });

  it("KOMODO_ALLOW_ENV_VALUES=false locks the full tier down", () => {
    process.env.KOMODO_ALLOW_ENV_VALUES = "false";
    expect(loadConfig().allowEnvValues).toBe(false);
  });

  it("ignores unrecognized values and falls back to the tier default", () => {
    process.env.KOMODO_ACCESS_TIER = "read-only";
    process.env.KOMODO_ALLOW_ENV_VALUES = "yes";
    expect(loadConfig().allowEnvValues).toBe(false);
  });
});
