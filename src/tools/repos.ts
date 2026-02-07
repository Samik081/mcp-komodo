/**
 * Repo domain tools: list, get detail, clone/pull.
 *
 * Registers 3 MCP tools for Komodo Repo resources.
 * A Repo is a Git repository cloned to a server, optionally built
 * using a Builder.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { createClient } from "../core/client.js";
import type { AppConfig } from "../core/config.js";
import { handleKomodoError } from "../core/errors.js";
import {
  formatRepoList,
  formatRepoDetail,
  formatUpdateCreated,
} from "../core/formatters.js";
import { registerTool } from "../core/tools.js";

type KomodoClient = ReturnType<typeof createClient>;

export function registerRepoTools(server: McpServer, client: KomodoClient, config: AppConfig): void {
  // -------------------------------------------------------------------------
  // komodo_list_repos
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_list_repos",
    description:
      "List all Komodo Repos. A Repo is a Git repository cloned to a " +
      "server, optionally built using a Builder. Returns name, repo URL, " +
      "server, and state for each repo.",
    accessTier: "read-only",
    category: "repos",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      tag: z.string().optional().describe("Filter repos by tag name"),
    },
    handler: async (args) => {
      const tag = args.tag as string | undefined;
      try {
        const repos = await client.read("ListRepos", {
          query: tag ? { tags: [tag] } : undefined,
        });
        return {
          content: [{ type: "text" as const, text: formatRepoList(repos) }],
        };
      } catch (error) {
        return handleKomodoError("listing repos", error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_get_repo
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_get_repo",
    description:
      "Get detailed information about a specific Komodo Repo by name " +
      "or ID. A Repo is a Git repository cloned to a server. Returns " +
      "clone URL, branch, server, on_clone/on_pull commands, and " +
      "current action state.",
    accessTier: "read-only",
    category: "repos",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      repo: z.string().describe("Repo name or ID"),
    },
    handler: async (args) => {
      const repo = args.repo as string;
      try {
        const [repoData, actionState] = await Promise.all([
          client.read("GetRepo", { repo }),
          client.read("GetRepoActionState", { repo }),
        ]);
        return {
          content: [
            {
              type: "text" as const,
              text: formatRepoDetail(repoData, actionState),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(`getting repo '${repo}'`, error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_repo_clone_pull
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_repo_clone_pull",
    description:
      "\u26a0\ufe0f CLONE or PULL a Komodo Repo on its target server. 'clone' " +
      "performs initial git clone (or pulls if already cloned). 'pull' " +
      "performs git pull to get latest changes. Both may trigger " +
      "on_clone/on_pull commands configured on the repo. A Repo is a " +
      "Git repository cloned to a server.",
    accessTier: "read-execute",
    category: "repos",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
    inputSchema: {
      repo: z.string().describe("Repo name or ID"),
      action: z
        .enum(["clone", "pull"])
        .describe("Whether to clone or pull the repo"),
    },
    handler: async (args) => {
      const repo = args.repo as string;
      const action = args.action as "clone" | "pull";
      try {
        const operationMap = {
          clone: "CloneRepo",
          pull: "PullRepo",
        } as const;
        const update = await client.execute(operationMap[action], { repo });
        return {
          content: [
            {
              type: "text" as const,
              text: formatUpdateCreated(
                update,
                `${action} repo '${repo}'`,
              ),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(`${action} repo '${repo}'`, error);
      }
    },
  });
}
