import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import {
  emptyState,
  getActiveFeature,
  newStageExecution,
  readState,
  updateState,
  writeState,
} from "../state";

const TEST_DIR = join(import.meta.dir, "__state_test_workdir__");
const LOCK_PATH = join(
  TEST_DIR,
  "workflow",
  "state",
  "workflow_state.json.lock"
);

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("state helpers", () => {
  test("readState returns empty state when file missing", async () => {
    const state = await readState(TEST_DIR);
    expect(state.version).toBe("1.0");
    expect(state.active_feature).toBeNull();
    expect(state.features).toEqual({});
  });

  test("writeState and readState roundtrip", async () => {
    const state = emptyState();
    state.active_feature = "feature-1";
    state.features["feature-1"] = {
      feature_id: "feature-1",
      title: "Feature One",
      created_at: "2026-03-05T00:00:00Z",
      status: "in_progress",
      current_stage: "discover",
      stages: {},
    };

    await writeState(TEST_DIR, state);
    const loaded = await readState(TEST_DIR);

    expect(loaded.active_feature).toBe("feature-1");
    expect(loaded.features["feature-1"].title).toBe("Feature One");
  });

  test("getActiveFeature returns null without active_feature", () => {
    const state = emptyState();
    expect(getActiveFeature(state)).toBeNull();
  });

  test("newStageExecution returns initialized stage object", () => {
    const stage = newStageExecution("discover");

    expect(stage.stage_id).toBe("discover");
    expect(stage.command).toBe("/wf.discover");
    expect(stage.result).toBe("in_progress");
    expect(stage.finished_at).toBeNull();
    expect(stage.artifacts).toEqual([]);
    expect(stage.gates).toEqual([]);
    expect(stage.approval.decision).toBe("pending");
  });

  test("updateState serializes concurrent updates safely", async () => {
    await writeState(TEST_DIR, emptyState());

    const total = 24;
    await Promise.all(
      Array.from({ length: total }, (_, i) =>
        updateState(TEST_DIR, (state) => {
          const featureId = `feature-${i}`;
          state.features[featureId] = {
            feature_id: featureId,
            title: `Feature ${i}`,
            created_at: new Date().toISOString(),
            status: "in_progress",
            current_stage: "discover",
            stages: {},
          };
          state.active_feature = featureId;
        })
      )
    );

    const loaded = await readState(TEST_DIR);
    expect(Object.keys(loaded.features)).toHaveLength(total);

    const raw = readFileSync(
      join(TEST_DIR, "workflow", "state", "workflow_state.json"),
      "utf-8"
    );
    expect(raw.includes("\u0000")).toBe(false);
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  test("updateState waits for external lock release", async () => {
    await writeState(TEST_DIR, emptyState());

    writeFileSync(LOCK_PATH, "external lock\n", "utf-8");
    setTimeout(() => {
      if (existsSync(LOCK_PATH)) {
        unlinkSync(LOCK_PATH);
      }
    }, 180);

    const startedAt = Date.now();
    await updateState(TEST_DIR, (state) => {
      state.active_feature = "after-external-lock";
    });

    const elapsed = Date.now() - startedAt;
    expect(elapsed).toBeGreaterThanOrEqual(100);

    const loaded = await readState(TEST_DIR);
    expect(loaded.active_feature).toBe("after-external-lock");
  });

  test("updateState removes stale lock files", async () => {
    await writeState(TEST_DIR, emptyState());

    writeFileSync(LOCK_PATH, "stale lock\n", "utf-8");
    const staleTime = new Date(Date.now() - 2 * 60 * 1000);
    utimesSync(LOCK_PATH, staleTime, staleTime);

    await updateState(TEST_DIR, (state) => {
      state.active_feature = "stale-lock-cleared";
    });

    const loaded = await readState(TEST_DIR);
    expect(loaded.active_feature).toBe("stale-lock-cleared");
    expect(existsSync(LOCK_PATH)).toBe(false);
  });
});
