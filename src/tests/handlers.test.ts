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

describe("handler: show_env_values gating", () => {
  const inspectCalls = [
    {
      name: "komodo_inspect_stack_container",
      arguments: { stack: "media-stack", service: "vpn" },
    },
    {
      name: "komodo_inspect_deployment_container",
      arguments: { deployment: "web" },
    },
    {
      name: "komodo_inspect_docker_container",
      arguments: { server: "nuc", container: "web" },
    },
    {
      name: "komodo_inspect_docker_image",
      arguments: { server: "nuc", image: "nginx:latest" },
    },
  ];
  const payload = { Config: { Env: ["API_TOKEN=secret"] } };

  it.each(inspectCalls)(
    "$name refuses show_env_values when env values are not allowed",
    async (call) => {
      const mockClient = makeMockClient();
      vi.mocked(mockClient.read).mockResolvedValue(payload);
      const server = createServer();
      registerAllTools(
        server,
        mockClient,
        makeConfig({ accessTier: "read-only", allowEnvValues: false }),
      );
      const { client, cleanup } = await connectTestClient(server);

      const result = await client.callTool({
        name: call.name,
        arguments: { ...call.arguments, show_env_values: true },
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { type: "text"; text: string }).text;
      expect(text).toContain("KOMODO_ALLOW_ENV_VALUES");
      expect(text).not.toContain("API_TOKEN=secret");
      expect(mockClient.read).not.toHaveBeenCalled();
      await cleanup();
    },
  );

  it.each(inspectCalls)(
    "$name still returns digests without show_env_values when not allowed",
    async (call) => {
      const mockClient = makeMockClient();
      vi.mocked(mockClient.read).mockResolvedValue(payload);
      const server = createServer();
      registerAllTools(
        server,
        mockClient,
        makeConfig({ accessTier: "read-only", allowEnvValues: false }),
      );
      const { client, cleanup } = await connectTestClient(server);

      const result = await client.callTool(call);

      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { type: "text"; text: string }).text;
      expect(text).toContain("API_TOKEN=sha256:2bb80d537b1d");
      await cleanup();
    },
  );

  it("allows show_env_values on read-only when explicitly opted in", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.read).mockResolvedValue(payload);
    const server = createServer();
    registerAllTools(
      server,
      mockClient,
      makeConfig({ accessTier: "read-only", allowEnvValues: true }),
    );
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
    expect(text).toContain("API_TOKEN=secret");
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

describe("handler: log search with zero matches", () => {
  const log = (overrides: Record<string, unknown>) => ({
    stage: "Get log",
    command: "docker logs web --tail 5000 2>&1 | grep -E 'boom'",
    stdout: "",
    stderr: "",
    success: true,
    start_ts: 0,
    end_ts: 0,
    ...overrides,
  });

  const logTools = [
    {
      name: "komodo_get_container_log",
      arguments: { server: "nuc", container: "web" },
      probeOp: "GetContainerLog",
      probeParams: { server: "nuc", container: "web", tail: 1 },
    },
    {
      name: "komodo_get_deployment_log",
      arguments: { deployment: "web" },
      probeOp: "GetDeploymentLog",
      probeParams: { deployment: "web", tail: 1 },
    },
    {
      name: "komodo_get_stack_log",
      arguments: { stack: "media-stack", services: ["web"] },
      probeOp: "GetStackLog",
      probeParams: { stack: "media-stack", services: ["web"], tail: 1 },
    },
  ];

  async function callSearch(
    mockClient: KomodoClient,
    tool: (typeof logTools)[number],
  ) {
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);
    const result = await client.callTool({
      name: tool.name,
      arguments: {
        ...tool.arguments,
        search_terms: ["boom", "bang"],
        search_combinator: "And",
      },
    });
    await cleanup();
    return {
      result,
      text: (result.content as Array<{ type: "text"; text: string }>)[0].text,
    };
  }

  it.each(logTools)(
    "$name reports an empty failed search as no matches when the target exists",
    async (tool) => {
      const mockClient = makeMockClient();
      vi.mocked(mockClient.read)
        .mockResolvedValueOnce(log({ stage: "Get log grep", success: false }))
        .mockResolvedValueOnce(log({ stdout: "last line\n" }));

      const { result, text } = await callSearch(mockClient, tool);

      expect(result.isError).toBeFalsy();
      expect(text).toContain("[OK] Get log grep");
      expect(text).toContain('No lines matched: "boom", "bang" (And)');
      expect(text).not.toContain("last line");
      expect(mockClient.read).toHaveBeenLastCalledWith(
        tool.probeOp,
        tool.probeParams,
      );
    },
  );

  it.each(logTools)(
    "$name surfaces the probe error when the target does not exist",
    async (tool) => {
      const mockClient = makeMockClient();
      vi.mocked(mockClient.read)
        .mockResolvedValueOnce(log({ stage: "Get log grep", success: false }))
        .mockResolvedValueOnce(
          log({
            success: false,
            stderr: "Error response from daemon: No such container: web",
          }),
        );

      const { text } = await callSearch(mockClient, tool);

      expect(text).toContain("[FAILED]");
      expect(text).toContain("No such container: web");
      expect(text).not.toContain("No lines matched");
    },
  );

  it.each(logTools)("$name returns matches without probing", async (tool) => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.read).mockResolvedValueOnce(
      log({ stage: "Get log grep", stdout: "boom bang\n" }),
    );

    const { text } = await callSearch(mockClient, tool);

    expect(text).toContain("[OK] Get log grep");
    expect(text).toContain("boom bang");
    expect(mockClient.read).toHaveBeenCalledTimes(1);
  });

  it.each(logTools)(
    "$name keeps a failed search with output as a failure without probing",
    async (tool) => {
      const mockClient = makeMockClient();
      vi.mocked(mockClient.read).mockResolvedValueOnce(
        log({ stage: "Get log grep", success: false, stderr: "grep: bad" }),
      );

      const { text } = await callSearch(mockClient, tool);

      expect(text).toContain("[FAILED] Get log grep");
      expect(text).toContain("grep: bad");
      expect(mockClient.read).toHaveBeenCalledTimes(1);
    },
  );
});

describe("handler: log search caps output to tail", () => {
  const matches = Array.from({ length: 120 }, (_, i) => `match ${i + 1}`);
  const searchLog = {
    stage: "Get log grep",
    command: "docker logs web 2>&1 | grep -E 'match'",
    stdout: `${matches.join("\n")}\n`,
    stderr: "",
    success: true,
    start_ts: 0,
    end_ts: 0,
  };

  const logTools = [
    {
      name: "komodo_get_container_log",
      arguments: { server: "nuc", container: "web" },
    },
    { name: "komodo_get_deployment_log", arguments: { deployment: "web" } },
    { name: "komodo_get_stack_log", arguments: { stack: "media-stack" } },
  ];

  async function callSearch(
    name: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.read).mockResolvedValueOnce(searchLog);
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);
    const result = await client.callTool({
      name,
      arguments: { ...args, search_terms: ["match"] },
    });
    await cleanup();
    return (result.content as Array<{ type: "text"; text: string }>)[0].text;
  }

  it.each(logTools)(
    "$name keeps the last 50 matches by default and says how many were omitted",
    async (tool) => {
      const text = await callSearch(tool.name, tool.arguments);

      expect(text).toContain("[OK] Get log grep");
      expect(text).toContain("Showing last 50 of 120 matching lines");
      expect(text).toContain("match 120");
      expect(text).toContain("match 71");
      expect(text).not.toContain("match 70\n");
    },
  );

  it.each(logTools)("$name honors tail when searching", async (tool) => {
    const text = await callSearch(tool.name, { ...tool.arguments, tail: 5 });

    expect(text).toContain("Showing last 5 of 120 matching lines");
    expect(text).toContain(
      "match 116\nmatch 117\nmatch 118\nmatch 119\nmatch 120",
    );
    expect(text).not.toContain("match 115");
  });

  it.each(logTools)(
    "$name returns all matches without a note when within tail",
    async (tool) => {
      const text = await callSearch(tool.name, {
        ...tool.arguments,
        tail: 500,
      });

      expect(text).not.toContain("Showing last");
      expect(text).toContain("match 1\n");
      expect(text).toContain("match 120");
    },
  );
});
