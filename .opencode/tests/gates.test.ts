import { describe, expect, test } from "bun:test";
import { checkStagePreconditions, isGovernedStage } from "../gates";
import { isStageId, type FeatureRun, type StageExecution, type StageId } from "../types";

function makeStage(
  stageId: StageId,
  result: StageExecution["result"],
  approved = false
): StageExecution {
  return {
    stage_id: stageId,
    command: `/wf.${stageId}`,
    started_at: "2026-03-05T00:00:00Z",
    finished_at: "2026-03-05T00:01:00Z",
    result,
    diagnostics_path: null,
    artifacts: [],
    gates: [],
    approval: {
      decision: approved ? "approved" : "pending",
      reviewer: "user",
      timestamp: "2026-03-05T00:02:00Z",
      notes: "",
    },
  };
}

function makeFeature(stages: Partial<Record<StageId, StageExecution>> = {}): FeatureRun {
  return {
    feature_id: "feature-test",
    title: "Feature Test",
    created_at: "2026-03-05T00:00:00Z",
    status: "in_progress",
    current_stage: "discover",
    stages,
  };
}

describe("stage preconditions", () => {
  test("discover has no prerequisites", () => {
    const feature = makeFeature();
    const result = checkStagePreconditions(feature, "discover");
    expect(result.allowed).toBe(true);
  });

  test("spike requires discover completed", () => {
    const feature = makeFeature();
    const result = checkStagePreconditions(feature, "spike");
    expect(result.allowed).toBe(false);
    expect(result.missing_preconditions).toContain(
      "Stage 'discover' must be completed"
    );
  });

  test("spike is allowed when discover completed", () => {
    const feature = makeFeature({
      discover: makeStage("discover", "completed"),
    });

    const result = checkStagePreconditions(feature, "spike");
    expect(result.allowed).toBe(true);
  });

  test("spec requires arch completed and approved", () => {
    const feature = makeFeature({
      discover: makeStage("discover", "completed"),
      spike: makeStage("spike", "completed"),
      arch: makeStage("arch", "completed", false),
    });

    const result = checkStagePreconditions(feature, "spec");
    expect(result.allowed).toBe(false);
    expect(result.missing_preconditions[0]).toContain("must be approved");
  });

  test("spec allowed when arch completed and approved", () => {
    const feature = makeFeature({
      discover: makeStage("discover", "completed"),
      spike: makeStage("spike", "completed"),
      arch: makeStage("arch", "completed", true),
    });

    const result = checkStagePreconditions(feature, "spec");
    expect(result.allowed).toBe(true);
  });

  test("unknown stage is rejected defensively", () => {
    const feature = makeFeature();
    const result = checkStagePreconditions(feature, "unknown" as StageId);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Unknown stage");
  });
});

describe("governed stages", () => {
  test("returns true for governed stages", () => {
    expect(isGovernedStage("arch")).toBe(true);
    expect(isGovernedStage("spec")).toBe(true);
    expect(isGovernedStage("plan")).toBe(true);
    expect(isGovernedStage("tasks")).toBe(true);
    expect(isGovernedStage("tooling")).toBe(true);
  });

  test("returns false for non-governed stages", () => {
    expect(isGovernedStage("discover")).toBe(false);
    expect(isGovernedStage("dispatch")).toBe(false);
    expect(isGovernedStage("implement")).toBe(false);
  });

  test("stage id guard validates known values", () => {
    expect(isStageId("spec")).toBe(true);
    expect(isStageId("not-a-stage")).toBe(false);
  });
});
