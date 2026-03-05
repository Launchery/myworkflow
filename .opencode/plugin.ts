import type { Plugin } from "@opencode-ai/plugin";
import { wf_state_read, wf_state_write } from "./tools/state-tools";
import {
  wf_gate_check,
  wf_gate_record,
  wf_gate_run,
} from "./tools/gate-tools";
import {
  wf_artifact_register,
  wf_hr_record,
} from "./tools/artifact-tools";
import { wf_feature_init } from "./tools/feature-tools";
import { readState, getActiveFeature } from "./state";
import {
  checkStagePreconditions,
  formatGateCheckResult,
  isGovernedStage,
} from "./gates";
import type { StageId } from "./types";
import { STAGE_ORDER } from "./types";

// Map slash command names to stage IDs
const COMMAND_TO_STAGE: Record<string, StageId> = {
  "wf.discover": "discover",
  "wf.spike": "spike",
  "wf.arch": "arch",
  "wf.spec": "spec",
  "wf.plan": "plan",
  "wf.tasks": "tasks",
  "wf.tooling": "tooling",
  "wf.dispatch": "dispatch",
  "wf.implement": "implement",
  "wf.review": "review",
  "wf.finish-branch": "finish-branch",
  "wf.project-report": "project-report",
  "wf.human-qa": "human-qa",
  "wf.debug": "debug",
  "wf.finish-report": "finish-report",
};

function textPart(text: string): any {
  return { type: "text", text };
}

const plugin: Plugin = async (input) => {
  return {
    // Register all custom tools
    tool: {
      wf_state_read,
      wf_state_write,
      wf_gate_check,
      wf_gate_record,
      wf_gate_run,
      wf_artifact_register,
      wf_hr_record,
      wf_feature_init,
    },

    // Intercept /wf.* commands to inject context and check preconditions
    "command.execute.before": async (cmdInput, output) => {
      const command = cmdInput.command;

      // Only handle workflow stage commands
      const stageId = COMMAND_TO_STAGE[command];
      if (!stageId) return;

      const state = await readState(input.worktree);
      const feature = getActiveFeature(state);

      // If no active feature and not discover, block
      if (!feature && stageId !== "discover") {
        output.parts = [
          textPart(
            [
              "## Workflow Error: No Active Feature",
              "",
              "No active feature found. You must first:",
              "1. Create a feature with `wf_feature_init` tool",
              "2. Or run `/wf.discover` to start a new feature workflow",
              "",
              `Current state: ${JSON.stringify(state, null, 2)}`,
            ].join("\n")
          ),
        ];
        return;
      }

      // If discover and no feature, that's fine — skill will init
      if (stageId === "discover" && !feature) {
        output.parts = [
          textPart(
            [
              "## Workflow Context",
              "",
              "Starting new feature discovery. No active feature yet.",
              "Use `wf_feature_init` tool to create a feature entry before proceeding.",
              "",
              `Workflow state: ${JSON.stringify(state, null, 2)}`,
            ].join("\n")
          ),
        ];
        return;
      }

      if (feature) {
        // Check preconditions
        const gateResult = checkStagePreconditions(feature, stageId);

        if (!gateResult.allowed) {
          output.parts = [
            textPart(
              [
                "## Workflow Error: Preconditions Not Met",
                "",
                formatGateCheckResult(gateResult),
                "",
                "Use `/wf.status` to see the current workflow state.",
                "Use `/wf.gates` to see all gate statuses.",
              ].join("\n")
            ),
          ];
          return;
        }

        // Inject workflow context
        const governed = isGovernedStage(stageId);
        const stageIndex = STAGE_ORDER.indexOf(stageId);
        const nextStage =
          stageIndex < STAGE_ORDER.length - 1
            ? STAGE_ORDER[stageIndex + 1]
            : null;

        output.parts = [
          textPart(
            [
              "## Workflow Context",
              "",
              `**Feature:** ${feature.feature_id} — ${feature.title}`,
              `**Current Stage:** ${stageId} (${stageIndex + 1}/${STAGE_ORDER.length})`,
              `**HR Required:** ${governed ? "Yes — must get approval before proceeding" : "No"}`,
              nextStage
                ? `**Next Stage:** /wf.${nextStage}`
                : "**Final Stage**",
              "",
              `**Feature Directory:** workflow/features/${feature.feature_id}/${stageId}/`,
              "",
              "### Stage Artifact Path",
              `All outputs for this stage go to: \`workflow/features/${feature.feature_id}/${stageId}/\``,
              "",
              "### Available Workflow Tools",
              "- `wf_state_read` — read current state",
              "- `wf_state_write` — update stage status (start/complete/fail)",
              "- `wf_gate_check` — check stage preconditions",
              "- `wf_gate_record` — record gate results",
              "- `wf_gate_run` — execute gate command with evidence",
              "- `wf_artifact_register` — register produced artifacts",
              "- `wf_hr_record` — record approval decisions",
              "",
              "### Current State",
              "```json",
              JSON.stringify(feature, null, 2),
              "```",
            ].join("\n")
          ),
        ];
      }
    },
  };
};

export default plugin;
