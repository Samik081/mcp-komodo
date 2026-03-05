/**
 * Cherry-picked Komodo API types.
 *
 * These interfaces describe the JSON shapes returned by the Komodo Core
 * REST API. They are structural type definitions for interoperability —
 * only the subset actually consumed by this MCP server is included.
 *
 * Source reference: komodo_client v1.19.5 types.d.ts (auto-generated
 * from the Rust backend via typeshare).
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export interface MongoId {
  $oid: string;
}

export interface Version {
  major: number;
  minor: number;
  patch: number;
}

export interface ResourceTarget {
  type: string;
  id: string;
}

export enum SearchCombinator {
  Or = "Or",
  And = "And",
}

// ---------------------------------------------------------------------------
// Base resource types
// ---------------------------------------------------------------------------

export interface Resource<Config, Info> {
  _id?: MongoId;
  name: string;
  description?: string;
  tags?: string[];
  config?: Config;
  info?: Info;
}

export interface ResourceListItem<Info> {
  id: string;
  type: string;
  name: string;
  tags: string[];
  info: Info;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export interface ServerConfig {
  address: string;
  region?: string;
  enabled: boolean;
  stats_monitoring: boolean;
  auto_prune: boolean;
}

export interface ServerActionState {
  pruning_networks: boolean;
  pruning_containers: boolean;
  pruning_images: boolean;
  pruning_volumes: boolean;
  pruning_builders: boolean;
  pruning_buildx: boolean;
  pruning_system: boolean;
  starting_containers: boolean;
  restarting_containers: boolean;
  pausing_containers: boolean;
  unpausing_containers: boolean;
  stopping_containers: boolean;
}

export interface ServerListItemInfo {
  state: string;
  region: string;
  address: string;
}

export type Server = Resource<ServerConfig, undefined>;
export type ServerListItem = ResourceListItem<ServerListItemInfo>;

// ---------------------------------------------------------------------------
// System stats
// ---------------------------------------------------------------------------

export interface SystemLoadAverage {
  one: number;
  five: number;
  fifteen: number;
}

export interface SingleDiskUsage {
  mount: string;
  used_gb: number;
  total_gb: number;
}

export interface SystemStats {
  cpu_perc: number;
  load_average?: SystemLoadAverage;
  mem_used_gb: number;
  mem_total_gb: number;
  disks: SingleDiskUsage[];
}

export interface SystemInformation {
  name?: string;
  os?: string;
  kernel?: string;
  core_count?: number;
  host_name?: string;
  cpu_brand: string;
}

export interface SystemProcess {
  pid: number;
  name: string;
  cpu_perc: number;
  mem_mb: number;
}

// ---------------------------------------------------------------------------
// Stack
// ---------------------------------------------------------------------------

export interface StackConfig {
  server_id?: string;
  repo?: string;
  git_provider: string;
  branch: string;
  auto_pull: boolean;
  webhook_enabled: boolean;
}

export interface StackInfo {
  deployed_project_name?: string;
  deployed_hash?: string;
  latest_hash?: string;
}

export interface StackActionState {
  pulling: boolean;
  deploying: boolean;
  starting: boolean;
  restarting: boolean;
  pausing: boolean;
  unpausing: boolean;
  stopping: boolean;
  destroying: boolean;
}

export interface ContainerListItem {
  name: string;
  state: string;
  status?: string;
}

export interface StackService {
  service: string;
  image: string;
  container?: ContainerListItem;
  update_available: boolean;
}

export interface StackListItemInfo {
  server_id: string;
  state: string;
  services?: { service: string; image: string; update_available: boolean }[];
}

export type Stack = Resource<StackConfig, StackInfo>;
export type StackListItem = ResourceListItem<StackListItemInfo>;

export interface GetStacksSummaryResponse {
  total: number;
  running: number;
  stopped: number;
  down: number;
  unhealthy: number;
  unknown: number;
}

// ---------------------------------------------------------------------------
// Deployment
// ---------------------------------------------------------------------------

export interface DeploymentImage {
  type: string;
  params: Record<string, string>;
}

export interface DeploymentConfig {
  server_id?: string;
  image?: DeploymentImage;
  network: string;
  restart?: string;
  redeploy_on_build?: boolean;
}

export interface DeploymentActionState {
  pulling: boolean;
  deploying: boolean;
  starting: boolean;
  restarting: boolean;
  pausing: boolean;
  unpausing: boolean;
  stopping: boolean;
  destroying: boolean;
  renaming: boolean;
}

export interface DeploymentListItemInfo {
  state: string;
  image: string;
  server_id: string;
}

export type Deployment = Resource<DeploymentConfig, undefined>;
export type DeploymentListItem = ResourceListItem<DeploymentListItemInfo>;

export interface GetDeploymentsSummaryResponse {
  total: number;
  running: number;
  stopped: number;
  not_deployed: number;
  unhealthy: number;
  unknown: number;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export interface BuildConfig {
  builder_id?: string;
  version?: Version;
  repo?: string;
  git_provider: string;
  branch: string;
  build_path: string;
  dockerfile_path: string;
}

export interface BuildInfo {
  last_built_at: number;
  built_hash?: string;
  latest_hash?: string;
}

export interface BuildActionState {
  building: boolean;
}

export interface BuildListItemInfo {
  state: string;
  version: Version;
  repo?: string;
}

export type Build = Resource<BuildConfig, BuildInfo>;
export type BuildListItem = ResourceListItem<BuildListItemInfo>;

// ---------------------------------------------------------------------------
// Repo
// ---------------------------------------------------------------------------

export interface SystemCommand {
  path?: string;
  command?: string;
}

export interface RepoConfig {
  server_id?: string;
  repo?: string;
  git_provider: string;
  branch: string;
  on_clone?: SystemCommand;
  on_pull?: SystemCommand;
}

export interface RepoInfo {
  last_pulled_at?: number;
  built_hash?: string;
  latest_hash?: string;
}

export interface RepoActionState {
  cloning: boolean;
  pulling: boolean;
  building: boolean;
  renaming: boolean;
}

export interface RepoListItemInfo {
  state: string;
  repo: string;
  server_id: string;
}

export type Repo = Resource<RepoConfig, RepoInfo>;
export type RepoListItem = ResourceListItem<RepoListItemInfo>;

// ---------------------------------------------------------------------------
// Procedure
// ---------------------------------------------------------------------------

export interface ProcedureStage {
  name: string;
  enabled: boolean;
  executions?: unknown[];
}

export interface ProcedureConfig {
  stages?: ProcedureStage[];
  webhook_enabled: boolean;
  schedule?: string;
  schedule_enabled: boolean;
}

export interface ProcedureActionState {
  running: boolean;
}

export interface ProcedureListItemInfo {
  stages: number;
  state: string;
}

export type Procedure = Resource<ProcedureConfig, undefined>;
export type ProcedureListItem = ResourceListItem<ProcedureListItemInfo>;

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export interface ActionConfig {
  webhook_enabled: boolean;
  schedule?: string;
  schedule_enabled: boolean;
  run_at_startup: boolean;
}

export interface ActionActionState {
  running: number;
}

export interface ActionListItemInfo {
  state: string;
  last_run_at?: number;
}

export type Action = Resource<ActionConfig, undefined>;
export type ActionListItem = ResourceListItem<ActionListItemInfo>;

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export interface BuilderConfig {
  type: string;
  params: Record<string, string>;
}

export interface BuilderListItemInfo {
  builder_type: string;
  instance_type?: string;
}

export type Builder = Resource<BuilderConfig, undefined>;
export type BuilderListItem = ResourceListItem<BuilderListItemInfo>;

// ---------------------------------------------------------------------------
// Alerter
// ---------------------------------------------------------------------------

export interface AlerterEndpoint {
  type: string;
}

export interface AlerterConfig {
  enabled?: boolean;
  endpoint?: AlerterEndpoint;
}

export interface AlerterListItemInfo {
  enabled: boolean;
  endpoint_type: string;
}

export type Alerter = Resource<AlerterConfig, undefined>;
export type AlerterListItem = ResourceListItem<AlerterListItemInfo>;

// ---------------------------------------------------------------------------
// ResourceSync
// ---------------------------------------------------------------------------

export interface ResourceSyncConfig {
  git_provider: string;
  repo?: string;
  branch: string;
  resource_path?: string[];
}

export interface ResourceSyncInfo {
  last_sync_ts?: number;
  last_sync_hash?: string;
  pending_error?: string;
  resource_updates?: unknown[];
}

export interface ResourceSyncActionState {
  syncing: boolean;
}

export interface ResourceSyncListItemInfo {
  state: string;
  repo: string;
  managed: boolean;
}

export type ResourceSync = Resource<ResourceSyncConfig, ResourceSyncInfo>;
export type ResourceSyncListItem = ResourceListItem<ResourceSyncListItemInfo>;

// ---------------------------------------------------------------------------
// Update / Log
// ---------------------------------------------------------------------------

export interface Log {
  stage: string;
  command: string;
  stdout: string;
  stderr: string;
  success: boolean;
  start_ts: number;
  end_ts: number;
}

export interface Update {
  _id?: MongoId;
  operation: string;
  start_ts: number;
  success: boolean;
  operator: string;
  target: ResourceTarget;
  logs: Log[];
  end_ts?: number;
  status: string;
  version?: Version;
  commit_hash?: string;
}

export interface UpdateListItem {
  id: string;
  operation: string;
  start_ts: number;
  success: boolean;
  username: string;
  operator: string;
  target: ResourceTarget;
  status: string;
  version?: Version;
}
