import { tool } from "@opencode-ai/plugin/tool";
import {
  clearSkillSelection,
  resolveSkill,
  setSkillSelection,
  type SkillSource,
} from "../skill-resolver";

type ResolveArgs = {
  skill_name: string;
  choice?: SkillSource | "clear";
  global_root_override?: string;
};

export const wf_skill_resolve = tool({
  description:
    "Resolve skill name collisions between local and global skill locations. Returns candidates and lets you persist local/global preference.",
  args: {
    skill_name: tool.schema
      .string()
      .describe("Skill name to resolve (e.g., wf-discover)."),
    choice: tool.schema
      .enum(["local", "global", "clear"])
      .optional()
      .describe(
        "Optional preference action. local/global stores preference, clear removes preference."
      ),
    global_root_override: tool.schema
      .string()
      .optional()
      .describe("Optional global skill root override, useful for diagnostics/tests."),
  },
  async execute(args: ResolveArgs, ctx) {
    const options = args.global_root_override
      ? { global_roots: [args.global_root_override] }
      : undefined;

    if (args.choice === "clear") {
      await clearSkillSelection(ctx.worktree, args.skill_name);
      const resolution = await resolveSkill(ctx.worktree, args.skill_name, options);
      return JSON.stringify(
        {
          success: true,
          cleared: true,
          resolution,
        },
        null,
        2
      );
    }

    if (args.choice === "local" || args.choice === "global") {
      const preResolution = await resolveSkill(ctx.worktree, args.skill_name, options);
      const hasChoiceCandidate = preResolution.candidates.some(
        (candidate) => candidate.source === args.choice
      );

      if (!hasChoiceCandidate) {
        return JSON.stringify(
          {
            error: `No ${args.choice} candidate found for '${args.skill_name}'.`,
            resolution: preResolution,
          },
          null,
          2
        );
      }

      await setSkillSelection(ctx.worktree, args.skill_name, args.choice);
    }

    const resolution = await resolveSkill(ctx.worktree, args.skill_name, options);
    return JSON.stringify(
      {
        success: resolution.status !== "missing",
        resolution,
      },
      null,
      2
    );
  },
});
