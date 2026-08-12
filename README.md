[![npm version](https://img.shields.io/npm/v/@samik081/mcp-komodo)](https://www.npmjs.com/package/@samik081/mcp-komodo)
[![Docker image](https://ghcr-badge.egpl.dev/samik081/mcp-komodo/latest_tag?trim=major&label=docker)](https://ghcr.io/samik081/mcp-komodo)
[![License: MIT](https://img.shields.io/npm/l/@samik081/mcp-komodo)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/@samik081/mcp-komodo)](https://nodejs.org)

# MCP Komodo

MCP server for the [Komodo](https://komo.do) DevOps platform. Manage servers, stacks, deployments, builds, and more through natural language in Cursor, Claude Code, and Claude Desktop.

## Features

- **63 tools** across **14 categories** covering the complete Komodo DevOps API
- **Three access tiers** (`read-only`, `read-execute`, `full`) for granular control
- **Category filtering** via `KOMODO_CATEGORIES` to expose only the tools you need
- **Zero HTTP dependencies** -- lightweight native-fetch client, no SDK required
- **Docker images** for `linux/amd64` and `linux/arm64` on [GHCR](https://ghcr.io/samik081/mcp-komodo)
- **Remote MCP** via HTTP transport (`MCP_TRANSPORT=http`) using the Streamable HTTP protocol
- **TypeScript/ESM** with full type safety

## API Compatibility

Built for Komodo **1.19.5**.

## Quick Start

Run the server directly with npx:

```bash
KOMODO_URL="https://komodo.example.com" \
KOMODO_API_KEY="your-api-key" \
KOMODO_API_SECRET="your-api-secret" \
npx -y @samik081/mcp-komodo
```

The server validates your Komodo connection on startup and fails immediately with a clear error if credentials are missing or invalid.

### Docker

Run with Docker (stdio transport, same as npx):

```bash
docker run --rm -i \
  -e KOMODO_URL=https://komodo.example.com \
  -e KOMODO_API_KEY=your-api-key \
  -e KOMODO_API_SECRET=your-api-secret \
  ghcr.io/samik081/mcp-komodo
```

To run as a remote MCP server with HTTP transport:

```bash
docker run -d -p 3000:3000 \
  -e MCP_TRANSPORT=http \
  -e KOMODO_URL=https://komodo.example.com \
  -e KOMODO_API_KEY=your-api-key \
  -e KOMODO_API_SECRET=your-api-secret \
  ghcr.io/samik081/mcp-komodo
```

The MCP endpoint is available at `http://localhost:3000` and a health check at `http://localhost:3000/health`.

## Configuration

**Claude Code CLI (recommended):**

```bash
# Using npx
claude mcp add --transport stdio komodo \
  --env KOMODO_URL=https://komodo.example.com \
  --env KOMODO_API_KEY=your-api-key \
  --env KOMODO_API_SECRET=your-api-secret \
  -- npx -y @samik081/mcp-komodo

# Using Docker
claude mcp add --transport stdio komodo \
  --env KOMODO_URL=https://komodo.example.com \
  --env KOMODO_API_KEY=your-api-key \
  --env KOMODO_API_SECRET=your-api-secret \
  -- docker run --rm -i ghcr.io/samik081/mcp-komodo

# Using remote HTTP (connect to a running Docker container or HTTP server)
claude mcp add --transport http komodo http://localhost:3000
```

**JSON config** (works with Claude Code `.mcp.json`, Claude Desktop `claude_desktop_config.json`, Cursor `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "komodo": {
      "command": "npx",
      "args": ["-y", "@samik081/mcp-komodo"],
      "env": {
        "KOMODO_URL": "https://komodo.example.com",
        "KOMODO_API_KEY": "your-api-key",
        "KOMODO_API_SECRET": "your-api-secret"
      }
    }
  }
}
```

**Docker (stdio):**

```json
{
  "mcpServers": {
    "komodo": {
      "command": "docker",
      "args": ["run", "--rm", "-i",
        "-e", "KOMODO_URL=https://komodo.example.com",
        "-e", "KOMODO_API_KEY=your-api-key",
        "-e", "KOMODO_API_SECRET=your-api-secret",
        "ghcr.io/samik081/mcp-komodo"
      ]
    }
  }
}
```

**Remote MCP** (connect to a running Docker container or HTTP server):

```json
{
  "mcpServers": {
    "komodo": {
      "type": "streamable-http",
      "url": "http://localhost:3000"
    }
  }
}
```

## Access Tiers

Control which tools are available using the `KOMODO_ACCESS_TIER` environment variable:

| Tier | Tools | Description |
|------|-------|-------------|
| `full` (default) | 63 | Read, execute, and write -- full control |
| `read-execute` | 55 | Read and execute -- no resource creation/deletion, no user administration |
| `read-only` | 39 | Read only -- safe for exploration, no state changes |

**Tier details:**

- **full**: All 63 tools. Includes `komodo_write_resource` for creating, updating, and deleting Komodo resources, plus the user administration tools (service users, API keys, permissions).
- **read-execute**: 55 tools. All read tools plus execute tools (deploy, pull, lifecycle, run, etc.). The `komodo_write_resource` tool and the user administration write tools are hidden.
- **read-only**: 39 tools. List, get, logs, inspect, stats, summaries, operation history, and user/permission reads only. All execute and write tools are hidden.

Tools that are not available in your tier are not registered with the MCP server. They will not appear in your AI tool's tool list, keeping the context clean.

Set `KOMODO_ACCESS_TIER` to `read-only`, `read-execute`, or `full` (default: `full`).

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KOMODO_URL` | Yes | -- | URL of your Komodo Core instance |
| `KOMODO_API_KEY` | Yes | -- | API key for authentication |
| `KOMODO_API_SECRET` | Yes | -- | API secret for authentication |
| `KOMODO_ACCESS_TIER` | No | `full` | Access tier: `read-only`, `read-execute`, or `full` |
| `KOMODO_CATEGORIES` | No | *(all)* | Comma-separated category allowlist (e.g., `servers,stacks,builds`) |
| `KOMODO_TOOL_BLACKLIST` | No | *(none)* | Comma-separated list of tool names to exclude (e.g., `komodo_destroy_stack`) |
| `KOMODO_TOOL_WHITELIST` | No | *(none)* | Comma-separated list of tool names to force-include, bypassing access tier and category filters |
| `DEBUG` | No | `false` | Enable debug logging to stderr |
| `MCP_TRANSPORT` | No | `stdio` | Transport mode: `stdio` (default) or `http` |
| `MCP_PORT` | No | `3000` | HTTP server port (only used when `MCP_TRANSPORT=http`) |
| `MCP_HOST` | No | `0.0.0.0` | HTTP server bind address (only used when `MCP_TRANSPORT=http`) |
| `MCP_EXCLUDE_TOOL_TITLES` | No | `false` | Set `true` to omit tool titles from registration (saves tokens) |

Generate API keys in the Komodo UI under **Settings > API Keys**.

### Available Categories

`servers`, `stacks`, `deployments`, `containers`, `builds`, `repos`, `procedures`, `actions`, `builders`, `alerters`, `resource-syncs`, `updates`, `users`, `write`

## Tools

mcp-komodo provides 63 tools organized by category. Each tool's Access column shows the minimum tier required: `read-only` (available in all tiers), `read-execute` (requires `read-execute` or `full`), or `full` (requires `full` tier only). The Hints column shows tool behavior: `read-only` (no state changes), `destructive` (modifies existing state), `idempotent` (same result if called twice).

All 16 execute tools wait for the operation to complete and report its real outcome by default; pass `wait: false` for fire-and-forget, or `wait_timeout_seconds` to bound the wait (default 45s).

<details>
<summary>Servers (10 tools)</summary>

| Tool | Description | Access | Hints |
|------|-------------|--------|-------|
| `komodo_list_servers` | List all servers with status and region | read-only | read-only, idempotent |
| `komodo_get_server` | Get server configuration, status, and action state | read-only | read-only, idempotent |
| `komodo_get_server_stats` | Get CPU, memory, disk usage, and load averages | read-only | read-only, idempotent |
| `komodo_get_server_info` | Get OS details, hardware info, and running processes | read-only | read-only, idempotent |
| `komodo_inspect_docker_container` | Inspect a Docker container (`docker inspect` payload); env values render as `sha256:<12-hex>` digests unless `show_env_values: true` -- redaction covers `Env` arrays only, so labels, cmd, and mounts are returned unredacted | read-only | read-only, idempotent |
| `komodo_inspect_docker_image` | Inspect a Docker image (`docker image inspect` payload); baked-in env values render as `sha256:<12-hex>` digests unless `show_env_values: true` -- redaction covers `Env` arrays only, so labels, cmd, and layers are returned unredacted | read-only | read-only, idempotent |
| `komodo_inspect_docker_network` | Inspect a Docker network (equivalent to docker network inspect) | read-only | read-only, idempotent |
| `komodo_inspect_docker_volume` | Inspect a Docker volume (equivalent to docker volume inspect) | read-only | read-only, idempotent |
| `komodo_prune_docker` | Prune unused Docker resources on a server | read-execute | destructive, idempotent |
| `komodo_delete_docker_resource` | Delete a specific Docker image, volume, or network | read-execute | destructive |

</details>

<details>
<summary>Stacks (10 tools)</summary>

| Tool | Description | Access | Hints |
|------|-------------|--------|-------|
| `komodo_list_stacks` | List all stacks with state, server, and service count | read-only | read-only, idempotent |
| `komodo_get_stack` | Get stack configuration, services, and action state | read-only | read-only, idempotent |
| `komodo_list_stack_services` | List services in a stack with image, container state, and update availability | read-only | read-only, idempotent |
| `komodo_get_stacks_summary` | Get aggregate counts of all stacks by state | read-only | read-only, idempotent |
| `komodo_get_stack_log` | Get logs from stack services, with optional search | read-only | read-only, idempotent |
| `komodo_inspect_stack_container` | Inspect a container for a specific service in a stack (`docker inspect` payload); env values render as `sha256:<12-hex>` digests unless `show_env_values: true` -- redaction covers `Env` arrays only, so labels, cmd, and mounts are returned unredacted | read-only | read-only, idempotent |
| `komodo_deploy_stack` | Deploy or redeploy a stack | read-execute | destructive |
| `komodo_pull_stack` | Pull latest images without redeploying (docker compose pull) | read-execute | idempotent |
| `komodo_stack_lifecycle` | Start, stop, restart, pause, or unpause a stack; optionally targets specific services | read-execute | destructive |
| `komodo_destroy_stack` | Permanently destroy a stack | read-execute | destructive |

</details>

<details>
<summary>Deployments (9 tools)</summary>

| Tool | Description | Access | Hints |
|------|-------------|--------|-------|
| `komodo_list_deployments` | List all deployments with state, image, and server | read-only | read-only, idempotent |
| `komodo_get_deployment` | Get deployment configuration, container status, and action state | read-only | read-only, idempotent |
| `komodo_get_deployments_summary` | Get aggregate counts of all deployments by state | read-only | read-only, idempotent |
| `komodo_get_deployment_log` | Get container logs, with optional search | read-only | read-only, idempotent |
| `komodo_inspect_deployment_container` | Inspect the container for a deployment (`docker inspect` payload); env values render as `sha256:<12-hex>` digests unless `show_env_values: true` -- redaction covers `Env` arrays only, so labels, cmd, and mounts are returned unredacted | read-only | read-only, idempotent |
| `komodo_deploy_deployment` | Deploy with latest image and configuration | read-execute | destructive |
| `komodo_pull_deployment` | Pull latest image without redeploying (docker pull) | read-execute | idempotent |
| `komodo_deployment_lifecycle` | Start, stop, restart, pause, or unpause a deployment | read-execute | destructive |
| `komodo_destroy_deployment` | Permanently destroy a deployment | read-execute | destructive |

</details>

<details>
<summary>Containers (1 tool)</summary>

| Tool | Description | Access | Hints |
|------|-------------|--------|-------|
| `komodo_get_container_log` | Get logs from any Docker container on a server | read-only | read-only, idempotent |

</details>

<details>
<summary>Builds (4 tools)</summary>

| Tool | Description | Access | Hints |
|------|-------------|--------|-------|
| `komodo_list_builds` | List all build configurations with version info | read-only | read-only, idempotent |
| `komodo_get_build` | Get build configuration, builder, and action state | read-only | read-only, idempotent |
| `komodo_run_build` | Run a build to create a Docker image | read-execute | — |
| `komodo_cancel_build` | Cancel a running build | read-execute | destructive, idempotent |

</details>

<details>
<summary>Repos (3 tools)</summary>

| Tool | Description | Access | Hints |
|------|-------------|--------|-------|
| `komodo_list_repos` | List all repos with URL, server, and state | read-only | read-only, idempotent |
| `komodo_get_repo` | Get repo configuration, branch, and action state | read-only | read-only, idempotent |
| `komodo_repo_clone_pull` | Clone or pull a repo on its target server | read-execute | destructive |

</details>

<details>
<summary>Procedures (3 tools)</summary>

| Tool | Description | Access | Hints |
|------|-------------|--------|-------|
| `komodo_list_procedures` | List all procedures with state | read-only | read-only, idempotent |
| `komodo_get_procedure` | Get procedure stages, operations, and action state | read-only | read-only, idempotent |
| `komodo_run_procedure` | Run a procedure (executes all stages) | read-execute | destructive |

</details>

<details>
<summary>Actions (3 tools)</summary>

| Tool | Description | Access | Hints |
|------|-------------|--------|-------|
| `komodo_list_actions` | List all actions with state | read-only | read-only, idempotent |
| `komodo_get_action` | Get action configuration and action state | read-only | read-only, idempotent |
| `komodo_run_action` | Run a custom TypeScript/Deno action | read-execute | destructive |

</details>

<details>
<summary>Builders (2 tools)</summary>

| Tool | Description | Access | Hints |
|------|-------------|--------|-------|
| `komodo_list_builders` | List all builders with type | read-only | read-only, idempotent |
| `komodo_get_builder` | Get builder type, server configuration, and state | read-only | read-only, idempotent |

</details>

<details>
<summary>Alerters (2 tools)</summary>

| Tool | Description | Access | Hints |
|------|-------------|--------|-------|
| `komodo_list_alerters` | List all alerters with type | read-only | read-only, idempotent |
| `komodo_get_alerter` | Get alerter endpoint type, configuration, and status | read-only | read-only, idempotent |

</details>

<details>
<summary>Resource Syncs (3 tools)</summary>

| Tool | Description | Access | Hints |
|------|-------------|--------|-------|
| `komodo_list_resource_syncs` | List all resource syncs with state and repo info | read-only | read-only, idempotent |
| `komodo_get_resource_sync` | Get sync configuration, managed resources, and state | read-only | read-only, idempotent |
| `komodo_trigger_sync` | Trigger a GitOps sync from the Git repo | read-execute | destructive |

</details>

<details>
<summary>Updates (2 tools)</summary>

| Tool | Description | Access | Hints |
|------|-------------|--------|-------|
| `komodo_list_updates` | List operation history with filters for resource type, target, operation, and success | read-only | read-only, idempotent |
| `komodo_get_update` | Get full operation details including logs with stdout/stderr for each stage | read-only | read-only, idempotent |

</details>

<details>
<summary>Users (10 tools)</summary>

All 10 user tools require a Komodo admin account -- Komodo rejects them for non-admin API keys regardless of the configured access tier.

| Tool | Description | Access | Hints |
|------|-------------|--------|-------|
| `komodo_list_users` | List Komodo users, optionally filtering service users | read-only | read-only, idempotent |
| `komodo_list_api_keys_for_service_user` | List a service user's API keys (secrets are never returned) | read-only | read-only, idempotent |
| `komodo_list_permissions` | List permissions granted to a user or user group | read-only | read-only, idempotent |
| `komodo_create_service_user` | Create a service user for automation | full | — |
| `komodo_delete_user` | Delete a user by ID or username | full | destructive |
| `komodo_create_api_key_for_service_user` | Create an API key for a service user (the secret is returned once) | full | — |
| `komodo_delete_api_key_for_service_user` | Delete a service user's API key | full | destructive |
| `komodo_update_user_base_permissions` | Update a user's enabled / create-servers / create-builds flags | full | destructive, idempotent |
| `komodo_update_permission_on_resource_type` | Set a user or group's base permission on all resources of a type | full | destructive, idempotent |
| `komodo_update_permission_on_target` | Set a user or group's permission on one specific resource | full | destructive, idempotent |

</details>

<details>
<summary>Write (1 tool)</summary>

| Tool | Description | Access | Hints |
|------|-------------|--------|-------|
| `komodo_write_resource` | Create, update, or delete any Komodo resource | full | destructive |

</details>

## Verify It Works

After configuring your MCP client, ask your AI assistant:

> "What servers are connected to Komodo?"

If the connection is working, the assistant will call `komodo_list_servers` and return your servers with their current state and region.

## Usage Examples

Once configured, ask your AI tool questions in natural language:

- **"List all my servers and their status"** -- calls `komodo_list_servers` to show every server with its current state and region.

- **"What's the CPU and memory usage on server prod-01?"** -- calls `komodo_get_server_stats` to show real-time resource utilization.

- **"Show me the logs from the production stack"** -- calls `komodo_get_stack_log` to retrieve recent log output from all services in the stack.

- **"Deploy the frontend stack"** -- calls `komodo_deploy_stack` to redeploy the stack with its current configuration.

- **"Why did the frontend stack deploy fail?"** -- calls `komodo_list_updates` to find the failed deploy, then `komodo_get_update` to show the full logs with stdout/stderr.

- **"Pull the latest images for the monitoring stack"** -- calls `komodo_pull_stack` to download updated images without redeploying.

- **"Create a new deployment called api-staging with image myapp:latest"** -- calls `komodo_write_resource` to create a new Deployment resource in Komodo.

## Troubleshooting

### Connection refused

Check that `KOMODO_URL` is correct and that Komodo Core is reachable from where the MCP server is running. The server validates the connection on startup, so if it started successfully, the URL was valid at that time.

### Invalid credentials / 401 Unauthorized

Verify your API key and secret are correct. Check that the key has not been revoked or expired in the Komodo UI under Settings > API Keys.

### Tools not showing up

Check your access tier setting. In `read-only` mode, only 39 tools are registered. In `read-execute` mode, 55 tools are registered. Use `full` (or omit `KOMODO_ACCESS_TIER`) for all 63 tools. Check `KOMODO_CATEGORIES` -- only tools in listed categories are registered. Also verify the server started without errors by checking stderr output.

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode (auto-reload)
npm run dev

# Open the MCP Inspector for interactive testing
npm run inspect
```

## License

[MIT](LICENSE)
