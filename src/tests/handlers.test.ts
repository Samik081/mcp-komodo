import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KomodoClient } from "../core/client.js";
import { createServer } from "../core/server.js";
import { registerAllTools } from "../tools/index.js";
import { connectTestClient, makeConfig, makeMockClient } from "./helpers.js";

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
    vi.mocked(mockClient.read).mockRejectedValueOnce(
      new Error("connection refused"),
    );

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
      .mockResolvedValueOnce({
        name: "srv1",
        config: {},
        info: { status: "OK" },
        tags: [],
      })
      .mockResolvedValueOnce({ state: "idle" });

    const result = await mcpClient.callTool({
      name: "komodo_get_server",
      arguments: { server: "srv1" },
    });

    expect(mockClient.read).toHaveBeenCalledWith("GetServer", {
      server: "srv1",
    });
    expect(mockClient.read).toHaveBeenCalledWith("GetServerActionState", {
      server: "srv1",
    });
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
    registerAllTools(
      server,
      makeMockClient(),
      makeConfig({ accessTier: "read-only" }),
    );
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
    expect(mockClient.execute).toHaveBeenCalledWith("PruneContainers", {
      server: "srv1",
    });
    await cleanup();
  });
});

describe("handler: komodo_stack_lifecycle services", () => {
  it("passes services through to the execute operation", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.execute).mockResolvedValueOnce({
      _id: { $oid: "u1" },
      status: "Complete",
      success: true,
      logs: [],
    });
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "komodo_stack_lifecycle",
      arguments: {
        stack: "adguard",
        action: "restart",
        services: ["vpn"],
      },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.execute).toHaveBeenCalledWith("RestartStack", {
      stack: "adguard",
      services: ["vpn"],
    });
    await cleanup();
  });
});

describe("handler: execute tools wait for completion", () => {
  it("komodo_stack_lifecycle polls and reports the real failure", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.execute).mockResolvedValueOnce({
      _id: { $oid: "u2" },
      status: "InProgress",
      success: true,
      logs: [],
    });
    vi.mocked(mockClient.read).mockResolvedValueOnce({
      _id: { $oid: "u2" },
      status: "Complete",
      success: false,
      logs: [
        {
          stage: "restart stack",
          command: "",
          stdout: "",
          stderr: "permission denied",
          success: false,
          start_ts: 0,
          end_ts: 0,
        },
      ],
    });
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "komodo_stack_lifecycle",
      arguments: { stack: "adguard", action: "restart" },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Result: Failed");
    expect(text).toContain("Failed stage: restart stack");
    expect(text).toContain("permission denied");
    await cleanup();
  }, 10_000);

  it("komodo_deploy_stack with wait false does not poll", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.execute).mockResolvedValueOnce({
      _id: { $oid: "u3" },
      status: "Queued",
      success: true,
      logs: [],
    });
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "komodo_deploy_stack",
      arguments: { stack: "adguard", wait: false },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.read).not.toHaveBeenCalled();
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("komodo_get_update");
    await cleanup();
  });

  it("komodo_run_build with wait false does not poll", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.execute).mockResolvedValueOnce({
      _id: { $oid: "u4" },
      status: "Queued",
      success: true,
      logs: [],
    });
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "komodo_run_build",
      arguments: { build: "my-build", wait: false },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.read).not.toHaveBeenCalled();
    await cleanup();
  });

  it("komodo_deployment_lifecycle polls to success", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.execute).mockResolvedValueOnce({
      _id: { $oid: "u5" },
      status: "InProgress",
      success: true,
      logs: [],
    });
    vi.mocked(mockClient.read).mockResolvedValueOnce({
      _id: { $oid: "u5" },
      status: "Complete",
      success: true,
      logs: [],
    });
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "komodo_deployment_lifecycle",
      arguments: { deployment: "adguard", action: "restart" },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Result: Success");
    await cleanup();
  }, 10_000);
});

describe("handler: inspect tools redact env values", () => {
  const container = {
    Id: "abc123",
    Config: {
      Image: "example/vpn-client",
      Env: ["VPN_PRIVATE_KEY=secret", "TZ=UTC", "PATH=/usr/bin"],
    },
  };

  it("hashes env values by default", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.read).mockResolvedValueOnce(container);
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "komodo_inspect_stack_container",
      arguments: { stack: "media-stack", service: "vpn" },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: "text"; text: string }).text;
    // sha256("secret") starts with 2bb80d537b1d
    expect(text).toContain("VPN_PRIVATE_KEY=sha256:2bb80d537b1d");
    expect(text).not.toContain("VPN_PRIVATE_KEY=secret");
    expect(text).toContain("TZ=sha256:");
    await cleanup();
  });

  it("reveals plaintext env only with show_env_values true", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.read).mockResolvedValueOnce(container);
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "komodo_inspect_stack_container",
      arguments: {
        stack: "media-stack",
        service: "vpn",
        show_env_values: true,
      },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("VPN_PRIVATE_KEY=secret");
    await cleanup();
  });
});

describe("handler: komodo_inspect_docker_image redacts baked-in env", () => {
  it("hashes image env values by default", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.read).mockResolvedValueOnce({
      Config: { Env: ["BUILD_SECRET=secret"] },
    });
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "komodo_inspect_docker_image",
      arguments: { server: "nuc", image: "nginx:latest" },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: "text"; text: string }).text;
    // sha256("secret") starts with 2bb80d537b1d
    expect(text).toContain("BUILD_SECRET=sha256:2bb80d537b1d");
    expect(text).not.toContain("BUILD_SECRET=secret");
    await cleanup();
  });
});

describe("handler: users read tools", () => {
  it("komodo_list_users formats the user list", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.read).mockResolvedValueOnce([
      {
        _id: { $oid: "64f0" },
        username: "automation-bot",
        enabled: true,
        admin: false,
        create_server_permissions: false,
        create_build_permissions: false,
        config: { type: "Service", data: {} },
      },
    ]);
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "komodo_list_users",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.read).toHaveBeenCalledWith("ListUsers", {
      service_users: "Include",
    });
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("automation-bot");
    expect(text).toContain("service");
    expect(text).toContain("64f0");
    await cleanup();
  });

  it("komodo_list_permissions queries the given user target", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.read).mockResolvedValueOnce([
      {
        user_target: { type: "User", id: "64f0" },
        resource_target: { type: "Stack", id: "abc" },
        level: "Read",
      },
    ]);
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "komodo_list_permissions",
      arguments: { user_target_type: "User", user_target_id: "64f0" },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.read).toHaveBeenCalledWith("ListUserTargetPermissions", {
      user_target: { type: "User", id: "64f0" },
    });
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Stack/abc: Read");
    await cleanup();
  });

  it("komodo_list_api_keys_for_service_user formats the key list", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.read).mockResolvedValueOnce([
      {
        name: "ci-key",
        key: "K-abc123",
        created_at: 1700000000000,
        expires: 0,
      },
    ]);
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "komodo_list_api_keys_for_service_user",
      arguments: { user_id: "64f0" },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.read).toHaveBeenCalledWith("ListApiKeysForServiceUser", {
      user: "64f0",
    });
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("ci-key");
    expect(text).toContain("expires: never");
    await cleanup();
  });
});

describe("handler: users write tools", () => {
  it("komodo_create_api_key_for_service_user prints the secret once", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.write).mockResolvedValueOnce({
      key: "K-123",
      secret: "S-456",
    });
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "komodo_create_api_key_for_service_user",
      arguments: { user_id: "64f0", name: "runner-key" },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.write).toHaveBeenCalledWith(
      "CreateApiKeyForServiceUser",
      {
        user_id: "64f0",
        name: "runner-key",
        expires: 0,
      },
    );
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("K-123");
    expect(text).toContain("S-456");
    expect(text).toContain("cannot be retrieved again");
    await cleanup();
  });

  it("komodo_create_api_key_for_service_user errors on a missing secret", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.write).mockResolvedValueOnce({});
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "komodo_create_api_key_for_service_user",
      arguments: { user_id: "64f0", name: "runner-key" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("unexpected response");
    expect(text).not.toContain("undefined");
    await cleanup();
  });

  it("komodo_update_permission_on_target builds tagged targets", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.write).mockResolvedValueOnce({});
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "komodo_update_permission_on_target",
      arguments: {
        user_target_type: "User",
        user_target_id: "64f0",
        resource_target_type: "Stack",
        resource_target_id: "abc",
        permission: "Execute",
      },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.write).toHaveBeenCalledWith("UpdatePermissionOnTarget", {
      user_target: { type: "User", id: "64f0" },
      resource_target: { type: "Stack", id: "abc" },
      permission: "Execute",
    });
    await cleanup();
  });

  it("komodo_update_user_base_permissions sends only provided flags", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.write).mockResolvedValueOnce({});
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "komodo_update_user_base_permissions",
      arguments: { user_id: "64f0", enabled: true },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.write).toHaveBeenCalledWith("UpdateUserBasePermissions", {
      user_id: "64f0",
      enabled: true,
    });
    await cleanup();
  });
});
