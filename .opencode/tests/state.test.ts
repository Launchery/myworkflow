import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import {
  emptyState,
  getActiveFeature,
  newStageExecution,
  readState,
  writeState,
} from "../state";

const TEST_DIR = join(import.meta.dir, "__state_test_workdir__");

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
});
