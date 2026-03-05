import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";
import {
  resolveSkill,
  setSkillSelection,
  clearSkillSelection,
} from "../skill-resolver";
import { wf_skill_resolve } from "../tools/skill-tools";

const TEST_DIR = join(import.meta.dir, "__skill_resolver_workdir__");
const GLOBAL_ROOT = join(TEST_DIR, "global-skills");

const makeCtx = (worktree: string) => ({ worktree } as any);

function asJson(value: string): any {
  return JSON.parse(value);
}

async function writeSkill(path: string, name: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    [
      "---",
      `name: ${name}`,
      'description: "test skill"',
      "user-invocable: false",
      "---",
      "",
      "# Test Skill",
      "",
    ].join("\n"),
    "utf-8"
  );
}

beforeEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("skill resolver", () => {
  test("reports collision when local and global skill names overlap", async () => {
    await writeSkill(
      join(TEST_DIR, ".opencode", "skill", "wf-discover", "SKILL.md"),
      "wf-discover"
    );
    await writeSkill(
      join(GLOBAL_ROOT, "superpowers", "wf-discover", "SKILL.md"),
      "wf-discover"
    );

    const result = await resolveSkill(TEST_DIR, "wf-discover", {
      global_roots: [GLOBAL_ROOT],
    });

    expect(result.status).toBe("collision");
    expect(result.candidates.length).toBe(2);
  });

  test("uses stored source preference to resolve collisions", async () => {
    await writeSkill(
      join(TEST_DIR, ".opencode", "skill", "wf-discover", "SKILL.md"),
      "wf-discover"
    );
    await writeSkill(
      join(GLOBAL_ROOT, "superpowers", "wf-discover", "SKILL.md"),
      "wf-discover"
    );

    await setSkillSelection(TEST_DIR, "wf-discover", "local");
    const localResolution = await resolveSkill(TEST_DIR, "wf-discover", {
      global_roots: [GLOBAL_ROOT],
    });
    expect(localResolution.status).toBe("resolved");
    expect(localResolution.selected_source).toBe("local");

    await setSkillSelection(TEST_DIR, "wf-discover", "global");
    const globalResolution = await resolveSkill(TEST_DIR, "wf-discover", {
      global_roots: [GLOBAL_ROOT],
    });
    expect(globalResolution.status).toBe("resolved");
    expect(globalResolution.selected_source).toBe("global");

    await clearSkillSelection(TEST_DIR, "wf-discover");
  });

  test("wf_skill_resolve stores and clears preference interactively", async () => {
    const ctx = makeCtx(TEST_DIR);
    await writeSkill(
      join(TEST_DIR, ".opencode", "skill", "wf-discover", "SKILL.md"),
      "wf-discover"
    );
    await writeSkill(
      join(GLOBAL_ROOT, "superpowers", "wf-discover", "SKILL.md"),
      "wf-discover"
    );

    const inspection = asJson(
      await wf_skill_resolve.execute(
        {
          skill_name: "wf-discover",
          global_root_override: GLOBAL_ROOT,
        },
        ctx
      )
    );
    expect(inspection.resolution.status).toBe("collision");

    const chosen = asJson(
      await wf_skill_resolve.execute(
        {
          skill_name: "wf-discover",
          choice: "local",
          global_root_override: GLOBAL_ROOT,
        },
        ctx
      )
    );
    expect(chosen.resolution.status).toBe("resolved");
    expect(chosen.resolution.selected_source).toBe("local");

    const cleared = asJson(
      await wf_skill_resolve.execute(
        {
          skill_name: "wf-discover",
          choice: "clear",
          global_root_override: GLOBAL_ROOT,
        },
        ctx
      )
    );
    expect(cleared.cleared).toBe(true);
  });
});
