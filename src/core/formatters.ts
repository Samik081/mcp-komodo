/**
 * Shared response formatting functions for all Komodo resource types.
 *
 * Every formatter converts typed API responses into concise, LLM-friendly
 * plain text. No raw JSON is ever returned. Lists use one line per resource.
 * Details show key fields only, not every config option.
 */

import { Types } from "komodo_client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTags(tags?: string[]): string {
  if (!tags || tags.length === 0) return "";
  return `\nTags: ${tags.join(", ")}`;
}

function formatVersion(v?: Types.Version): string {
  if (!v) return "0.0.0";
  return `${v.major}.${v.minor}.${v.patch}`;
}

function activeActions(state: Record<string, boolean>): string[] {
  return Object.entries(state)
    .filter(([, v]) => v === true)
    .map(([k]) => k.replace(/_/g, " "));
}

function formatActionState(
  actionState?: Record<string, boolean> | object,
): string {
  if (!actionState) return "";
  const running = activeActions(actionState as Record<string, boolean>);
  if (running.length === 0) return "";
  return `\nCurrently: ${running.join(", ")}`;
}

// ---------------------------------------------------------------------------
// Server formatters
// ---------------------------------------------------------------------------

export function formatServerList(servers: Types.ServerListItem[]): string {
  if (servers.length === 0) return "No servers found.";
  const lines = servers.map(
    (s) =>
      `- ${s.name} [${s.info.state}] address=${s.info.address}${s.info.region ? `, region=${s.info.region}` : ""}${s.tags.length ? `, tags=${s.tags.join(",")}` : ""}`,
  );
  return `Found ${servers.length} server(s):\n${lines.join("\n")}`;
}

export function formatServerDetail(
  server: Types.Server,
  actionState?: Types.ServerActionState,
): string {
  const sections: string[] = [
    `Name: ${server.name}`,
    `ID: ${server._id?.$oid ?? "unknown"}`,
    `Description: ${server.description || "(none)"}`,
  ];
  if (server.config) {
    const cfg = server.config;
    sections.push(`Address: ${cfg.address}`);
    if (cfg.region) sections.push(`Region: ${cfg.region}`);
    sections.push(`Enabled: ${cfg.enabled}`);
    sections.push(`Stats monitoring: ${cfg.stats_monitoring}`);
    sections.push(`Auto prune: ${cfg.auto_prune}`);
  }
  sections.push(formatTags(server.tags).trim());
  if (actionState) {
    const stateStr = formatActionState(actionState);
    if (stateStr) sections.push(stateStr.trim());
  }
  return sections.filter(Boolean).join("\n");
}

export function formatSystemStats(stats: Types.SystemStats): string {
  const memPct =
    stats.mem_total_gb > 0
      ? ((stats.mem_used_gb / stats.mem_total_gb) * 100).toFixed(0)
      : "?";
  const lines: string[] = [
    `CPU: ${stats.cpu_perc.toFixed(1)}%`,
    `Memory: ${stats.mem_used_gb.toFixed(1)}/${stats.mem_total_gb.toFixed(1)} GB (${memPct}%)`,
  ];
  if (stats.load_average) {
    lines.push(
      `Load: ${stats.load_average.one.toFixed(2)} / ${stats.load_average.five.toFixed(2)} / ${stats.load_average.fifteen.toFixed(2)}`,
    );
  }
  for (const disk of stats.disks) {
    const pct =
      disk.total_gb > 0
        ? ((disk.used_gb / disk.total_gb) * 100).toFixed(0)
        : "?";
    lines.push(
      `Disk ${disk.mount}: ${disk.used_gb.toFixed(1)}/${disk.total_gb.toFixed(1)} GB (${pct}%)`,
    );
  }
  return lines.join("\n");
}

export function formatSystemInfo(info: Types.SystemInformation): string {
  const lines: string[] = [];
  if (info.host_name) lines.push(`Hostname: ${info.host_name}`);
  if (info.os) lines.push(`OS: ${info.os}`);
  if (info.kernel) lines.push(`Kernel: ${info.kernel}`);
  lines.push(`CPU: ${info.cpu_brand}`);
  if (info.core_count) lines.push(`Cores: ${info.core_count}`);
  return lines.join("\n");
}

export function formatProcessList(processes: Types.SystemProcess[]): string {
  if (processes.length === 0) return "No processes found.";
  const sorted = [...processes]
    .sort((a, b) => b.cpu_perc - a.cpu_perc)
    .slice(0, 15);
  const header = "PID      CPU%    MEM(MB)  NAME";
  const rows = sorted.map(
    (p) =>
      `${String(p.pid).padEnd(9)}${p.cpu_perc.toFixed(1).padStart(5)}    ${p.mem_mb.toFixed(0).padStart(7)}  ${p.name}`,
  );
  return `Top ${sorted.length} processes:\n${header}\n${rows.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Stack formatters
// ---------------------------------------------------------------------------

export function formatStackList(stacks: Types.StackListItem[]): string {
  if (stacks.length === 0) return "No stacks found.";
  const lines = stacks.map(
    (s) =>
      `- ${s.name} [${s.info.state}] server=${s.info.server_id || "unassigned"}, services=${s.info.services?.length ?? 0}${s.tags.length ? `, tags=${s.tags.join(",")}` : ""}`,
  );
  return `Found ${stacks.length} stack(s):\n${lines.join("\n")}`;
}

export function formatStackDetail(
  stack: Types.Stack,
  actionState?: Types.StackActionState,
): string {
  const sections: string[] = [
    `Name: ${stack.name}`,
    `ID: ${stack._id?.$oid ?? "unknown"}`,
    `Description: ${stack.description || "(none)"}`,
  ];
  if (stack.info) {
    const info = stack.info;
    if (info.deployed_project_name)
      sections.push(`Project: ${info.deployed_project_name}`);
    if (info.deployed_hash) sections.push(`Deployed commit: ${info.deployed_hash}`);
    if (info.latest_hash) sections.push(`Latest commit: ${info.latest_hash}`);
  }
  if (stack.config) {
    const cfg = stack.config;
    sections.push(`Server: ${cfg.server_id || "unassigned"}`);
    if (cfg.repo) sections.push(`Repo: ${cfg.git_provider}/${cfg.repo} (branch: ${cfg.branch})`);
    sections.push(`Auto-pull: ${cfg.auto_pull}`);
    sections.push(`Webhook enabled: ${cfg.webhook_enabled}`);
  }
  if (stack.tags?.length) sections.push(`Tags: ${stack.tags.join(", ")}`);
  if (actionState) {
    const stateStr = formatActionState(actionState as unknown as Record<string, boolean>);
    if (stateStr) sections.push(stateStr.trim());
  }
  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// Deployment formatters
// ---------------------------------------------------------------------------

export function formatDeploymentList(
  deployments: Types.DeploymentListItem[],
): string {
  if (deployments.length === 0) return "No deployments found.";
  const lines = deployments.map(
    (d) =>
      `- ${d.name} [${d.info.state}] image=${d.info.image || "(none)"}, server=${d.info.server_id || "unassigned"}${d.tags.length ? `, tags=${d.tags.join(",")}` : ""}`,
  );
  return `Found ${deployments.length} deployment(s):\n${lines.join("\n")}`;
}

export function formatDeploymentDetail(
  deployment: Types.Deployment,
  actionState?: Types.DeploymentActionState,
): string {
  const sections: string[] = [
    `Name: ${deployment.name}`,
    `ID: ${deployment._id?.$oid ?? "unknown"}`,
    `Description: ${deployment.description || "(none)"}`,
  ];
  if (deployment.config) {
    const cfg = deployment.config;
    sections.push(`Server: ${cfg.server_id || "unassigned"}`);
    if (cfg.image) {
      if (cfg.image.type === "Image") {
        sections.push(`Image: ${cfg.image.params.image || "(none)"}`);
      } else if (cfg.image.type === "Build") {
        sections.push(`Build: ${cfg.image.params.build_id || "(none)"}`);
      }
    }
    sections.push(`Network: ${cfg.network}`);
    if (cfg.restart) sections.push(`Restart: ${cfg.restart}`);
    sections.push(`Redeploy on build: ${cfg.redeploy_on_build ?? false}`);
  }
  if (deployment.tags?.length) sections.push(`Tags: ${deployment.tags.join(", ")}`);
  if (actionState) {
    const stateStr = formatActionState(actionState as unknown as Record<string, boolean>);
    if (stateStr) sections.push(stateStr.trim());
  }
  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// Build formatters
// ---------------------------------------------------------------------------

export function formatBuildList(builds: Types.BuildListItem[]): string {
  if (builds.length === 0) return "No builds found.";
  const lines = builds.map(
    (b) =>
      `- ${b.name} [${b.info.state}] v${formatVersion(b.info.version)}${b.info.repo ? `, repo=${b.info.repo}` : ""}${b.tags.length ? `, tags=${b.tags.join(",")}` : ""}`,
  );
  return `Found ${builds.length} build(s):\n${lines.join("\n")}`;
}

export function formatBuildDetail(
  build: Types.Build,
  actionState?: Types.BuildActionState,
): string {
  const sections: string[] = [
    `Name: ${build.name}`,
    `ID: ${build._id?.$oid ?? "unknown"}`,
    `Description: ${build.description || "(none)"}`,
  ];
  if (build.info) {
    const info = build.info;
    if (info.last_built_at) sections.push(`Last built: ${new Date(info.last_built_at).toISOString()}`);
    if (info.built_hash) sections.push(`Built commit: ${info.built_hash}`);
    if (info.latest_hash) sections.push(`Latest commit: ${info.latest_hash}`);
  }
  if (build.config) {
    const cfg = build.config;
    if (cfg.builder_id) sections.push(`Builder: ${cfg.builder_id}`);
    if (cfg.version) sections.push(`Version: ${formatVersion(cfg.version)}`);
    if (cfg.repo) sections.push(`Repo: ${cfg.git_provider}/${cfg.repo} (branch: ${cfg.branch})`);
    sections.push(`Build path: ${cfg.build_path}`);
    sections.push(`Dockerfile: ${cfg.dockerfile_path}`);
  }
  if (build.tags?.length) sections.push(`Tags: ${build.tags.join(", ")}`);
  if (actionState) {
    if (actionState.building) sections.push("Currently: building");
  }
  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// Repo formatters
// ---------------------------------------------------------------------------

export function formatRepoList(repos: Types.RepoListItem[]): string {
  if (repos.length === 0) return "No repos found.";
  const lines = repos.map(
    (r) =>
      `- ${r.name} [${r.info.state}] repo=${r.info.repo || "(none)"}, server=${r.info.server_id || "unassigned"}${r.tags.length ? `, tags=${r.tags.join(",")}` : ""}`,
  );
  return `Found ${repos.length} repo(s):\n${lines.join("\n")}`;
}

export function formatRepoDetail(
  repo: Types.Repo,
  actionState?: Types.RepoActionState,
): string {
  const sections: string[] = [
    `Name: ${repo.name}`,
    `ID: ${repo._id?.$oid ?? "unknown"}`,
    `Description: ${repo.description || "(none)"}`,
  ];
  if (repo.info) {
    const info = repo.info;
    if (info.last_pulled_at) sections.push(`Last pulled: ${new Date(info.last_pulled_at).toISOString()}`);
    if (info.built_hash) sections.push(`Built commit: ${info.built_hash}`);
    if (info.latest_hash) sections.push(`Latest commit: ${info.latest_hash}`);
  }
  if (repo.config) {
    const cfg = repo.config;
    sections.push(`Server: ${cfg.server_id || "unassigned"}`);
    if (cfg.repo) sections.push(`Repo: ${cfg.git_provider}/${cfg.repo} (branch: ${cfg.branch})`);
    if (cfg.on_clone) sections.push(`On clone: ${cfg.on_clone.path || ""} ${cfg.on_clone.command || ""}`.trim());
    if (cfg.on_pull) sections.push(`On pull: ${cfg.on_pull.path || ""} ${cfg.on_pull.command || ""}`.trim());
  }
  if (repo.tags?.length) sections.push(`Tags: ${repo.tags.join(", ")}`);
  if (actionState) {
    const stateStr = formatActionState(actionState as unknown as Record<string, boolean>);
    if (stateStr) sections.push(stateStr.trim());
  }
  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// Procedure formatters
// ---------------------------------------------------------------------------

export function formatProcedureList(
  procedures: Types.ProcedureListItem[],
): string {
  if (procedures.length === 0) return "No procedures found.";
  const lines = procedures.map(
    (p) =>
      `- ${p.name} [${p.info.state}] stages=${p.info.stages}${p.tags.length ? `, tags=${p.tags.join(",")}` : ""}`,
  );
  return `Found ${procedures.length} procedure(s):\n${lines.join("\n")}`;
}

export function formatProcedureDetail(
  procedure: Types.Procedure,
  actionState?: Types.ProcedureActionState,
): string {
  const sections: string[] = [
    `Name: ${procedure.name}`,
    `ID: ${procedure._id?.$oid ?? "unknown"}`,
    `Description: ${procedure.description || "(none)"}`,
  ];
  if (procedure.config) {
    const cfg = procedure.config;
    const stages = cfg.stages ?? [];
    sections.push(`Stages: ${stages.length}`);
    for (const stage of stages) {
      const execCount = stage.executions?.length ?? 0;
      sections.push(`  - ${stage.name}${stage.enabled ? "" : " (disabled)"}: ${execCount} execution(s)`);
    }
    sections.push(`Webhook enabled: ${cfg.webhook_enabled}`);
    if (cfg.schedule) sections.push(`Schedule: ${cfg.schedule}${cfg.schedule_enabled ? "" : " (disabled)"}`);
  }
  if (procedure.tags?.length) sections.push(`Tags: ${procedure.tags.join(", ")}`);
  if (actionState) {
    if (actionState.running) sections.push("Currently: running");
  }
  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// Action formatters
// ---------------------------------------------------------------------------

export function formatActionList(actions: Types.ActionListItem[]): string {
  if (actions.length === 0) return "No actions found.";
  const lines = actions.map(
    (a) =>
      `- ${a.name} [${a.info.state}]${a.info.last_run_at ? `, last_run=${new Date(a.info.last_run_at).toISOString()}` : ""}${a.tags.length ? `, tags=${a.tags.join(",")}` : ""}`,
  );
  return `Found ${actions.length} action(s):\n${lines.join("\n")}`;
}

export function formatActionDetail(
  action: Types.Action,
  actionState?: Types.ActionActionState,
): string {
  const sections: string[] = [
    `Name: ${action.name}`,
    `ID: ${action._id?.$oid ?? "unknown"}`,
    `Description: ${action.description || "(none)"}`,
  ];
  if (action.config) {
    const cfg = action.config;
    sections.push(`Webhook enabled: ${cfg.webhook_enabled}`);
    if (cfg.schedule) sections.push(`Schedule: ${cfg.schedule}${cfg.schedule_enabled ? "" : " (disabled)"}`);
    sections.push(`Run at startup: ${cfg.run_at_startup}`);
  }
  if (action.tags?.length) sections.push(`Tags: ${action.tags.join(", ")}`);
  if (actionState) {
    if (actionState.running > 0) sections.push(`Currently: ${actionState.running} instance(s) running`);
  }
  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// Builder formatters
// ---------------------------------------------------------------------------

export function formatBuilderList(builders: Types.BuilderListItem[]): string {
  if (builders.length === 0) return "No builders found.";
  const lines = builders.map(
    (b) =>
      `- ${b.name} type=${b.info.builder_type}${b.info.instance_type ? `, instance=${b.info.instance_type}` : ""}${b.tags.length ? `, tags=${b.tags.join(",")}` : ""}`,
  );
  return `Found ${builders.length} builder(s):\n${lines.join("\n")}`;
}

export function formatBuilderDetail(
  builder: Types.Builder,
  actionState?: Record<string, boolean>,
): string {
  const sections: string[] = [
    `Name: ${builder.name}`,
    `ID: ${builder._id?.$oid ?? "unknown"}`,
    `Description: ${builder.description || "(none)"}`,
  ];
  if (builder.config) {
    const cfg = builder.config;
    sections.push(`Type: ${cfg.type}`);
    if (cfg.type === "Server") {
      sections.push(`Server: ${cfg.params.server_id}`);
    } else if (cfg.type === "Aws") {
      sections.push(`Instance type: ${cfg.params.instance_type || "unknown"}`);
      sections.push(`Region: ${cfg.params.region || "unknown"}`);
    }
  }
  if (builder.tags?.length) sections.push(`Tags: ${builder.tags.join(", ")}`);
  if (actionState) {
    const stateStr = formatActionState(actionState);
    if (stateStr) sections.push(stateStr.trim());
  }
  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// Alerter formatters
// ---------------------------------------------------------------------------

export function formatAlerterList(alerters: Types.AlerterListItem[]): string {
  if (alerters.length === 0) return "No alerters found.";
  const lines = alerters.map(
    (a) =>
      `- ${a.name} type=${a.info.endpoint_type}, enabled=${a.info.enabled}${a.tags.length ? `, tags=${a.tags.join(",")}` : ""}`,
  );
  return `Found ${alerters.length} alerter(s):\n${lines.join("\n")}`;
}

export function formatAlerterDetail(alerter: Types.Alerter): string {
  const sections: string[] = [
    `Name: ${alerter.name}`,
    `ID: ${alerter._id?.$oid ?? "unknown"}`,
    `Description: ${alerter.description || "(none)"}`,
  ];
  if (alerter.config) {
    const cfg = alerter.config;
    sections.push(`Enabled: ${cfg.enabled ?? false}`);
    if (cfg.endpoint) sections.push(`Endpoint type: ${cfg.endpoint.type}`);
  }
  if (alerter.tags?.length) sections.push(`Tags: ${alerter.tags.join(", ")}`);
  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// ResourceSync formatters
// ---------------------------------------------------------------------------

export function formatResourceSyncList(
  syncs: Types.ResourceSyncListItem[],
): string {
  if (syncs.length === 0) return "No resource syncs found.";
  const lines = syncs.map(
    (s) =>
      `- ${s.name} [${s.info.state}] repo=${s.info.repo || "(none)"}${s.info.managed ? ", managed" : ""}${s.tags.length ? `, tags=${s.tags.join(",")}` : ""}`,
  );
  return `Found ${syncs.length} resource sync(s):\n${lines.join("\n")}`;
}

export function formatResourceSyncDetail(
  sync: Types.ResourceSync,
  actionState?: Types.ResourceSyncActionState,
): string {
  const sections: string[] = [
    `Name: ${sync.name}`,
    `ID: ${sync._id?.$oid ?? "unknown"}`,
    `Description: ${sync.description || "(none)"}`,
  ];
  if (sync.info) {
    const info = sync.info;
    if (info.last_sync_ts) sections.push(`Last synced: ${new Date(info.last_sync_ts).toISOString()}`);
    if (info.last_sync_hash) sections.push(`Last sync commit: ${info.last_sync_hash}`);
    if (info.pending_error) sections.push(`Pending error: ${info.pending_error}`);
    const updates = info.resource_updates?.length ?? 0;
    if (updates > 0) sections.push(`Pending resource updates: ${updates}`);
  }
  if (sync.config) {
    const cfg = sync.config;
    if (cfg.repo) sections.push(`Repo: ${cfg.git_provider}/${cfg.repo} (branch: ${cfg.branch})`);
    const paths = cfg.resource_path ?? [];
    if (paths.length > 0) sections.push(`Resource paths: ${paths.join(", ")}`);
  }
  if (sync.tags?.length) sections.push(`Tags: ${sync.tags.join(", ")}`);
  if (actionState) {
    if (actionState.syncing) sections.push("Currently: syncing");
  }
  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// Stack service formatter
// ---------------------------------------------------------------------------

export function formatStackServiceList(
  services: Types.StackService[],
): string {
  if (services.length === 0) return "No services found in this stack.";
  const lines = services.map((s) => {
    const parts = [`- ${s.service}`];
    if (s.image) parts.push(`image=${s.image}`);
    if (s.container) {
      parts.push(`state=${s.container.state}`);
      if (s.container.status) parts.push(`status=${s.container.status}`);
    } else {
      parts.push("state=not running");
    }
    if (s.update_available) parts.push("(update available)");
    return parts.join(" ");
  });
  return `Found ${services.length} service(s):\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Summary formatters
// ---------------------------------------------------------------------------

export function formatStacksSummary(
  summary: Types.GetStacksSummaryResponse,
): string {
  const lines: string[] = [
    `Stacks summary:`,
    `  Total: ${summary.total}`,
    `  Running: ${summary.running}`,
    `  Stopped: ${summary.stopped}`,
    `  Down: ${summary.down}`,
    `  Unhealthy: ${summary.unhealthy}`,
    `  Unknown: ${summary.unknown}`,
  ];
  return lines.join("\n");
}

export function formatDeploymentsSummary(
  summary: Types.GetDeploymentsSummaryResponse,
): string {
  const lines: string[] = [
    `Deployments summary:`,
    `  Total: ${summary.total}`,
    `  Running: ${summary.running}`,
    `  Stopped: ${summary.stopped}`,
    `  Not deployed: ${summary.not_deployed}`,
    `  Unhealthy: ${summary.unhealthy}`,
    `  Unknown: ${summary.unknown}`,
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Update formatters
// ---------------------------------------------------------------------------

export function formatUpdateList(
  updates: Types.UpdateListItem[],
  nextPage?: number,
): string {
  if (updates.length === 0) return "No updates found.";
  const lines = updates.map((u) => {
    const time = new Date(u.start_ts).toISOString();
    const status = u.status ?? "Unknown";
    const result = status === "Complete" ? (u.success ? "OK" : "FAILED") : status;
    return `- [${result}] ${u.operation} → ${u.target.type}/${u.target.id} (${time}, by ${u.username || u.operator}) id=${u.id}`;
  });
  let text = `Found ${updates.length} update(s):\n${lines.join("\n")}`;
  if (nextPage !== undefined) {
    text += `\n\nMore results available. Use page=${nextPage} to fetch the next page.`;
  }
  return text;
}

export function formatUpdateDetail(update: Types.Update): string {
  const sections: string[] = [
    `Operation: ${update.operation}`,
    `Target: ${update.target.type}/${update.target.id}`,
    `Status: ${update.status}`,
    `Success: ${update.success}`,
    `Operator: ${update.operator}`,
    `Started: ${new Date(update.start_ts).toISOString()}`,
  ];
  if (update.end_ts) sections.push(`Ended: ${new Date(update.end_ts).toISOString()}`);
  if (update.version) sections.push(`Version: ${formatVersion(update.version)}`);
  if (update.commit_hash) sections.push(`Commit: ${update.commit_hash}`);

  if (update.logs && update.logs.length > 0) {
    sections.push(`\nLogs (${update.logs.length} stage(s)):`);
    for (const log of update.logs) {
      sections.push(`\n--- [${log.success ? "OK" : "FAILED"}] ${log.stage} ---`);
      if (log.command) sections.push(`Command: ${log.command}`);
      if (log.stdout) sections.push(`stdout:\n${log.stdout}`);
      if (log.stderr) sections.push(`stderr:\n${log.stderr}`);
    }
  }
  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// Log formatter
// ---------------------------------------------------------------------------

export function formatLog(log: Types.Log): string {
  const output = log.stdout || log.stderr || "(no output)";
  const header = `[${log.success ? "OK" : "FAILED"}] ${log.stage}`;
  return `${header}\n${output}`;
}

// ---------------------------------------------------------------------------
// Write formatters
// ---------------------------------------------------------------------------

export function formatResourceCreated(
  resourceType: string,
  resource: any,
): string {
  const id = resource._id?.$oid;
  const lines: string[] = [];
  if (resourceType === "Variable") {
    lines.push(`Created ${resourceType} '${resource.name}'`);
  } else if (id) {
    lines.push(`Created ${resourceType} '${resource.name}' (ID: ${id})`);
  } else {
    lines.push(`Created ${resourceType} '${resource.name}'`);
  }
  if (resource.description) {
    lines.push(`Description: ${resource.description}`);
  }
  lines.push(
    `Use the corresponding get tool to view full details.`,
  );
  return lines.join("\n");
}

export function formatResourceUpdated(
  resourceType: string,
  resource: any,
): string {
  const lines: string[] = [
    `Updated ${resourceType} '${resource.name}'`,
    `Use the corresponding get tool to verify changes.`,
  ];
  return lines.join("\n");
}

export function formatResourceDeleted(
  resourceType: string,
  resource: any,
): string {
  return `Deleted ${resourceType} '${resource.name}'`;
}

// ---------------------------------------------------------------------------
// Update formatter
// ---------------------------------------------------------------------------

export function formatUpdateCreated(
  update: Types.Update,
  description: string,
): string {
  const updateId = update._id?.$oid ?? "unknown";
  const status = update.status ?? "Queued";
  const lines: string[] = [
    `\u2713 ${description}`,
    `Update ID: ${updateId}`,
    `Status: ${status}`,
  ];
  if (status === "Complete") {
    lines.push(`Result: ${update.success ? "Success" : "Failed"}`);
    if (update.logs && update.logs.length > 0) {
      const lastLog = update.logs[update.logs.length - 1];
      if (lastLog.stderr) {
        lines.push(`Error: ${lastLog.stderr.split("\n")[0]}`);
      }
    }
  } else {
    const verb = status === "Queued" ? "queued" : "in progress";
    lines.push(
      `\nThe operation is ${verb}. Use komodo_get_update (Update ID: ${updateId}) ` +
        `to check status and view logs.`,
    );
  }
  return lines.join("\n");
}
