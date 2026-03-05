import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { wf_feature_init } from "../tools/feature-tools";
import {
  wf_dispatch_build,
  wf_runner_init,
  wf_runner_mark,
  wf_runner_next,
  wf_runner_status,
} from "../tools/dispatch-tools";

const TEST_DIR = join(import.meta.dir, "__dispatch_runner_workdir__");
const REPO_SCHEMA_PATH = join(
  import.meta.dir,
  "..",
  "..",
  "workflow",
  "schemas",
  "task-passport.schema.yaml"
);

const makeCtx = (worktree: string) => ({ worktree } as any);

function asJson(value: string): any {
  return JSON.parse(value);
}

function passportYaml(input: {
  taskId: string;
  goal: string;
  inputs: string[];
  dependsOn?: string[];
  outputs: Array<{ path: string; type: "create" | "modify" | "test" }>;
  gateCommand?: string;
}): string {
  const gateCommand = input.gateCommand ?? "true";
  const inputsBlock =
    input.inputs.length === 0
      ? "  - path: \"README.md\"\n    description: \"default input\""
      : input.inputs
          .map(
            (path) =>
              `  - path: "${path}"\n    description: "input for ${input.taskId}"`
          )
          .join("\n");

  const outputsBlock = input.outputs
    .map(
      (o) => `  - path: "${o.path}"\n    type: "${o.type}"`
    )
    .join("\n");

  const dependsOnBlock = Array.isArray(input.dependsOn) && input.dependsOn.length > 0
    ? ["depends_on:", ...input.dependsOn.map((dep) => `  - "${dep}"`)]
    : [];

  return [
    `task_id: "${input.taskId}"`,
    `goal: "${input.goal}"`,
    ...dependsOnBlock,
    "inputs:",
    inputsBlock,
    "outputs:",
    outputsBlock,
    "allowed_tools:",
    '  - tool_name: "Read"',
    '  - tool_name: "Write"',
    '  - tool_name: "Bash"',
    "gates:",
    '  - name: "task-gate"',
    `    check: "${gateCommand}"`,
    "dod:",
    '  - criterion: "Task completed"',
    'owner_agent: "general"',
    "",
  ].join("\n");
}

async function writePassport(
  workdir: string,
  featureId: string,
  fileName: string,
  yaml: string
): Promise<void> {
  const path = join(workdir, "workflow", "features", featureId, "tasks", fileName);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, yaml, "utf-8");
}

async function writeSchemaFixture(workdir: string): Promise<void> {
  const schema = await readFile(REPO_SCHEMA_PATH, "utf-8");
  const target = join(
    workdir,
    "workflow",
    "schemas",
    "task-passport.schema.yaml"
  );
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, schema, "utf-8");
}

beforeEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(TEST_DIR, { recursive: true });
  await writeSchemaFixture(TEST_DIR);
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("deterministic dispatch builder", () => {
  test("builds deterministic waves with dependency and conflict handling", async () => {
    const ctx = makeCtx(TEST_DIR);
    const init = asJson(
      await wf_feature_init.execute({ title: "Dispatch Runner Feature" }, ctx)
    );
    const featureId = init.feature_id as string;

    await writePassport(
      TEST_DIR,
      featureId,
      "task-001-core.yaml",
      passportYaml({
        taskId: "task-001-core",
        goal: "Create core module",
        inputs: [],
        outputs: [{ path: "src/core.ts", type: "create" }],
      })
    );

    await writePassport(
      TEST_DIR,
      featureId,
      "task-002-api.yaml",
      passportYaml({
        taskId: "task-002-api",
        goal: "Build api from core",
        inputs: ["src/core.ts"],
        outputs: [{ path: "src/api.ts", type: "create" }],
      })
    );

    await writePassport(
      TEST_DIR,
      featureId,
      "task-003-ui.yaml",
      passportYaml({
        taskId: "task-003-ui",
        goal: "Create ui",
        inputs: [],
        outputs: [{ path: "src/ui.ts", type: "create" }],
      })
    );

    await writePassport(
      TEST_DIR,
      featureId,
      "task-004-ui-style.yaml",
      passportYaml({
        taskId: "task-004-ui-style",
        goal: "Style ui",
        inputs: [],
        outputs: [{ path: "src/ui.ts", type: "modify" }],
      })
    );

    const first = asJson(await wf_dispatch_build.execute({ feature_id: featureId }, ctx));
    expect(first.success).toBe(true);

    const second = asJson(await wf_dispatch_build.execute({ feature_id: featureId }, ctx));
    expect(second.success).toBe(true);

    expect(second.plan.waves).toEqual(first.plan.waves);

    const waveByTask = new Map<string, number>();
    for (const wave of first.plan.waves as Array<{ index: number; task_ids: string[] }>) {
      for (const taskId of wave.task_ids) {
        waveByTask.set(taskId, wave.index);
      }
    }

    expect(waveByTask.get("task-001-core")! < waveByTask.get("task-002-api")!).toBe(
      true
    );
    expect(
      waveByTask.get("task-003-ui") !== waveByTask.get("task-004-ui-style")
    ).toBe(true);

    const savedPlanRaw = await readFile(join(TEST_DIR, first.plan_path), "utf-8");
    const savedPlan = JSON.parse(savedPlanRaw);
    expect(savedPlan.waves.length).toBe(first.plan.waves.length);
  });

  test("infers dependencies from input task-passport paths", async () => {
    const ctx = makeCtx(TEST_DIR);
    const init = asJson(
      await wf_feature_init.execute({ title: "Path Dependency Inference Feature" }, ctx)
    );
    const featureId = init.feature_id as string;

    const upstreamFile = "task-001-upstream.yaml";
    const downstreamFile = "task-002-downstream.yaml";

    await writePassport(
      TEST_DIR,
      featureId,
      upstreamFile,
      passportYaml({
        taskId: "task-001-upstream",
        goal: "Create upstream task",
        inputs: [],
        outputs: [{ path: "src/upstream.ts", type: "create" }],
      })
    );

    await writePassport(
      TEST_DIR,
      featureId,
      downstreamFile,
      passportYaml({
        taskId: "task-002-downstream",
        goal: "Depends on upstream passport path",
        inputs: [
          `workflow/features/${featureId}/tasks/${upstreamFile}`,
        ],
        outputs: [{ path: "src/downstream.ts", type: "create" }],
      })
    );

    const dispatch = asJson(await wf_dispatch_build.execute({ feature_id: featureId }, ctx));
    expect(dispatch.success).toBe(true);

    const tasks = dispatch.plan.tasks as Array<{ task_id: string; dependencies: string[] }>;
    const downstream = tasks.find((t) => t.task_id === "task-002-downstream");
    expect(downstream).toBeDefined();
    expect(downstream!.dependencies).toContain("task-001-upstream");

    const waveByTask = new Map<string, number>();
    for (const wave of dispatch.plan.waves as Array<{ index: number; task_ids: string[] }>) {
      for (const taskId of wave.task_ids) {
        waveByTask.set(taskId, wave.index);
      }
    }

    expect(waveByTask.get("task-001-upstream")! < waveByTask.get("task-002-downstream")!).toBe(
      true
    );
  });

  test("accepts explicit depends_on dependencies", async () => {
    const ctx = makeCtx(TEST_DIR);
    const init = asJson(
      await wf_feature_init.execute({ title: "Explicit Depends On Feature" }, ctx)
    );
    const featureId = init.feature_id as string;

    await writePassport(
      TEST_DIR,
      featureId,
      "task-001-base.yaml",
      passportYaml({
        taskId: "task-001-base",
        goal: "Base task",
        inputs: [],
        outputs: [{ path: "src/base.ts", type: "create" }],
      })
    );

    await writePassport(
      TEST_DIR,
      featureId,
      "task-002-dependent.yaml",
      passportYaml({
        taskId: "task-002-dependent",
        goal: "Depends on base through explicit depends_on",
        inputs: [],
        dependsOn: ["task-001-base"],
        outputs: [{ path: "src/dependent.ts", type: "create" }],
      })
    );

    const dispatch = asJson(await wf_dispatch_build.execute({ feature_id: featureId }, ctx));
    expect(dispatch.success).toBe(true);

    const tasks = dispatch.plan.tasks as Array<{ task_id: string; dependencies: string[] }>;
    const dependent = tasks.find((t) => t.task_id === "task-002-dependent");
    expect(dependent).toBeDefined();
    expect(dependent!.dependencies).toContain("task-001-base");
  });

  test("rejects passports that violate required schema fields", async () => {
    const ctx = makeCtx(TEST_DIR);
    const init = asJson(
      await wf_feature_init.execute({ title: "Invalid Passport Feature" }, ctx)
    );
    const featureId = init.feature_id as string;

    const invalidPassport = [
      'task_id: "task-invalid"',
      'goal: "Invalid task missing required fields"',
      "inputs:",
      '  - path: "README.md"',
      '    description: "input"',
      "outputs:",
      '  - path: "src/invalid.ts"',
      '    type: "create"',
      "gates:",
      '  - name: "task-gate"',
      '    check: "true"',
      "",
    ].join("\n");

    await writePassport(TEST_DIR, featureId, "task-invalid.yaml", invalidPassport);

    const result = asJson(await wf_dispatch_build.execute({ feature_id: featureId }, ctx));
    expect(result.error).toContain("allowed_tools is required");
  });
});

describe("deterministic runner state", () => {
  test("initializes runner and advances waves in deterministic order", async () => {
    const ctx = makeCtx(TEST_DIR);
    const init = asJson(
      await wf_feature_init.execute({ title: "Runner Feature" }, ctx)
    );
    const featureId = init.feature_id as string;

    await writePassport(
      TEST_DIR,
      featureId,
      "task-001-a.yaml",
      passportYaml({
        taskId: "task-001-a",
        goal: "A",
        inputs: [],
        outputs: [{ path: "src/a.ts", type: "create" }],
      })
    );

    await writePassport(
      TEST_DIR,
      featureId,
      "task-002-b.yaml",
      passportYaml({
        taskId: "task-002-b",
        goal: "B depends on A",
        inputs: ["src/a.ts"],
        outputs: [{ path: "src/b.ts", type: "create" }],
      })
    );

    const dispatch = asJson(await wf_dispatch_build.execute({ feature_id: featureId }, ctx));
    expect(dispatch.success).toBe(true);

    const runnerInit = asJson(await wf_runner_init.execute({ feature_id: featureId }, ctx));
    expect(runnerInit.success).toBe(true);

    const firstClaim = asJson(await wf_runner_next.execute({ feature_id: featureId }, ctx));
    expect(firstClaim.success).toBe(true);
    expect(firstClaim.task_ids).toEqual(["task-001-a"]);

    const completeA = asJson(
      await wf_runner_mark.execute(
        {
          feature_id: featureId,
          task_id: "task-001-a",
          status: "completed",
        },
        ctx
      )
    );
    expect(completeA.success).toBe(true);

    const secondClaim = asJson(await wf_runner_next.execute({ feature_id: featureId }, ctx));
    expect(secondClaim.task_ids).toEqual(["task-002-b"]);

    await wf_runner_mark.execute(
      {
        feature_id: featureId,
        task_id: "task-002-b",
        status: "completed",
      },
      ctx
    );

    const doneStatus = asJson(await wf_runner_status.execute({ feature_id: featureId }, ctx));
    expect(doneStatus.status).toBe("completed");
    expect(doneStatus.counts.completed).toBe(2);
  });
});
