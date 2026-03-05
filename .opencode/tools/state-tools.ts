import { tool } from "@opencode-ai/plugin/tool";
import {
  readState,
  writeState,
  newStageExecution,
} from "../state";
import { isStageId, type StageId } from "../types";
import { validateStageExit } from "../contracts";

export const wf_state_read = tool({
  description:
    "Read the current workflow state. Returns the full state including active feature, stages, artifacts, gates, and approvals. Call this at the start of any workflow stage to understand the current context.",
  args: {
    feature_id: tool.schema
      .string()
      .optional()
      .describe(
        "Specific feature ID to read. If omitted, reads the active feature."
      ),
  },
  async execute(args, ctx) {
    const state = await readState(ctx.worktree);

    if (args.feature_id) {
      const feature = state.features[args.feature_id];
      if (!feature) {
        return JSON.stringify({
          error: `Feature '${args.feature_id}' not found`,
          available_features: Object.keys(state.features),
        });
      }
      return JSON.stringify(
        {
          state: {
            ...state,
            features: { [args.feature_id]: feature },
          },
        },
        null,
        2
      );
    }

    if (!state.active_feature) {
      return JSON.stringify({
        message: "No active feature. Use wf_feature_init to create one.",
        state,
      });
    }

    return JSON.stringify(state, null, 2);
  },
});

export const wf_state_write = tool({
  description:
    "Update the workflow state for a specific feature and stage. Use this to mark stages as started, completed, or failed.",
  args: {
    feature_id: tool.schema.string().describe("Feature ID to update"),
    stage_id: tool.schema
      .string()
      .optional()
      .describe(
        "Stage ID to update (required for start/complete/fail actions)"
      ),
    action: tool.schema
      .enum(["start", "complete", "fail", "set_feature_status"])
      .describe("Action to perform on the stage"),
    feature_status: tool.schema
      .enum(["in_progress", "completed", "failed", "cancelled"])
      .optional()
      .describe(
        "Feature status to set when action is set_feature_status"
      ),
    diagnostics_path: tool.schema
      .string()
      .optional()
      .describe("Path to diagnostics file (for failed stages)"),
  },
  async execute(args, ctx) {
    const state = await readState(ctx.worktree);
    const feature = state.features[args.feature_id];

    if (!feature) {
      return JSON.stringify({
        error: `Feature '${args.feature_id}' not found`,
      });
    }

    if (args.action === "set_feature_status") {
      if (!args.feature_status) {
        return JSON.stringify({
          error: "feature_status is required for set_feature_status action",
        });
      }

      feature.status = args.feature_status;
      await writeState(ctx.worktree, state);
      return JSON.stringify({
        success: true,
        action: args.action,
        feature: args.feature_id,
        feature_status: args.feature_status,
      });
    }

    if (!args.stage_id) {
      return JSON.stringify({
        error: "stage_id is required for start/complete/fail actions",
      });
    }

    if (!isStageId(args.stage_id)) {
      return JSON.stringify({
        error: `Invalid stage '${args.stage_id}'`,
      });
    }

    const stageId: StageId = args.stage_id;

    if (args.action === "start") {
      feature.stages[stageId] = newStageExecution(stageId);
      feature.current_stage = stageId;
    } else if (args.action === "complete") {
      const stage = feature.stages[stageId];
      if (!stage) {
        return JSON.stringify({
          error: `Stage '${stageId}' not started for feature '${args.feature_id}'`,
        });
      }

      const validation = validateStageExit(feature, stageId);
      if (!validation.ok) {
        return JSON.stringify({
          error: `Stage exit contract failed for '${stageId}'`,
          violations: validation.errors,
        });
      }

      stage.result = "completed";
      stage.finished_at = new Date().toISOString();
    } else if (args.action === "fail") {
      const stage = feature.stages[stageId];
      if (!stage) {
        return JSON.stringify({
          error: `Stage '${stageId}' not started for feature '${args.feature_id}'`,
        });
      }

      stage.result = "failed";
      stage.finished_at = new Date().toISOString();
      stage.diagnostics_path = args.diagnostics_path ?? null;
      feature.status = "failed";
    }

    await writeState(ctx.worktree, state);
    return JSON.stringify({
      success: true,
      action: args.action,
      stage: args.stage_id,
      feature: args.feature_id,
    });
  },
});
