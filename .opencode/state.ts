import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type {
  WorkflowState,
  FeatureRun,
  StageId,
  StageExecution,
} from "./types";

const STATE_DIR = "workflow/state";
const STATE_FILE = "workflow_state.json";

function statePath(workdir: string): string {
  return join(workdir, STATE_DIR, STATE_FILE);
}

export function emptyState(): WorkflowState {
  return {
    version: "1.0",
    active_feature: null,
    features: {},
  };
}

export async function readState(workdir: string): Promise<WorkflowState> {
  const path = statePath(workdir);
  if (!existsSync(path)) {
    return emptyState();
  }
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as WorkflowState;
}

export async function writeState(
  workdir: string,
  state: WorkflowState
): Promise<void> {
  const dir = join(workdir, STATE_DIR);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const path = statePath(workdir);
  await writeFile(path, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

export function getActiveFeature(state: WorkflowState): FeatureRun | null {
  if (!state.active_feature) return null;
  return state.features[state.active_feature] ?? null;
}

export function getStage(
  feature: FeatureRun,
  stageId: StageId
): StageExecution | null {
  return feature.stages[stageId] ?? null;
}

export function newStageExecution(stageId: StageId): StageExecution {
  return {
    stage_id: stageId,
    command: `/wf.${stageId}`,
    started_at: new Date().toISOString(),
    finished_at: null,
    result: "in_progress",
    diagnostics_path: null,
    artifacts: [],
    gates: [],
    approval: {
      decision: "pending",
      reviewer: "",
      timestamp: "",
      notes: "",
    },
  };
}
