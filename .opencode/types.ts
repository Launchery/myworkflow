// Workflow State Types

export interface WorkflowState {
  version: string;
  active_feature: string | null;
  features: Record<string, FeatureRun>;
}

export interface FeatureRun {
  feature_id: string;
  title: string;
  created_at: string;
  status: "in_progress" | "completed" | "failed" | "cancelled";
  current_stage: StageId;
  stages: Partial<Record<StageId, StageExecution>>;
}

export type StageId =
  | "discover"
  | "spike"
  | "arch"
  | "spec"
  | "plan"
  | "tasks"
  | "tooling"
  | "dispatch"
  | "implement"
  | "review"
  | "finish-branch"
  | "project-report"
  | "human-qa"
  | "debug"
  | "finish-report";

export function isStageId(value: string): value is StageId {
  return STAGE_ORDER.includes(value as StageId);
}

export interface StageExecution {
  stage_id: StageId;
  command: string;
  started_at: string;
  finished_at: string | null;
  result: "completed" | "failed" | "in_progress" | "skipped";
  diagnostics_path: string | null;
  artifacts: ArtifactRecord[];
  gates: GateResult[];
  approval: ApprovalRecord;
}

export interface ArtifactRecord {
  artifact_type: string;
  path: string;
  checksum: string;
  generated_at: string;
}

export interface GateResult {
  gate_name: string;
  status: "passed" | "failed" | "skipped";
  evidence_path: string | null;
  timestamp: string;
  method?: "run" | "record";
  command?: string | null;
  exit_code?: number | null;
}

export interface ApprovalRecord {
  decision: "approved" | "rejected" | "pending" | "not_required";
  reviewer: string;
  timestamp: string;
  notes: string;
}

// Stage transition map — ordered list of all stages
export const STAGE_ORDER: StageId[] = [
  "discover",
  "spike",
  "arch",
  "spec",
  "plan",
  "tasks",
  "tooling",
  "dispatch",
  "implement",
  "review",
  "finish-branch",
  "project-report",
  "human-qa",
  "debug",
  "finish-report",
];

// Stages that require HR approval before proceeding to the next stage
export const GOVERNED_STAGES: StageId[] = [
  "arch",
  "spec",
  "plan",
  "tasks",
  "tooling",
];

// Preconditions: what must be true to enter a stage
// Each entry: { stage: required previous stage, approved?: must be approved }
export const STAGE_PRECONDITIONS: Record<
  StageId,
  { stage: StageId; approved?: boolean }[]
> = {
  discover: [],
  spike: [{ stage: "discover" }],
  arch: [{ stage: "spike" }],
  spec: [{ stage: "arch", approved: true }],
  plan: [{ stage: "spec", approved: true }],
  tasks: [{ stage: "plan", approved: true }],
  tooling: [{ stage: "tasks", approved: true }],
  dispatch: [{ stage: "tooling", approved: true }],
  implement: [{ stage: "dispatch" }],
  review: [{ stage: "implement" }],
  "finish-branch": [{ stage: "review" }],
  "project-report": [{ stage: "finish-branch" }],
  "human-qa": [{ stage: "project-report" }],
  debug: [{ stage: "human-qa" }],
  "finish-report": [{ stage: "human-qa" }],
};
