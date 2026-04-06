// Stage Template Tools — v2.0
// Tools for listing and applying pre-built stage templates.

import type { Tool } from "@opencode-ai/plugin";
import {
  TEMPLATES,
  getTemplate,
  listTemplatesByCategory,
  type StageTemplate,
} from "../stage-templates";
import {
  readCustomStages,
  writeCustomStages,
  validateCustomStage,
  type CustomStageDefinition,
} from "../custom-stages";
import { STAGE_ORDER } from "../types";

// ─── Tool: wf_template_list ────────────────────────────────────

export const wf_template_list: Tool = {
  name: "wf_template_list",
  description:
    "List available pre-built stage templates for extending your workflow.",
  parameters: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description:
          "Filter by category: quality, security, deployment, documentation, testing, compliance",
      },
    },
  },
  execute: async (args) => {
    const category = args.category as string | undefined;
    let templates: StageTemplate[];

    if (category) {
      const byCategory = listTemplatesByCategory();
      templates = byCategory[category] || [];
      if (templates.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: [
                "## No Templates Found",
                "",
                `No templates in category "${category}".`,
                "",
                "Available categories: " +
                  Object.keys(listTemplatesByCategory()).join(", "),
              ].join("\n"),
            },
          ],
        };
      }
    } else {
      templates = TEMPLATES;
    }

    const lines = [
      "## Stage Templates",
      "",
      `**${templates.length} template(s) available:**`,
      "",
    ];

    const byCat = listTemplatesByCategory();
    for (const [cat, catTemplates] of Object.entries(byCat)) {
      if (category && cat !== category) continue;
      lines.push(`### ${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
      for (const t of catTemplates) {
        lines.push(
          `- **${t.name}** (\`${t.id}\`) — ${t.description} (${t.stages.length} stage(s))`
        );
      }
      lines.push("");
    }

    lines.push("Use `wf_template_apply` to add a template to your workflow.");

    return {
      content: [{ type: "text", text: lines.join("\n") }],
    };
  },
};

// ─── Tool: wf_template_apply ───────────────────────────────────

export const wf_template_apply: Tool = {
  name: "wf_template_apply",
  description:
    "Apply a pre-built stage template to your workflow. Adds all stages from the template.",
  parameters: {
    type: "object",
    properties: {
      template_id: {
        type: "string",
        description: "The template ID to apply (use wf_template_list to see options)",
      },
    },
    required: ["template_id"],
  },
  execute: async (args, context) => {
    const workdir = context.worktree;
    const templateId = args.template_id as string;
    const template = getTemplate(templateId);

    if (!template) {
      return {
        content: [
          {
            type: "text",
            text: [
              "## Template Not Found",
              "",
              `No template with ID \`${templateId}\`.`,
              "",
              "Use `wf_template_list` to see available templates.",
              "",
              "Available: " + TEMPLATES.map((t) => `\`${t.id}\``).join(", "),
            ].join("\n"),
          },
        ],
      };
    }

    const config = await readCustomStages(workdir);

    // Build existing IDs set
    const existingIds = new Set(STAGE_ORDER);
    for (const s of config.stages) {
      existingIds.add(s.id);
    }

    // Validate each stage
    const added: CustomStageDefinition[] = [];
    const skipped: { stage: CustomStageDefinition; reason: string }[] = [];

    for (const stage of template.stages) {
      const validation = validateCustomStage(stage, existingIds);
      if (!validation.valid) {
        skipped.push({ stage, reason: validation.errors.join("; ") });
      } else {
        config.stages.push(stage);
        existingIds.add(stage.id);
        added.push(stage);
      }
    }

    if (added.length > 0) {
      await writeCustomStages(workdir, config);
    }

    const lines = [
      "## Template Applied",
      "",
      `**${template.name}** (\`${template.id}\`)`,
      "",
    ];

    if (added.length > 0) {
      lines.push(`### Added (${added.length}):`);
      for (const s of added) {
        lines.push(
          `- ✅ **${s.name}** (\`${s.id}\`) — after: ${s.after.join(", ") || "none"}`
        );
      }
      lines.push("");
    }

    if (skipped.length > 0) {
      lines.push(`### Skipped (${skipped.length}):`);
      for (const { stage, reason } of skipped) {
        lines.push(`- ⚠️ **${stage.name}** (\`${stage.id}\`) — ${reason}`);
      }
      lines.push("");
    }

    const allStages = [...STAGE_ORDER, ...config.stages.map((s) => s.id)];
    lines.push(`**Full pipeline (${allStages.length}):**`);
    lines.push(allStages.join(" → "));

    return {
      content: [{ type: "text", text: lines.join("\n") }],
    };
  },
};
