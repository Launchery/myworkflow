// Custom Stage Tools — v2.0
// Tools for defining, listing, and removing custom workflow stages.

import type { Tool } from "@opencode-ai/plugin";
import {
  readCustomStages,
  writeCustomStages,
  validateCustomStage,
  type CustomStageDefinition,
} from "../custom-stages";
import { STAGE_ORDER } from "../types";

// ─── Tool: wf_custom_stage_define ──────────────────────────────

export const wf_custom_stage_define: Tool = {
  name: "wf_custom_stage_define",
  description:
    "Define a new custom workflow stage. Custom stages extend the built-in 15 stages with project-specific steps.",
  parameters: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description:
          "Unique stage identifier (kebab-case, e.g. 'security-review')",
      },
      name: {
        type: "string",
        description: "Human-readable stage name",
      },
      description: {
        type: "string",
        description: "What this stage does",
      },
      after: {
        type: "array",
        items: { type: "string" },
        description:
          "Stage IDs that must complete before this stage (preconditions)",
      },
      governed: {
        type: "boolean",
        description:
          "Whether this stage requires HR approval before proceeding (default: false)",
        default: false,
      },
      skills: {
        type: "array",
        items: { type: "string" },
        description: "Skill names that should be available for this stage",
      },
      artifacts: {
        type: "array",
        items: { type: "string" },
        description: "Expected artifact types this stage produces",
      },
      position: {
        type: "string",
        description:
          'Position hint: "before:<stage>" or "after:<stage>" for ordering. Default: placed after last dependency.',
      },
    },
    required: ["id", "name", "description", "after"],
  },
  execute: async (args, context) => {
    const workdir = context.worktree;
    const config = await readCustomStages(workdir);

    // Build existing IDs set
    const existingIds = new Set(STAGE_ORDER);
    for (const s of config.stages) {
      existingIds.add(s.id);
    }

    const definition: CustomStageDefinition = {
      id: args.id as string,
      name: args.name as string,
      description: args.description as string,
      after: (args.after as string[]) || [],
      governed: (args.governed as boolean) || false,
      skills: (args.skills as string[]) || [],
      artifacts: (args.artifacts as string[]) || [],
      position: args.position as string | undefined,
    };

    // Validate
    const validation = validateCustomStage(definition, existingIds);
    if (!validation.valid) {
      return {
        content: [
          {
            type: "text",
            text: [
              "## Custom Stage Validation Failed",
              "",
              ...validation.errors.map((e) => `- ❌ ${e}`),
              "",
              "Fix the errors above and try again.",
            ].join("\n"),
          },
        ],
      };
    }

    // Add to config
    config.stages.push(definition);
    await writeCustomStages(workdir, config);

    const mergedOrder = [
      ...STAGE_ORDER,
      ...config.stages.map((s) => s.id),
    ];

    return {
      content: [
        {
          type: "text",
          text: [
            "## Custom Stage Defined ✅",
            "",
            `**${definition.name}** (\`${definition.id}\`)`,
            "",
            `Description: ${definition.description}`,
            `Preconditions: ${definition.after.join(", ") || "none"}`,
            `Governed: ${definition.governed ? "Yes (requires approval)" : "No"}`,
            `Skills: ${definition.skills.join(", ") || "none"}`,
            `Artifacts: ${definition.artifacts.join(", ") || "none"}`,
            `Position: ${definition.position || "auto (after last dependency)"}`,
            "",
            `All stages (${mergedOrder.length}): ${mergedOrder.join(" → ")}`,
            "",
            `Command: \`/wf.${definition.id}\``,
            "",
            "Run `wf_custom_stage_list` to see all custom stages.",
          ].join("\n"),
        },
      ],
    };
  },
};

// ─── Tool: wf_custom_stage_list ────────────────────────────────

export const wf_custom_stage_list: Tool = {
  name: "wf_custom_stage_list",
  description:
    "List all custom workflow stages defined for this project.",
  parameters: {
    type: "object",
    properties: {},
  },
  execute: async (_args, context) => {
    const workdir = context.worktree;
    const config = await readCustomStages(workdir);

    if (config.stages.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: [
              "## No Custom Stages Defined",
              "",
              "Built-in stages: " + STAGE_ORDER.join(" → "),
              "",
              "Use `wf_custom_stage_define` to add custom stages.",
              "",
              "Example:",
              "```",
              "wf_custom_stage_define({",
              '  id: "security-review",',
              '  name: "Security Review",',
              '  description: "Review code for security vulnerabilities",',
              '  after: ["review"],',
              "  governed: true,",
              '  artifacts: ["security-report"]',
              "})",
              "```",
            ].join("\n"),
          },
        ],
      };
    }

    const lines = [
      "## Custom Workflow Stages",
      "",
      `**${config.stages.length} custom stage(s) defined:**`,
      "",
    ];

    for (const stage of config.stages) {
      lines.push(`### ${stage.name} (\`${stage.id}\`)`);
      lines.push(`- Description: ${stage.description}`);
      lines.push(`- After: ${stage.after.join(", ") || "none"}`);
      lines.push(
        `- Governed: ${stage.governed ? "Yes ✋" : "No"}`
      );
      if (stage.skills.length > 0) {
        lines.push(`- Skills: ${stage.skills.join(", ")}`);
      }
      if (stage.artifacts.length > 0) {
        lines.push(`- Artifacts: ${stage.artifacts.join(", ")}`);
      }
      lines.push(`- Command: \`/wf.${stage.id}\``);
      lines.push("");
    }

    const mergedOrder = [
      ...STAGE_ORDER,
      ...config.stages.map((s) => s.id),
    ];
    lines.push(`**Full stage pipeline (${mergedOrder.length}):**`);
    lines.push(mergedOrder.join(" → "));

    return {
      content: [{ type: "text", text: lines.join("\n") }],
    };
  },
};

// ─── Tool: wf_custom_stage_remove ──────────────────────────────

export const wf_custom_stage_remove: Tool = {
  name: "wf_custom_stage_remove",
  description: "Remove a custom workflow stage by ID.",
  parameters: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "The custom stage ID to remove",
      },
    },
    required: ["id"],
  },
  execute: async (args, context) => {
    const workdir = context.worktree;
    const config = await readCustomStages(workdir);
    const targetId = args.id as string;

    const idx = config.stages.findIndex((s) => s.id === targetId);
    if (idx === -1) {
      return {
        content: [
          {
            type: "text",
            text: [
              "## Custom Stage Not Found",
              "",
              `No custom stage with ID \`${targetId}\` found.`,
              "",
              "Use `wf_custom_stage_list` to see all custom stages.",
            ].join("\n"),
          },
        ],
      };
    }

    const removed = config.stages.splice(idx, 1)[0];
    await writeCustomStages(workdir, config);

    return {
      content: [
        {
          type: "text",
          text: [
            "## Custom Stage Removed ✅",
            "",
            `**${removed.name}** (\`${removed.id}\`) has been removed.`,
            "",
            `Remaining custom stages: ${config.stages.length}`,
            config.stages.length > 0
              ? config.stages.map((s) => `- ${s.id}: ${s.name}`).join("\n")
              : "Use `wf_custom_stage_define` to add new stages.",
          ].join("\n"),
        },
      ],
    };
  },
};
