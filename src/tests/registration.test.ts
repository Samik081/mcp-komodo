import { describe, it, expect } from "vitest";
import { createServer } from "../core/server.js";
import { registerAllTools } from "../tools/index.js";
import { makeConfig, makeMockClient, connectTestClient } from "./helpers.js";

describe("tool registration", () => {
  it("registers all tools at full tier", async () => {
    const server = createServer();
    registerAllTools(server, makeMockClient(), makeConfig());
    const { client, cleanup } = await connectTestClient(server);
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(53);
    await cleanup();
  });

  it("registers only read-only tools in read-only mode", async () => {
    const server = createServer();
    registerAllTools(server, makeMockClient(), makeConfig({ accessTier: "read-only" }));
    const { client, cleanup } = await connectTestClient(server);
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(36);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, `${tool.name} missing readOnlyHint`).toBe(true);
    }
    await cleanup();
  });

  it("registers read-only + read-execute tools in read-execute mode", async () => {
    const server = createServer();
    registerAllTools(server, makeMockClient(), makeConfig({ accessTier: "read-execute" }));
    const { client, cleanup } = await connectTestClient(server);
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(52);
    await cleanup();
  });

  it("filters to only servers category tools", async () => {
    const server = createServer();
    registerAllTools(server, makeMockClient(), makeConfig({ categories: ["servers"] }));
    const { client, cleanup } = await connectTestClient(server);
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(tool.name).toMatch(/^komodo_.*server|^komodo_inspect_docker|^komodo_prune_docker|^komodo_delete_docker/);
    }
    await cleanup();
  });

  it("registers fewer tools when category filter is applied", async () => {
    const fullServer = createServer();
    registerAllTools(fullServer, makeMockClient(), makeConfig());
    const fullConn = await connectTestClient(fullServer);
    const { tools: allTools } = await fullConn.client.listTools();

    const filteredServer = createServer();
    registerAllTools(filteredServer, makeMockClient(), makeConfig({ categories: ["servers", "stacks"] }));
    const filteredConn = await connectTestClient(filteredServer);
    const { tools: filteredTools } = await filteredConn.client.listTools();

    expect(filteredTools.length).toBeGreaterThan(0);
    expect(filteredTools.length).toBeLessThan(allTools.length);

    await fullConn.cleanup();
    await filteredConn.cleanup();
  });

  describe("annotations", () => {
    it("komodo_list_servers: readOnly, not destructive, idempotent", async () => {
      const server = createServer();
      registerAllTools(server, makeMockClient(), makeConfig());
      const { client, cleanup } = await connectTestClient(server);
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "komodo_list_servers");
      expect(tool).toBeDefined();
      expect(tool!.annotations?.readOnlyHint).toBe(true);
      expect(tool!.annotations?.destructiveHint).toBe(false);
      expect(tool!.annotations?.idempotentHint).toBe(true);
      await cleanup();
    });

    it("komodo_prune_docker: not readOnly, destructive, idempotent", async () => {
      const server = createServer();
      registerAllTools(server, makeMockClient(), makeConfig());
      const { client, cleanup } = await connectTestClient(server);
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "komodo_prune_docker");
      expect(tool).toBeDefined();
      expect(tool!.annotations?.readOnlyHint).toBe(false);
      expect(tool!.annotations?.destructiveHint).toBe(true);
      expect(tool!.annotations?.idempotentHint).toBe(true);
      await cleanup();
    });
  });
});
