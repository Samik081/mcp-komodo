import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createServer } from "../core/server.js";
import { registerAllTools } from "../tools/index.js";
import { makeConfig, makeMockClient, connectTestClient } from "./helpers.js";
import type { KomodoClient } from "../core/client.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

describe("handler: komodo_list_servers", () => {
  let cleanup: () => Promise<void>;
  let mcpClient: Client;
  let mockClient: KomodoClient;

  beforeEach(async () => {
    mockClient = makeMockClient();
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const conn = await connectTestClient(server);
    mcpClient = conn.client;
    cleanup = conn.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("returns formatted server list on success", async () => {
    vi.mocked(mockClient.read).mockResolvedValueOnce([
      { name: "server1", info: { status: "OK" }, tags: [] },
    ]);

    const result = await mcpClient.callTool({
      name: "komodo_list_servers",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("server1");
  });

  it("returns isError when client throws", async () => {
    vi.mocked(mockClient.read).mockRejectedValueOnce(new Error("connection refused"));

    const result = await mcpClient.callTool({
      name: "komodo_list_servers",
      arguments: {},
    });

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("listing servers");
  });
});

describe("handler: komodo_get_server", () => {
  let cleanup: () => Promise<void>;
  let mcpClient: Client;
  let mockClient: KomodoClient;

  beforeEach(async () => {
    mockClient = makeMockClient();
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const conn = await connectTestClient(server);
    mcpClient = conn.client;
    cleanup = conn.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("calls client.read with correct operations", async () => {
    vi.mocked(mockClient.read)
      .mockResolvedValueOnce({ name: "srv1", config: {}, info: { status: "OK" }, tags: [] })
      .mockResolvedValueOnce({ state: "idle" });

    const result = await mcpClient.callTool({
      name: "komodo_get_server",
      arguments: { server: "srv1" },
    });

    expect(mockClient.read).toHaveBeenCalledWith("GetServer", { server: "srv1" });
    expect(mockClient.read).toHaveBeenCalledWith("GetServerActionState", { server: "srv1" });
    expect(result.isError).toBeFalsy();
  });

  it("rejects missing required server argument", async () => {
    const result = await mcpClient.callTool({
      name: "komodo_get_server",
      arguments: {},
    });

    expect(result.isError).toBe(true);
  });
});

describe("handler: komodo_prune_docker (read-execute tier)", () => {
  it("is not registered in read-only mode", async () => {
    const server = createServer();
    registerAllTools(server, makeMockClient(), makeConfig({ accessTier: "read-only" }));
    const { client, cleanup } = await connectTestClient(server);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).not.toContain("komodo_prune_docker");
    await cleanup();
  });

  it("calls client.execute with correct operation", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.execute).mockResolvedValueOnce({ id: "update-1" });
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "komodo_prune_docker",
      arguments: { server: "srv1", resource_type: "containers" },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.execute).toHaveBeenCalledWith("PruneContainers", { server: "srv1" });
    await cleanup();
  });
});
