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
import {
  wf_dispatch_build,
  wf_runner_init,
  wf_runner_mark,
  wf_runner_next,
  wf_runner_status,
} from "./tools/dispatch-tools";
import { wf_skill_resolve } from "./tools/skill-tools";
import {
  wf_custom_stage_define,
  wf_custom_stage_list,
  wf_custom_stage_remove,
} from "./tools/custom-stage-tools";
import { readState, getActiveFeature } from "./state";
import {
  checkStagePreconditions,
  formatGateCheckResult,
  isGovernedStage,
} from "./gates";
import { resolveSkill } from "./skill-resolver";
import type { StageId } from "./types";
import { STAGE_ORDER } from "./types";
import { readCustomStages, mergeStageOrder } from "./custom-stages";

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

function formatSkillCandidates(candidates: Array<{ source: string; path: string }>): string {
  return candidates
    .map((candidate, index) => `${index + 1}. [${candidate.source}] ${candidate.path}`)
    .join("\n");
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
      wf_dispatch_build,
      wf_runner_init,
      wf_runner_next,
      wf_runner_mark,
      wf_runner_status,
      wf_skill_resolve,
      wf_custom_stage_define,
      wf_custom_stage_list,
      wf_custom_stage_remove,
    },

    // Intercept /wf.* commands to inject context and check preconditions
    "command.execute.before": async (cmdInput, output) => {
      const command = cmdInput.command;

      // Check built-in command map first
      let stageId = COMMAND_TO_STAGE[command];

      // Check custom stages if not a built-in command
      if (!stageId && command.startsWith("wf.")) {
        const customId = command.slice(3); // strip "wf."
        try {
          const config = await readCustomStages(input.worktree);
          const customStage = config.stages.find((s) => s.id === customId);
          if (customStage) {
            stageId = customId as StageId;
          }
        } catch {
          // ignore read errors for custom stages
        }
      }

      if (!stageId) return;

      const skillName = `wf-${stageId}`;
      const skillResolution = await resolveSkill(input.worktree, skillName);

      if (skillResolution.status === "missing") {
        output.parts = [
          textPart(
            [
              "## Workflow Error: Stage Skill Missing",
              "",
              skillResolution.message,
              "",
              `Expected skill name: \`${skillName}\``,
              "Use `wf_skill_resolve` to inspect skill locations and configure preference.",
            ].join("\n")
          ),
        ];
        return;
      }

      if (skillResolution.status === "collision") {
        output.parts = [
          textPart(
            [
              "## Workflow Error: Skill Name Collision",
              "",
              skillResolution.message,
              "",
              `Skill: \`${skillName}\``,
              "Candidates:",
              formatSkillCandidates(skillResolution.candidates),
              "",
              "Resolve interactively by selecting one source:",
              `- \`wf_skill_resolve({ \"skill_name\": \"${skillName}\", \"choice\": \"local\" })\``,
              `- \`wf_skill_resolve({ \"skill_name\": \"${skillName}\", \"choice\": \"global\" })\``,
            ].join("\n")
          ),
        ];
        return;
      }

      const resolvedSkillSource = skillResolution.selected_source ?? "local";
      const resolvedSkillPath = skillResolution.selected_path ?? "";

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
              `Resolved stage skill: ${skillName} (${resolvedSkillSource})`,
              `Skill path: ${resolvedSkillPath}`,
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
              `Resolved stage skill: ${skillName} (${resolvedSkillSource})`,
              `Skill path: ${resolvedSkillPath}`,
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
              `**HR Stage Type:** ${governed ? "Governed" : "Standard"}`,
              "**Stage Exit Approval:** Required for all stages (record approve/reject; completion requires approved)",
              nextStage
                ? `**Next Stage:** /wf.${nextStage}`
                : "**Final Stage**",
              `**Resolved Skill:** ${skillName} (${resolvedSkillSource})`,
              `**Skill Path:** ${resolvedSkillPath}`,
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
              "- `wf_dispatch_build` — build deterministic task waves",
              "- `wf_runner_init` — initialize deterministic runner state",
              "- `wf_runner_next` — claim next runnable tasks",
              "- `wf_runner_mark` — mark task completed/failed/skipped",
              "- `wf_runner_status` — inspect runner progress",
              "- `wf_skill_resolve` — resolve local/global skill collisions",
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
