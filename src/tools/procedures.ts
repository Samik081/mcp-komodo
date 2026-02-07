/**
 * Procedure domain tools: list, get detail, run.
 *
 * Registers 3 MCP tools for Komodo Procedure resources.
 * A Procedure is an orchestrated sequence of parallel stages that run
 * other Komodo operations (deploy, build, pull, etc.).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { createClient } from "../core/client.js";
import type { AppConfig } from "../core/config.js";
import { handleKomodoError } from "../core/errors.js";
import {
  formatProcedureList,
  formatProcedureDetail,
  formatUpdateCreated,
} from "../core/formatters.js";
import { registerTool } from "../core/tools.js";

type KomodoClient = ReturnType<typeof createClient>;

export function registerProcedureTools(server: McpServer, client: KomodoClient, config: AppConfig): void {
  // -------------------------------------------------------------------------
  // komodo_list_procedures
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_list_procedures",
    description:
      "List all Komodo Procedures. A Procedure is an orchestrated " +
      "sequence of parallel stages that run other Komodo operations " +
      "(deploy, build, pull, etc.). Returns name and state for each " +
      "procedure.",
    accessTier: "read-only",
    category: "procedures",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      tag: z
        .string()
        .optional()
        .describe("Filter procedures by tag name"),
    },
    handler: async (args) => {
      const tag = args.tag as string | undefined;
      try {
        const procedures = await client.read("ListProcedures", {
          query: tag ? { tags: [tag] } : undefined,
        });
        return {
          content: [
            { type: "text" as const, text: formatProcedureList(procedures) },
          ],
        };
      } catch (error) {
        return handleKomodoError("listing procedures", error);
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_get_procedure
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_get_procedure",
    description:
      "Get detailed information about a specific Komodo Procedure by " +
      "name or ID. A Procedure is an orchestrated sequence of stages. " +
      "Returns stages with their operations and current action state.",
    accessTier: "read-only",
    category: "procedures",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      procedure: z.string().describe("Procedure name or ID"),
    },
    handler: async (args) => {
      const procedure = args.procedure as string;
      try {
        const [procedureData, actionState] = await Promise.all([
          client.read("GetProcedure", { procedure }),
          client.read("GetProcedureActionState", { procedure }),
        ]);
        return {
          content: [
            {
              type: "text" as const,
              text: formatProcedureDetail(procedureData, actionState),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(
          `getting procedure '${procedure}'`,
          error,
        );
      }
    },
  });

  // -------------------------------------------------------------------------
  // komodo_run_procedure
  // -------------------------------------------------------------------------
  registerTool(server, config, {
    name: "komodo_run_procedure",
    description:
      "\u26a0\ufe0f RUN a Komodo Procedure. This executes all stages in sequence, " +
      "where each stage can run multiple operations in parallel. A " +
      "Procedure may deploy stacks, run builds, pull repos, and perform " +
      "other Komodo operations. Procedures can take several minutes " +
      "depending on their stages. A Procedure is an orchestrated sequence " +
      "of parallel stages.",
    accessTier: "read-execute",
    category: "procedures",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
    inputSchema: {
      procedure: z.string().describe("Procedure name or ID"),
    },
    handler: async (args) => {
      const procedure = args.procedure as string;
      try {
        const update = await client.execute("RunProcedure", { procedure });
        return {
          content: [
            {
              type: "text" as const,
              text: formatUpdateCreated(
                update,
                `Running procedure '${procedure}'`,
              ),
            },
          ],
        };
      } catch (error) {
        return handleKomodoError(
          `running procedure '${procedure}'`,
          error,
        );
      }
    },
  });
}
