[![npm version](https://img.shields.io/npm/v/@samik081/mcp-komodo)](https://www.npmjs.com/package/@samik081/mcp-komodo)
[![Docker image](https://ghcr-badge.egpl.dev/samik081/mcp-komodo/latest_tag?trim=major&label=docker)](https://ghcr.io/samik081/mcp-komodo)
[![License: MIT](https://img.shields.io/npm/l/@samik081/mcp-komodo)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/@samik081/mcp-komodo)](https://nodejs.org)

# MCP Komodo

MCP server for the [Komodo](https://komo.do) DevOps platform. Manage servers, stacks, deployments, builds, and more through natural language in Cursor, Claude Code, and Claude Desktop.

> **Disclaimer:** Most of this code has been AI-generated and has not been fully tested yet. I created this project for my own needs and plan to continue improving its quality, but it may be buggy in the early stages. If you find a bug, feel free to [open an issue](https://github.com/Samik081/mcp-komodo/issues) -- I'll try to work on it in my spare time.

## Features

- **46 tools** across **12 resource categories** covering the complete Komodo DevOps API
- **Three access tiers** (`read-only`, `read-execute`, `full`) for granular control
- **Category filtering** via `KOMODO_CATEGORIES` to expose only the tools you need
- **Zero HTTP dependencies** -- uses the official `komodo_client` SDK
- **Docker images** for `linux/amd64` and `linux/arm64` on [GHCR](https://ghcr.io/samik081/mcp-komodo)
- **Remote MCP** via HTTP transport (`MCP_TRANSPORT=http`) using the Streamable HTTP protocol
- **TypeScript/ESM** with full type safety

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
| `full` (default) | 46 | Read, execute, and write -- full control |
| `read-execute` | 45 | Read and execute -- no resource creation/deletion via write tool |
| `read-only` | 31 | Read only -- safe for exploration, no state changes |

**Tier details:**

- **full**: All 46 tools. Includes `komodo_write_resource` for creating, updating, and deleting Komodo resources.
- **read-execute**: 45 tools. All read tools plus execute tools (deploy, lifecycle, run, etc.). The `komodo_write_resource` tool is hidden.
- **read-only**: 31 tools. List, get, logs, inspect, and stats only. All execute and write tools are hidden.

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
| `DEBUG` | No | -- | Set to any value to enable debug logging to stderr |
| `MCP_TRANSPORT` | No | `stdio` | Transport mode: `stdio` (default) or `http` |
| `MCP_PORT` | No | `3000` | HTTP server port (only used when `MCP_TRANSPORT=http`) |
| `MCP_HOST` | No | `0.0.0.0` | HTTP server bind address (only used when `MCP_TRANSPORT=http`) |

Generate API keys in the Komodo UI under **Settings > API Keys**.

### Available Categories

`servers`, `stacks`, `deployments`, `containers`, `builds`, `repos`, `procedures`, `actions`, `builders`, `alerters`, `resource-syncs`, `write`

## Tools

mcp-komodo provides 46 tools organized by category. Each tool's Access column shows the minimum tier required: `read-only` (available in all tiers), `read-execute` (requires `read-execute` or `full`), or `full` (requires `full` tier only).

<details>
<summary>Servers (10 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `komodo_list_servers` | List all servers with status and region | read-only |
| `komodo_get_server` | Get server configuration, status, and action state | read-only |
| `komodo_get_server_stats` | Get CPU, memory, disk usage, and load averages | read-only |
| `komodo_get_server_info` | Get OS details, hardware info, and running processes | read-only |
| `komodo_inspect_docker_container` | Inspect a Docker container (equivalent to docker inspect) | read-only |
| `komodo_inspect_docker_image` | Inspect a Docker image (equivalent to docker image inspect) | read-only |
| `komodo_inspect_docker_network` | Inspect a Docker network (equivalent to docker network inspect) | read-only |
| `komodo_inspect_docker_volume` | Inspect a Docker volume (equivalent to docker volume inspect) | read-only |
| `komodo_prune_docker` | Prune unused Docker resources on a server | read-execute |
| `komodo_delete_docker_resource` | Delete a specific Docker image, volume, or network | read-execute |

</details>

<details>
<summary>Stacks (7 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `komodo_list_stacks` | List all stacks with state, server, and service count | read-only |
| `komodo_get_stack` | Get stack configuration, services, and action state | read-only |
| `komodo_get_stack_log` | Get logs from stack services, with optional search | read-only |
| `komodo_inspect_stack_container` | Inspect a container for a specific service in a stack | read-only |
| `komodo_deploy_stack` | Deploy or redeploy a stack | read-execute |
| `komodo_stack_lifecycle` | Start, stop, restart, pause, or unpause a stack | read-execute |
| `komodo_destroy_stack` | Permanently destroy a stack | read-execute |

</details>

<details>
<summary>Deployments (7 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `komodo_list_deployments` | List all deployments with state, image, and server | read-only |
| `komodo_get_deployment` | Get deployment configuration, container status, and action state | read-only |
| `komodo_get_deployment_log` | Get container logs, with optional search | read-only |
| `komodo_inspect_deployment_container` | Inspect the container for a deployment (equivalent to docker inspect) | read-only |
| `komodo_deploy_deployment` | Deploy with latest image and configuration | read-execute |
| `komodo_deployment_lifecycle` | Start, stop, restart, pause, or unpause a deployment | read-execute |
| `komodo_destroy_deployment` | Permanently destroy a deployment | read-execute |

</details>

<details>
<summary>Containers (1 tool)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `komodo_get_container_log` | Get logs from any Docker container on a server | read-only |

</details>

<details>
<summary>Builds (4 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `komodo_list_builds` | List all build configurations with version info | read-only |
| `komodo_get_build` | Get build configuration, builder, and action state | read-only |
| `komodo_run_build` | Run a build to create a Docker image | read-execute |
| `komodo_cancel_build` | Cancel a running build | read-execute |

</details>

<details>
<summary>Repos (3 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `komodo_list_repos` | List all repos with URL, server, and state | read-only |
| `komodo_get_repo` | Get repo configuration, branch, and action state | read-only |
| `komodo_repo_clone_pull` | Clone or pull a repo on its target server | read-execute |

</details>

<details>
<summary>Procedures (3 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `komodo_list_procedures` | List all procedures with state | read-only |
| `komodo_get_procedure` | Get procedure stages, operations, and action state | read-only |
| `komodo_run_procedure` | Run a procedure (executes all stages) | read-execute |

</details>

<details>
<summary>Actions (3 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `komodo_list_actions` | List all actions with state | read-only |
| `komodo_get_action` | Get action configuration and action state | read-only |
| `komodo_run_action` | Run a custom TypeScript/Deno action | read-execute |

</details>

<details>
<summary>Builders (2 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `komodo_list_builders` | List all builders with type | read-only |
| `komodo_get_builder` | Get builder type, server configuration, and state | read-only |

</details>

<details>
<summary>Alerters (2 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `komodo_list_alerters` | List all alerters with type | read-only |
| `komodo_get_alerter` | Get alerter endpoint type, configuration, and status | read-only |

</details>

<details>
<summary>Resource Syncs (3 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `komodo_list_resource_syncs` | List all resource syncs with state and repo info | read-only |
| `komodo_get_resource_sync` | Get sync configuration, managed resources, and state | read-only |
| `komodo_trigger_sync` | Trigger a GitOps sync from the Git repo | read-execute |

</details>

<details>
<summary>Write (1 tool)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `komodo_write_resource` | Create, update, or delete any Komodo resource | full |

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

- **"Create a new deployment called api-staging with image myapp:latest"** -- calls `komodo_write_resource` to create a new Deployment resource in Komodo.

## Troubleshooting

**Connection refused**
Check that `KOMODO_URL` is correct and that Komodo Core is reachable from where the MCP server is running. The server validates the connection on startup, so if it started successfully, the URL was valid at that time.

**Invalid credentials / 401 Unauthorized**
Verify your API key and secret are correct. Check that the key has not been revoked or expired in the Komodo UI under Settings > API Keys.

**Tools not showing up in your AI tool**
Check your access tier setting. In `read-only` mode, only 31 tools are registered. In `read-execute` mode, 45 tools are registered. Use `full` (or omit `KOMODO_ACCESS_TIER`) for all 46 tools. Check `KOMODO_CATEGORIES` -- only tools in listed categories are registered. Also verify the server started without errors by checking stderr output.

**Node.js version errors**
mcp-komodo requires Node.js >= 18.0.0. Check your version with `node --version`.

**Parse errors or "invalid JSON" in MCP client**
This typically means something is writing to stdout besides the MCP server. Ensure no other tools, shell profiles, or startup scripts print to stdout when launching the server. The MCP protocol uses stdout for JSON-RPC communication. All mcp-komodo logging goes to stderr.

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

MIT
