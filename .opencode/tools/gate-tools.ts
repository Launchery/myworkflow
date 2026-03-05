import { tool } from "@opencode-ai/plugin/tool";
import { readState, writeState } from "../state";
import {
  checkStagePreconditions,
  formatGateCheckResult,
} from "../gates";
import { isStageId } from "../types";

export const wf_gate_check = tool({
  description:
    "Check if preconditions are met to enter a specific workflow stage. Returns whether the transition is allowed and what preconditions are missing.",
  args: {
    target_stage: tool.schema
      .string()
      .describe(
        "The stage you want to transition to (e.g., 'spec', 'plan')"
      ),
    feature_id: tool.schema
      .string()
      .optional()
      .describe(
        "Feature ID. If omitted, uses the active feature."
      ),
  },
  async execute(args, ctx) {
    if (!isStageId(args.target_stage)) {
      return `Invalid stage '${args.target_stage}'.`;
    }

    const state = await readState(ctx.worktree);
    const featureId = args.feature_id ?? state.active_feature;

    if (!featureId) {
      return "No active feature. Use wf_feature_init to create one.";
    }

    const feature = state.features[featureId];
    if (!feature) {
      return `Feature '${featureId}' not found.`;
    }

    const result = checkStagePreconditions(
      feature,
      args.target_stage
    );
    return formatGateCheckResult(result);
  },
});

export const wf_gate_record = tool({
  description:
    "Record the result of a quality gate check for a specific stage. Use this after running a gate check (e.g., tests pass, lint clean, artifact valid).",
  args: {
    feature_id: tool.schema.string().describe("Feature ID"),
    stage_id: tool.schema.string().describe("Stage ID"),
    gate_name: tool.schema
      .string()
      .describe(
        "Name of the gate (e.g., 'tests-pass', 'lint-clean')"
      ),
    status: tool.schema
      .enum(["passed", "failed", "skipped"])
      .describe("Gate result"),
    evidence_path: tool.schema
      .string()
      .optional()
      .describe(
        "Path to evidence file (test output, lint report, etc.)"
      ),
  },
  async execute(args, ctx) {
    if (!isStageId(args.stage_id)) {
      return JSON.stringify({
        error: `Invalid stage '${args.stage_id}'`,
      });
    }

    const state = await readState(ctx.worktree);
    const feature = state.features[args.feature_id];

    if (!feature) {
      return JSON.stringify({
        error: `Feature '${args.feature_id}' not found`,
      });
    }

    const stage = feature.stages[args.stage_id];
    if (!stage) {
      return JSON.stringify({
        error: `Stage '${args.stage_id}' not started for feature '${args.feature_id}'`,
      });
    }

    stage.gates.push({
      gate_name: args.gate_name,
      status: args.status,
      evidence_path: args.evidence_path ?? null,
      timestamp: new Date().toISOString(),
    });

    await writeState(ctx.worktree, state);
    return JSON.stringify({
      success: true,
      gate: args.gate_name,
      status: args.status,
    });
  },
});
