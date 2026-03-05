import { tool } from "@opencode-ai/plugin/tool";
import { readState, writeState } from "../state";
import { mkdir } from "fs/promises";
import { join } from "path";
import type { FeatureRun } from "../types";

export const wf_feature_init = tool({
  description:
    "Initialize a new feature workflow run. Creates a feature entry in state and sets it as active. Must be called before starting any stage.",
  args: {
    title: tool.schema
      .string()
      .describe(
        "Human-readable title for this feature (e.g., 'User Authentication')"
      ),
    feature_id: tool.schema
      .string()
      .optional()
      .describe(
        "Custom feature ID. If omitted, generates from date and title slug."
      ),
  },
  async execute(args, ctx) {
    const state = await readState(ctx.worktree);

    const slug = args.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const date = new Date().toISOString().slice(0, 10);
    const featureId = args.feature_id ?? `${date}-${slug}`;

    if (state.features[featureId]) {
      return JSON.stringify({
        error: `Feature '${featureId}' already exists. Use a different ID or title.`,
      });
    }

    const feature: FeatureRun = {
      feature_id: featureId,
      title: args.title,
      created_at: new Date().toISOString(),
      status: "in_progress",
      current_stage: "discover",
      stages: {},
    };

    state.features[featureId] = feature;
    state.active_feature = featureId;

    // Create feature directory
    const featureDir = join(
      ctx.worktree,
      "workflow",
      "features",
      featureId
    );
    await mkdir(featureDir, { recursive: true });

    await writeState(ctx.worktree, state);
    return JSON.stringify({
      success: true,
      feature_id: featureId,
      title: args.title,
      directory: `workflow/features/${featureId}`,
    });
  },
});
