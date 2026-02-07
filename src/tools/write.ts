/**
 * Polymorphic write tool: create, update, delete for all 10 resource types.
 *
 * Registers 1 MCP tool (komodo_write_resource) that dispatches to the correct
 * Komodo client.write() call based on resource_type and action parameters.
 * This covers all 20 WRITE requirements with a single tool registration.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { createClient } from "../core/client.js";
import type { AppConfig } from "../core/config.js";
import { handleKomodoError } from "../core/errors.js";
import {
  formatResourceCreated,
  formatResourceUpdated,
  formatResourceDeleted,
} from "../core/formatters.js";
import { registerTool } from "../core/tools.js";

type KomodoClient = ReturnType<typeof createClient>;

// ---------------------------------------------------------------------------
// Operation dispatch maps
// ---------------------------------------------------------------------------

const createOps = {
  Stack: "CreateStack",
  Deployment: "CreateDeployment",
  Build: "CreateBuild",
  Repo: "CreateRepo",
  Procedure: "CreateProcedure",
  Action: "CreateAction",
  Alerter: "CreateAlerter",
  Builder: "CreateBuilder",
  ResourceSync: "CreateResourceSync",
} as const;

const updateOps = {
  Stack: "UpdateStack",
  Deployment: "UpdateDeployment",
  Build: "UpdateBuild",
  Repo: "UpdateRepo",
  Procedure: "UpdateProcedure",
  Action: "UpdateAction",
  Alerter: "UpdateAlerter",
  Builder: "UpdateBuilder",
  ResourceSync: "UpdateResourceSync",
} as const;

const deleteOps = {
  Stack: "DeleteStack",
  Deployment: "DeleteDeployment",
  Build: "DeleteBuild",
  Repo: "DeleteRepo",
  Procedure: "DeleteProcedure",
  Action: "DeleteAction",
  Alerter: "DeleteAlerter",
  Builder: "DeleteBuilder",
  ResourceSync: "DeleteResourceSync",
  Variable: "DeleteVariable",
} as const;

// ---------------------------------------------------------------------------
// Resource type enum
// ---------------------------------------------------------------------------

const RESOURCE_TYPES = [
  "Stack",
  "Deployment",
  "Build",
  "Repo",
  "Procedure",
  "Action",
  "Alerter",
  "Builder",
  "ResourceSync",
  "Variable",
] as const;

type ResourceType = (typeof RESOURCE_TYPES)[number];

// ---------------------------------------------------------------------------
// Handler functions
// ---------------------------------------------------------------------------

async function handleCreate(
  client: KomodoClient,
  resourceType: ResourceType,
  name: string | undefined,
  config: Record<string, any> | undefined,
) {
  if (!name) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: 'name' is required when creating a ${resourceType}.`,
        },
      ],
      isError: true as const,
    };
  }

  if (resourceType === "Variable") {
    const result = await client.write("CreateVariable", {
      name,
      value: config?.value,
      description: config?.description,
      is_secret: config?.is_secret,
    } as any);
    return {
      content: [
        {
          type: "text" as const,
          text: formatResourceCreated(resourceType, { ...result, name }),
        },
      ],
    };
  }

  const op = createOps[resourceType as keyof typeof createOps];
  const result = await client.write(op, { name, config } as any);
  return {
    content: [
      {
        type: "text" as const,
        text: formatResourceCreated(resourceType, result),
      },
    ],
  };
}

async function handleUpdate(
  client: KomodoClient,
  resourceType: ResourceType,
  id: string | undefined,
  name: string | undefined,
  config: Record<string, any> | undefined,
) {
  if (!config) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: 'config' is required when updating a ${resourceType}.`,
        },
      ],
      isError: true as const,
    };
  }

  if (resourceType === "Variable") {
    const varName = name || id;
    if (!varName) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: 'name' (or 'id') is required when updating a Variable.",
          },
        ],
        isError: true as const,
      };
    }

    const results: string[] = [];
    if (config.value !== undefined) {
      await client.write("UpdateVariableValue", {
        name: varName,
        value: config.value,
      } as any);
      results.push("value");
    }
    if (config.description !== undefined) {
      await client.write("UpdateVariableDescription", {
        name: varName,
        description: config.description,
      } as any);
      results.push("description");
    }
    if (config.is_secret !== undefined) {
      await client.write("UpdateVariableIsSecret", {
        name: varName,
        is_secret: config.is_secret,
      } as any);
      results.push("is_secret");
    }

    return {
      content: [
        {
          type: "text" as const,
          text: formatResourceUpdated(resourceType, { name: varName }),
        },
      ],
    };
  }

  if (!id) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: 'id' is required when updating a ${resourceType}.`,
        },
      ],
      isError: true as const,
    };
  }

  const op = updateOps[resourceType as keyof typeof updateOps];
  const result = await client.write(op, { id, config } as any);
  return {
    content: [
      {
        type: "text" as const,
        text: formatResourceUpdated(resourceType, result),
      },
    ],
  };
}

async function handleDelete(
  client: KomodoClient,
  resourceType: ResourceType,
  id: string | undefined,
  name: string | undefined,
) {
  if (resourceType === "Variable") {
    const varName = name || id;
    if (!varName) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: 'name' (or 'id') is required when deleting a Variable.",
          },
        ],
        isError: true as const,
      };
    }
    const result = await client.write("DeleteVariable", {
      name: varName,
    } as any);
    return {
      content: [
        {
          type: "text" as const,
          text: formatResourceDeleted(resourceType, { ...result, name: varName }),
        },
      ],
    };
  }

  if (!id) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: 'id' is required when deleting a ${resourceType}.`,
        },
      ],
      isError: true as const,
    };
  }

  const op = deleteOps[resourceType as keyof typeof deleteOps];
  const result = await client.write(op, { id } as any);
  return {
    content: [
      {
        type: "text" as const,
        text: formatResourceDeleted(resourceType, result),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerWriteTools(server: McpServer, client: KomodoClient, config: AppConfig): void {
  registerTool(server, config, {
    name: "komodo_write_resource",
    description:
      "Create, update, or delete any Komodo resource. Supports all 10 resource " +
      "types: Stack, Deployment, Build, Repo, Procedure, Action, Alerter, " +
      "Builder, ResourceSync, Variable.\n\n" +
      "CREATE: Provide resource_type, action='create', name, and optional config.\n" +
      "UPDATE: Provide resource_type, action='update', id (or name for Variable), " +
      "and config with fields to change. Updates use partial merge -- only " +
      "provided config fields are changed, others remain as-is. Use the " +
      "corresponding get tool first to inspect current config before updating.\n" +
      "DELETE: Provide resource_type, action='delete', and id (or name for " +
      "Variable). WARNING: Delete is PERMANENT and cannot be undone.\n\n" +
      "Variable special case: Variables use 'name' (not 'id') as their " +
      "identifier. For Variable create/update, config accepts: value, " +
      "description, is_secret.",
    accessTier: "full",
    category: "write",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
    inputSchema: {
      resource_type: z
        .enum(RESOURCE_TYPES)
        .describe("The type of Komodo resource to operate on"),
      action: z
        .enum(["create", "update", "delete"])
        .describe("The write action to perform"),
      name: z
        .string()
        .optional()
        .describe(
          "Resource name. Required for create. Also used as identifier " +
            "for Variable update/delete (instead of id).",
        ),
      id: z
        .string()
        .optional()
        .describe(
          "Resource ID. Required for update/delete (except Variable, " +
            "which uses name).",
        ),
      config: z
        .record(z.any())
        .optional()
        .describe(
          "JSON configuration object. Required for update, optional for " +
            "create. For Variable: accepts value, description, is_secret.",
        ),
    },
    handler: async (args) => {
      const resource_type = args.resource_type as ResourceType;
      const action = args.action as "create" | "update" | "delete";
      const name = args.name as string | undefined;
      const id = args.id as string | undefined;
      const writeConfig = args.config as Record<string, any> | undefined;
      try {
        switch (action) {
          case "create":
            return await handleCreate(client, resource_type, name, writeConfig);
          case "update":
            return await handleUpdate(client, resource_type, id, name, writeConfig);
          case "delete":
            return await handleDelete(client, resource_type, id, name);
        }
      } catch (error) {
        return handleKomodoError(
          `${action} ${resource_type}${name ? ` '${name}'` : ""}${id ? ` (${id})` : ""}`,
          error,
        );
      }
    },
  });
}
