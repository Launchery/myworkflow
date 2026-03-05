import { tool } from "@opencode-ai/plugin/tool";
import { readState, updateState } from "../state";
import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";
import { isStageId, type StageId } from "../types";

function normalizeStageId(value: string): StageId | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^\/?wf\./, "")
    .replace(/[\s_]+/g, "-");

  return isStageId(normalized) ? normalized : null;
}

export const wf_artifact_register = tool({
  description:
    "Register a produced artifact for a workflow stage. Records the artifact path, type, and computes a checksum. Call this after creating any stage output file.",
  args: {
    feature_id: tool.schema.string().describe("Feature ID"),
    stage_id: tool.schema.string().describe("Stage ID"),
    artifact_type: tool.schema
      .string()
      .describe(
        "Type of artifact (e.g., 'project-concept', 'specification', 'task-passport')"
      ),
    path: tool.schema
      .string()
      .describe(
        "Relative path to the artifact file from project root"
      ),
  },
  async execute(args, ctx) {
    const stageId = normalizeStageId(args.stage_id);
    if (!stageId) {
      return JSON.stringify({
        error: `Invalid stage '${args.stage_id}'`,
      });
    }

    // Compute checksum
    let checksum = "sha256:unknown";
    try {
      const content = await readFile(
        join(ctx.worktree, args.path),
        "utf-8"
      );
      const hash = createHash("sha256")
        .update(content)
        .digest("hex");
      checksum = `sha256:${hash}`;
    } catch {
      // File might not exist yet or be binary
    }

    const updateResult = await updateState(ctx.worktree, (state) => {
      const feature = state.features[args.feature_id];
      if (!feature) {
        return {
          success: false as const,
          error: `Feature '${args.feature_id}' not found`,
        };
      }

      const stage = feature.stages[stageId];
      if (!stage) {
        return {
          success: false as const,
          error: `Stage '${stageId}' not started for feature '${args.feature_id}'`,
        };
      }

      stage.artifacts.push({
        artifact_type: args.artifact_type,
        path: args.path,
        checksum,
        generated_at: new Date().toISOString(),
      });

      return {
        success: true as const,
      };
    });

    if (!updateResult.success) {
      return JSON.stringify({
        error: updateResult.error,
      });
    }

    return JSON.stringify({
      success: true,
      artifact_type: args.artifact_type,
      path: args.path,
      checksum,
    });
  },
});

export const wf_hr_record = tool({
  description:
    "Record a human review (HR) decision for a workflow stage. Use this after the user approves or rejects a stage's outputs.",
  args: {
    feature_id: tool.schema
      .string()
      .optional()
      .describe("Feature ID (optional, defaults to active feature)"),
    stage_id: tool.schema.string().describe("Stage ID"),
    decision: tool.schema
      .enum(["approved", "rejected"])
      .describe("The HR decision"),
    notes: tool.schema
      .string()
      .optional()
      .describe("Optional notes or rejection reason"),
  },
  async execute(args, ctx) {
    const stageId = normalizeStageId(args.stage_id);
    if (!stageId) {
      return JSON.stringify({
        error: `Invalid stage '${args.stage_id}'`,
      });
    }

    const state = await readState(ctx.worktree);
    const featureId = args.feature_id ?? state.active_feature;
    if (!featureId) {
      return JSON.stringify({
        error: "No active feature and no feature_id provided",
      });
    }

    const updateResult = await updateState(ctx.worktree, (nextState) => {
      const feature = nextState.features[featureId];

      if (!feature) {
        return {
          success: false as const,
          error: `Feature '${featureId}' not found`,
        };
      }

      const stage = feature.stages[stageId];
      if (!stage) {
        return {
          success: false as const,
          error: `Stage '${stageId}' not started for feature '${featureId}'`,
        };
      }

      stage.approval = {
        decision: args.decision,
        reviewer: "user",
        timestamp: new Date().toISOString(),
        notes: args.notes ?? "",
      };

      return {
        success: true as const,
      };
    });

    if (!updateResult.success) {
      return JSON.stringify({
        error: updateResult.error,
      });
    }

    return JSON.stringify({
      success: true,
      stage: stageId,
      decision: args.decision,
    });
  },
});
