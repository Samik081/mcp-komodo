import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { vi } from "vitest";
import type { KomodoClient } from "../core/client.js";
import type { AppConfig } from "../core/config.js";

export function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    url: "https://komodo.test",
    apiKey: "test-api-key",
    apiSecret: "test-api-secret",
    accessTier: "full",
    categories: null,
    toolBlacklist: null,
    toolWhitelist: null,
    excludeToolTitles: false,
    debug: false,
    transport: "stdio",
    httpPort: 3000,
    httpHost: "0.0.0.0",
    ...overrides,
  };
}

export function makeMockClient(): KomodoClient {
  return {
    read: vi.fn().mockResolvedValue({}),
    execute: vi.fn().mockResolvedValue({}),
    write: vi.fn().mockResolvedValue({}),
  } as unknown as KomodoClient;
}

export async function connectTestClient(server: McpServer) {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(clientTransport);
  return {
    client,
    cleanup: async () => {
      await client.close();
    },
  };
}
