/**
 * User & permission management tools: users, service-user API keys,
 * and per-user permissions. All operations are Komodo admin-only.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KomodoClient } from "../core/client.js";
import type { AppConfig } from "../core/config.js";
import { handleKomodoError } from "../core/errors.js";
import {
  formatApiKeyList,
  formatPermissionList,
  formatUserList,
} from "../core/formatters.js";
import { registerTool } from "../core/tools.js";
import type { User } from "../types/komodo.js";

export function registerUserTools(
  server: McpServer,
  client: KomodoClient,
  config: AppConfig,
): void {
  // -------------------------------------------------------------------------
  // komodo_list_users
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_list_users",
    title: "List Users",
    description:
      "List Komodo users, optionally filtering service users (admin only)",
    accessTier: "read-only",
    category: "users",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      service_users: z
        .enum(["Include", "Exclude", "Only"])
        .optional()
        .describe("How to treat service users (default: Include)"),
    },
    handler: async (args) => {
      try {
        const users = await client.read("ListUsers", {
          service_users:
            (args.service_users as string | undefined) ?? "Include",
        });
        return {
          content: [{ type: "text" as const, text: formatUserList(users) }],
        };
      } catch (error) {
        return handleKomodoError("listing users", error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_list_api_keys_for_service_user
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_list_api_keys_for_service_user",
    title: "List Service User API Keys",
    description:
      "List the API keys of a service user (admin only). Secrets are never returned",
    accessTier: "read-only",
    category: "users",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      user_id: z.string().describe("Service user ID"),
    },
    handler: async (args) => {
      const userId = args.user_id as string;
      try {
        // The read API field is `user` (it accepts the user ID), unlike the
        // CreateApiKeyForServiceUser write op which uses `user_id`.
        const keys = await client.read("ListApiKeysForServiceUser", {
          user: userId,
        });
        return {
          content: [{ type: "text" as const, text: formatApiKeyList(keys) }],
        };
      } catch (error) {
        return handleKomodoError(
          `listing API keys for user '${userId}'`,
          error,
        );
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_list_permissions
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_list_permissions",
    title: "List User Permissions",
    description:
      "List the permissions granted to a user or user group (admin only)",
    accessTier: "read-only",
    category: "users",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      user_target_type: z
        .enum(["User", "UserGroup"])
        .describe("Whether the target is a user or a user group"),
      user_target_id: z.string().describe("User or user group ID"),
    },
    handler: async (args) => {
      const targetId = args.user_target_id as string;
      try {
        const perms = await client.read("ListUserTargetPermissions", {
          user_target: { type: args.user_target_type, id: targetId },
        });
        return {
          content: [
            { type: "text" as const, text: formatPermissionList(perms) },
          ],
        };
      } catch (error) {
        return handleKomodoError(
          `listing permissions for '${targetId}'`,
          error,
        );
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_create_service_user
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_create_service_user",
    title: "Create Service User",
    description:
      "Create a Komodo service user for automation (admin only). Follow up with komodo_create_api_key_for_service_user and permission tools",
    accessTier: "full",
    category: "users",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    inputSchema: {
      username: z.string().describe("Username for the new service user"),
      description: z
        .string()
        .optional()
        .describe("Description of what this service user is for"),
    },
    handler: async (args) => {
      const username = args.username as string;
      try {
        const user = (await client.write("CreateServiceUser", {
          username,
          description: (args.description as string | undefined) ?? "",
        })) as User;
        return {
          content: [
            {
              type: "text" as const,
              text: `Service user '${user.username}' created [id: ${user._id?.$oid ?? "unknown"}].`,
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(`creating service user '${username}'`, error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_delete_user
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_delete_user",
    title: "Delete User",
    description:
      "Delete a Komodo user by ID or username (admin only). THIS CANNOT BE UNDONE",
    accessTier: "full",
    category: "users",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
    inputSchema: {
      user: z.string().describe("User ID or username to delete"),
    },
    handler: async (args) => {
      const user = args.user as string;
      try {
        await client.write("DeleteUser", { user });
        return {
          content: [{ type: "text" as const, text: `User '${user}' deleted.` }],
        };
      } catch (error) {
        return handleKomodoError(`deleting user '${user}'`, error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_create_api_key_for_service_user
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_create_api_key_for_service_user",
    title: "Create Service User API Key",
    description:
      "Create an API key for a service user (admin only). The secret is returned ONCE and cannot be retrieved again",
    accessTier: "full",
    category: "users",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    inputSchema: {
      user_id: z.string().describe("Service user ID"),
      name: z.string().describe("Name for the API key"),
      expires: z
        .number()
        .optional()
        .describe("Expiry timestamp in ms (0 or omitted = never)"),
    },
    handler: async (args) => {
      const userId = args.user_id as string;
      const name = args.name as string;
      try {
        const res = (await client.write("CreateApiKeyForServiceUser", {
          user_id: userId,
          name,
          expires: (args.expires as number | undefined) ?? 0,
        })) as { key?: string; secret?: string };
        if (!res?.key || !res?.secret) {
          return {
            content: [
              {
                type: "text" as const,
                text: `API key creation returned an unexpected response (no secret). Raw response: ${JSON.stringify(res)}`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: [
                `API key '${name}' created for user ${userId}.`,
                `Key: ${res.key}`,
                `Secret (store it now — it cannot be retrieved again): ${res.secret}`,
              ].join("\n"),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(
          `creating API key for user '${userId}'`,
          error,
        );
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_delete_api_key_for_service_user
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_delete_api_key_for_service_user",
    title: "Delete Service User API Key",
    description: "Delete a service user's API key by key ID (admin only)",
    accessTier: "full",
    category: "users",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
    inputSchema: {
      key: z.string().describe("The API key (public part) to delete"),
    },
    handler: async (args) => {
      const key = args.key as string;
      try {
        await client.write("DeleteApiKeyForServiceUser", { key });
        return {
          content: [
            { type: "text" as const, text: `API key '${key}' deleted.` },
          ],
        };
      } catch (error) {
        return handleKomodoError(`deleting API key '${key}'`, error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_update_user_base_permissions
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_update_user_base_permissions",
    title: "Update User Base Permissions",
    description:
      "Update a user's base flags: enabled, create servers, create builds (admin only)",
    accessTier: "full",
    category: "users",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
    inputSchema: {
      user_id: z.string().describe("User ID"),
      enabled: z.boolean().optional().describe("Enable/disable the user"),
      create_servers: z
        .boolean()
        .optional()
        .describe("Allow the user to create servers"),
      create_builds: z
        .boolean()
        .optional()
        .describe("Allow the user to create builds"),
    },
    handler: async (args) => {
      const userId = args.user_id as string;
      try {
        const params: Record<string, unknown> = { user_id: userId };
        if (args.enabled !== undefined) params.enabled = args.enabled;
        if (args.create_servers !== undefined)
          params.create_servers = args.create_servers;
        if (args.create_builds !== undefined)
          params.create_builds = args.create_builds;
        await client.write("UpdateUserBasePermissions", params);
        return {
          content: [
            {
              type: "text" as const,
              text: `Base permissions updated for user '${userId}'.`,
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(
          `updating base permissions for user '${userId}'`,
          error,
        );
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_update_permission_on_resource_type
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_update_permission_on_resource_type",
    title: "Update Permission On Resource Type",
    description:
      "Set a user or user group's base permission level on ALL resources of a type (admin only)",
    accessTier: "full",
    category: "users",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
    inputSchema: {
      user_target_type: z
        .enum(["User", "UserGroup"])
        .describe("Whether the target is a user or a user group"),
      user_target_id: z.string().describe("User or user group ID"),
      resource_type: z
        .enum([
          "Server",
          "Stack",
          "Deployment",
          "Build",
          "Repo",
          "Procedure",
          "Action",
          "Builder",
          "Alerter",
          "ResourceSync",
        ])
        .describe("Resource type the permission applies to"),
      permission: z
        .enum(["None", "Read", "Execute", "Write"])
        .describe("Permission level"),
    },
    handler: async (args) => {
      const targetId = args.user_target_id as string;
      try {
        await client.write("UpdatePermissionOnResourceType", {
          user_target: { type: args.user_target_type, id: targetId },
          resource_type: args.resource_type,
          permission: args.permission,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: `Permission on resource type '${args.resource_type}' set to '${args.permission}' for '${targetId}'.`,
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(
          `updating resource type permission for '${targetId}'`,
          error,
        );
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_update_permission_on_target
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_update_permission_on_target",
    title: "Update Permission On Target",
    description:
      "Set a user or user group's permission level on ONE specific resource (admin only)",
    accessTier: "full",
    category: "users",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
    inputSchema: {
      user_target_type: z
        .enum(["User", "UserGroup"])
        .describe("Whether the target is a user or a user group"),
      user_target_id: z.string().describe("User or user group ID"),
      resource_target_type: z
        .enum([
          "Server",
          "Stack",
          "Deployment",
          "Build",
          "Repo",
          "Procedure",
          "Action",
          "Builder",
          "Alerter",
          "ResourceSync",
        ])
        .describe("Type of the resource"),
      resource_target_id: z.string().describe("Resource ID"),
      permission: z
        .enum(["None", "Read", "Execute", "Write"])
        .describe("Permission level"),
      specific_permissions: z
        .array(z.string())
        .optional()
        .describe(
          "Optional specific permissions (e.g. Terminal, Inspect, Logs, Attach, Processes)",
        ),
    },
    handler: async (args) => {
      const targetId = args.user_target_id as string;
      try {
        const specifics = args.specific_permissions as string[] | undefined;
        const permission = specifics?.length
          ? { level: args.permission, specific: specifics }
          : args.permission;
        await client.write("UpdatePermissionOnTarget", {
          user_target: { type: args.user_target_type, id: targetId },
          resource_target: {
            type: args.resource_target_type,
            id: args.resource_target_id,
          },
          permission,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: `Permission on ${args.resource_target_type}/${args.resource_target_id} set to '${args.permission}' for '${targetId}'.`,
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(
          `updating permission for '${targetId}'`,
          error,
        );
      }
    },
  });
}
