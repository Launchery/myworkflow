import {
  readFile,
  writeFile,
  mkdir,
  rename,
  open,
  stat,
  unlink,
} from "fs/promises";
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
const STATE_LOCK_FILE = `${STATE_FILE}.lock`;

const FILE_LOCK_TIMEOUT_MS = 10_000;
const FILE_LOCK_POLL_MS = 50;
const FILE_LOCK_STALE_MS = 60_000;

const stateLocks = new Map<string, Promise<void>>();

function statePath(workdir: string): string {
  return join(workdir, STATE_DIR, STATE_FILE);
}

function stateDirPath(workdir: string): string {
  return join(workdir, STATE_DIR);
}

function stateLockPath(workdir: string): string {
  return join(stateDirPath(workdir), STATE_LOCK_FILE);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function ensureStateDir(workdir: string): Promise<void> {
  const dir = stateDirPath(workdir);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function removeLockIfStale(lockPath: string): Promise<void> {
  let lockStats;
  try {
    lockStats = await stat(lockPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return;
    }
    throw error;
  }

  const ageMs = Date.now() - lockStats.mtimeMs;
  if (ageMs <= FILE_LOCK_STALE_MS) {
    return;
  }

  try {
    await unlink(lockPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw error;
    }
  }
}

async function acquireFileLock(
  workdir: string
): Promise<() => Promise<void>> {
  await ensureStateDir(workdir);

  const lockPath = stateLockPath(workdir);
  const start = Date.now();

  while (true) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(
        JSON.stringify(
          {
            pid: process.pid,
            acquired_at: new Date().toISOString(),
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      return async () => {
        await handle.close();
        try {
          await unlink(lockPath);
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code !== "ENOENT") {
            throw error;
          }
        }
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") {
        throw error;
      }

      await removeLockIfStale(lockPath);

      if (Date.now() - start > FILE_LOCK_TIMEOUT_MS) {
        throw new Error(
          `Timed out acquiring state file lock: ${STATE_LOCK_FILE}`
        );
      }

      await sleep(FILE_LOCK_POLL_MS);
    }
  }
}

async function withStateLock<T>(
  workdir: string,
  operation: () => Promise<T>
): Promise<T> {
  const previous = stateLocks.get(workdir) ?? Promise.resolve();

  let releaseLock: (() => void) | null = null;
  const current = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  stateLocks.set(
    workdir,
    previous.then(
      () => current,
      () => current
    )
  );

  await previous.catch(() => undefined);

  let releaseFileLock: (() => Promise<void>) | null = null;

  try {
    releaseFileLock = await acquireFileLock(workdir);
    return await operation();
  } finally {
    if (releaseFileLock) {
      await releaseFileLock();
    }
    releaseLock?.();
    if (stateLocks.get(workdir) === current) {
      stateLocks.delete(workdir);
    }
  }
}

async function writeStateAtomic(
  workdir: string,
  state: WorkflowState
): Promise<void> {
  await ensureStateDir(workdir);

  const path = statePath(workdir);
  const tempPath = `${path}.tmp-${process.pid}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
  const serialized = JSON.stringify(state, null, 2) + "\n";

  await writeFile(tempPath, serialized, "utf-8");
  await rename(tempPath, path);
}

async function readStateFile(workdir: string): Promise<WorkflowState> {
  const path = statePath(workdir);
  if (!existsSync(path)) {
    return emptyState();
  }

  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as WorkflowState;
}

export function emptyState(): WorkflowState {
  return {
    version: "1.0",
    active_feature: null,
    features: {},
  };
}

export async function readState(workdir: string): Promise<WorkflowState> {
  return readStateFile(workdir);
}

export async function writeState(
  workdir: string,
  state: WorkflowState
): Promise<void> {
  await withStateLock(workdir, async () => {
    await writeStateAtomic(workdir, state);
  });
}

export async function updateState<T>(
  workdir: string,
  updater: (state: WorkflowState) => T | Promise<T>
): Promise<T> {
  return withStateLock(workdir, async () => {
    const state = await readStateFile(workdir);
    const result = await updater(state);
    await writeStateAtomic(workdir, state);
    return result;
  });
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
