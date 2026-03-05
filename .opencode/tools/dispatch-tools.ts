import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import { tool } from "@opencode-ai/plugin/tool";
import { readState } from "../state";

type PassportPathItem = {
  path: string;
  description?: string;
};

type PassportOutputItem = {
  path: string;
  type: "create" | "modify" | "test";
};

type PassportGate = {
  name: string;
  check: string;
};

type PassportAllowedTool = {
  tool_name: string;
};

type PassportDodItem = {
  criterion: string;
};

type RawTaskPassport = {
  task_id: string;
  goal: string;
  inputs: PassportPathItem[];
  outputs: PassportOutputItem[];
  allowed_tools: PassportAllowedTool[];
  gates: PassportGate[];
  dod: PassportDodItem[];
  owner_agent: string;
  depends_on?: string[];
};

type SchemaNode = {
  type?: "object" | "array" | "string";
  required?: string[];
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  additionalProperties?: boolean;
  enum?: string[];
  pattern?: string;
};

type DispatchTask = {
  task_id: string;
  goal: string;
  source_path: string;
  inputs: string[];
  dependencies: string[];
  outputs: string[];
  gates: PassportGate[];
};

type DispatchWave = {
  index: number;
  task_ids: string[];
};

type DispatchConflict = {
  task_a: string;
  task_b: string;
  shared_outputs: string[];
};

type DispatchPlan = {
  version: "1.0";
  feature_id: string;
  generated_at: string;
  tasks: DispatchTask[];
  waves: DispatchWave[];
  conflicts: DispatchConflict[];
};

type RunnerTaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped";

type RunnerTaskState = {
  task_id: string;
  wave_index: number;
  dependencies: string[];
  status: RunnerTaskStatus;
  started_at: string | null;
  finished_at: string | null;
  notes: string[];
};

type RunnerState = {
  version: "1.0";
  feature_id: string;
  status: "in_progress" | "failed" | "completed";
  initialized_at: string;
  updated_at: string;
  plan_path: string;
  waves: DispatchWave[];
  tasks: Record<string, RunnerTaskState>;
};

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, "/");
}

function defaultTasksDir(featureId: string): string {
  return `workflow/features/${featureId}/tasks`;
}

function defaultDispatchJson(featureId: string): string {
  return `workflow/features/${featureId}/dispatch/dispatch-plan.generated.json`;
}

function defaultDispatchMarkdown(featureId: string): string {
  return `workflow/features/${featureId}/dispatch/dispatch-plan.generated.md`;
}

function defaultPassportSchemaPath(): string {
  return "workflow/schemas/task-passport.schema.yaml";
}

function defaultRunnerStatePath(featureId: string): string {
  return `workflow/features/${featureId}/implement/runner-state.json`;
}

async function resolveFeatureId(
  worktree: string,
  featureId?: string
): Promise<string | null> {
  const state = await readState(worktree);
  return featureId ?? state.active_feature;
}

function outputOverlap(a: DispatchTask, b: DispatchTask): string[] {
  const setA = new Set(a.outputs);
  return b.outputs.filter((path) => setA.has(path));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateSchemaNode(
  value: unknown,
  schema: SchemaNode,
  path: string,
  errors: string[]
): void {
  if (schema.type === "object") {
    if (!isPlainObject(value)) {
      errors.push(`${path} must be an object`);
      return;
    }

    const properties = schema.properties ?? {};
    const objectValue = value;

    for (const key of schema.required ?? []) {
      if (!(key in objectValue)) {
        errors.push(`${path}.${key} is required`);
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(objectValue)) {
        if (!(key in properties)) {
          errors.push(`${path}.${key} is not allowed`);
        }
      }
    }

    for (const [key, nestedSchema] of Object.entries(properties)) {
      if (key in objectValue) {
        validateSchemaNode(objectValue[key], nestedSchema, `${path}.${key}`, errors);
      }
    }
    return;
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${path} must be an array`);
      return;
    }

    if (schema.items) {
      value.forEach((item, index) => {
        validateSchemaNode(item, schema.items!, `${path}[${index}]`, errors);
      });
    }
    return;
  }

  if (schema.type === "string") {
    if (typeof value !== "string") {
      errors.push(`${path} must be a string`);
      return;
    }

    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`${path} must be one of: ${schema.enum.join(", ")}`);
    }

    if (schema.pattern) {
      let regex: RegExp;
      try {
        regex = new RegExp(schema.pattern);
      } catch {
        errors.push(`${path} uses invalid schema regex pattern`);
        return;
      }

      if (!regex.test(value)) {
        errors.push(`${path} does not match pattern ${schema.pattern}`);
      }
    }
  }
}

async function loadPassportSchema(
  worktree: string,
  schemaPathRel: string
): Promise<SchemaNode> {
  let raw: string;
  try {
    raw = await readFile(join(worktree, schemaPathRel), "utf-8");
  } catch {
    throw new Error(`Task passport schema not found: '${schemaPathRel}'`);
  }

  const parsed = parseYaml(raw);
  if (!isPlainObject(parsed)) {
    throw new Error(
      `Invalid task passport schema at '${schemaPathRel}': root must be an object`
    );
  }

  return parsed as SchemaNode;
}

function buildMarkdown(plan: DispatchPlan): string {
  const lines: string[] = [];
  lines.push("# Generated Dispatch Plan");
  lines.push("");
  lines.push(`- Feature: ${plan.feature_id}`);
  lines.push(`- Generated at: ${plan.generated_at}`);
  lines.push(`- Tasks: ${plan.tasks.length}`);
  lines.push(`- Waves: ${plan.waves.length}`);
  lines.push("");

  lines.push("## Waves");
  for (const wave of plan.waves) {
    lines.push(`### Wave ${wave.index}`);
    for (const taskId of wave.task_ids) {
      lines.push(`- ${taskId}`);
    }
    lines.push("");
  }

  lines.push("## Tasks");
  lines.push("| Task | Dependencies | Outputs | Gates |");
  lines.push("|------|--------------|---------|-------|");
  for (const task of plan.tasks) {
    lines.push(
      `| ${task.task_id} | ${task.dependencies.join(", ") || "-"} | ${task.outputs.join(", ") || "-"} | ${task.gates.map((g) => g.name).join(", ") || "-"} |`
    );
  }
  lines.push("");

  if (plan.conflicts.length > 0) {
    lines.push("## Output Conflicts");
    lines.push("| Task A | Task B | Shared Outputs |");
    lines.push("|--------|--------|----------------|");
    for (const conflict of plan.conflicts) {
      lines.push(
        `| ${conflict.task_a} | ${conflict.task_b} | ${conflict.shared_outputs.join(", ")} |`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function loadTaskPassports(
  worktree: string,
  featureId: string,
  tasksDirRel: string,
  schemaPathRel: string
): Promise<DispatchTask[]> {
  const schema = await loadPassportSchema(worktree, schemaPathRel);
  const tasksDir = join(worktree, tasksDirRel);
  let fileNames: string[];
  try {
    fileNames = await readdir(tasksDir);
  } catch {
    throw new Error(`Tasks directory not found: ${tasksDirRel}`);
  }

  const yamlFiles = fileNames
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort((a, b) => a.localeCompare(b));

  const tasks: DispatchTask[] = [];
  for (const fileName of yamlFiles) {
    const relativePath = `${tasksDirRel}/${fileName}`;
    const raw = await readFile(join(worktree, relativePath), "utf-8");
    const parsed = parseYaml(raw);

    const validationErrors: string[] = [];
    validateSchemaNode(parsed, schema, "passport", validationErrors);
    if (validationErrors.length > 0) {
      throw new Error(
        `Invalid passport '${relativePath}': ${validationErrors.join("; ")}`
      );
    }

    const typed = parsed as RawTaskPassport;

    if (!typed || typeof typed.task_id !== "string" || !typed.task_id.trim()) {
      throw new Error(`Invalid passport '${relativePath}': missing task_id`);
    }

    if (!Array.isArray(typed.outputs) || typed.outputs.length === 0) {
      throw new Error(`Invalid passport '${relativePath}': outputs must be non-empty`);
    }

    const outputs = typed.outputs.map((output) => normalizePath(output.path));
    const inputs = typed.inputs.map((input) => normalizePath(input.path));
    const gates = Array.isArray(typed.gates) ? typed.gates : [];

    tasks.push({
      task_id: typed.task_id,
      goal: typed.goal,
      source_path: relativePath,
      inputs,
      dependencies: Array.isArray(typed.depends_on)
        ? typed.depends_on.map((value) => value.trim()).filter(Boolean)
        : [],
      outputs,
      gates,
    });
  }

  if (tasks.length === 0) {
    throw new Error(`No YAML task passports found in '${tasksDirRel}'.`);
  }

  const idSet = new Set<string>();
  for (const task of tasks) {
    if (idSet.has(task.task_id)) {
      throw new Error(`Duplicate task_id '${task.task_id}' in task passports.`);
    }
    idSet.add(task.task_id);
  }

  const outputsByPath = new Map<string, string[]>();
  for (const task of tasks) {
    for (const output of task.outputs) {
      const list = outputsByPath.get(output) ?? [];
      list.push(task.task_id);
      outputsByPath.set(output, list);
    }
  }

  for (const task of tasks) {
    for (const inputPath of task.inputs) {
      const producers = outputsByPath.get(inputPath) ?? [];
      for (const producer of producers) {
        if (producer !== task.task_id) {
          task.dependencies.push(producer);
        }
      }
    }

    task.dependencies = [...new Set(task.dependencies)].sort((a, b) =>
      a.localeCompare(b)
    );
  }

  const knownIds = new Set(tasks.map((task) => task.task_id));
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (!knownIds.has(dep)) {
        throw new Error(
          `Task '${task.task_id}' depends on unknown task '${dep}'.`
        );
      }
    }
  }

  return tasks;
}

function buildDispatchPlan(featureId: string, tasks: DispatchTask[]): DispatchPlan {
  const tasksById = new Map(tasks.map((task) => [task.task_id, task]));

  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const task of tasks) {
    indegree.set(task.task_id, task.dependencies.length);
    for (const dep of task.dependencies) {
      const list = dependents.get(dep) ?? [];
      list.push(task.task_id);
      dependents.set(dep, list);
    }
  }

  const conflicts: DispatchConflict[] = [];
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const overlap = outputOverlap(tasks[i], tasks[j]);
      if (overlap.length > 0) {
        conflicts.push({
          task_a: tasks[i].task_id,
          task_b: tasks[j].task_id,
          shared_outputs: overlap,
        });
      }
    }
  }

  const remaining = new Set(tasks.map((task) => task.task_id));
  const waves: DispatchWave[] = [];

  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter((taskId) => (indegree.get(taskId) ?? 0) === 0)
      .sort((a, b) => a.localeCompare(b));

    if (ready.length === 0) {
      throw new Error(
        `Task dependency cycle detected among: ${[...remaining].join(", ")}`
      );
    }

    const waveTaskIds: string[] = [];
    const waveOutputs = new Set<string>();
    for (const taskId of ready) {
      const task = tasksById.get(taskId)!;
      const conflictsWithWave = task.outputs.some((output) =>
        waveOutputs.has(output)
      );

      if (!conflictsWithWave) {
        waveTaskIds.push(taskId);
        for (const output of task.outputs) {
          waveOutputs.add(output);
        }
      }
    }

    if (waveTaskIds.length === 0) {
      waveTaskIds.push(ready[0]);
    }

    waves.push({
      index: waves.length,
      task_ids: waveTaskIds,
    });

    for (const taskId of waveTaskIds) {
      remaining.delete(taskId);
      const deps = dependents.get(taskId) ?? [];
      for (const depTask of deps) {
        indegree.set(depTask, (indegree.get(depTask) ?? 0) - 1);
      }
    }
  }

  return {
    version: "1.0",
    feature_id: featureId,
    generated_at: new Date().toISOString(),
    tasks: tasks
      .slice()
      .sort((a, b) => a.task_id.localeCompare(b.task_id)),
    waves,
    conflicts,
  };
}

async function writeDispatchArtifacts(
  worktree: string,
  plan: DispatchPlan,
  jsonPathRel: string,
  markdownPathRel: string
): Promise<void> {
  const jsonPath = join(worktree, jsonPathRel);
  const markdownPath = join(worktree, markdownPathRel);
  await mkdir(dirnameOf(jsonPath), { recursive: true });
  await mkdir(dirnameOf(markdownPath), { recursive: true });

  await writeFile(jsonPath, JSON.stringify(plan, null, 2) + "\n", "utf-8");
  await writeFile(markdownPath, buildMarkdown(plan), "utf-8");
}

function dirnameOf(path: string): string {
  const idx = path.lastIndexOf("/");
  if (idx < 0) return ".";
  return path.slice(0, idx);
}

async function readRunnerState(
  worktree: string,
  runnerStateRel: string
): Promise<RunnerState> {
  const raw = await readFile(join(worktree, runnerStateRel), "utf-8");
  return JSON.parse(raw) as RunnerState;
}

async function writeRunnerState(
  worktree: string,
  runnerStateRel: string,
  state: RunnerState
): Promise<void> {
  const absolute = join(worktree, runnerStateRel);
  await mkdir(dirnameOf(absolute), { recursive: true });
  await writeFile(absolute, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

function runnerCounts(state: RunnerState): Record<RunnerTaskStatus, number> {
  const counts: Record<RunnerTaskStatus, number> = {
    pending: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  };

  for (const task of Object.values(state.tasks)) {
    counts[task.status] += 1;
  }

  return counts;
}

function nextWaveWithWork(state: RunnerState): DispatchWave | null {
  for (const wave of state.waves) {
    const statuses = wave.task_ids.map((taskId) => state.tasks[taskId].status);
    const hasPending = statuses.includes("pending");
    const hasInProgress = statuses.includes("in_progress");
    if (hasPending || hasInProgress) {
      return wave;
    }
  }
  return null;
}

export const wf_dispatch_build = tool({
  description:
    "Build a deterministic dispatch plan from YAML task passports using dependency analysis and output conflict constraints.",
  args: {
    feature_id: tool.schema
      .string()
      .optional()
      .describe("Feature ID. If omitted, uses active feature."),
    tasks_dir_rel: tool.schema
      .string()
      .optional()
      .describe("Optional tasks directory relative to repository root."),
    schema_path_rel: tool.schema
      .string()
      .optional()
      .describe("Optional task passport schema path relative to repository root."),
    output_json_rel: tool.schema
      .string()
      .optional()
      .describe("Optional output path for generated dispatch plan JSON."),
    output_markdown_rel: tool.schema
      .string()
      .optional()
      .describe("Optional output path for generated dispatch plan markdown."),
  },
  async execute(args, ctx) {
    const featureId = await resolveFeatureId(ctx.worktree, args.feature_id);
    if (!featureId) {
      return JSON.stringify({
        error: "No active feature. Use wf_feature_init to create one.",
      });
    }

    const tasksDirRel = args.tasks_dir_rel ?? defaultTasksDir(featureId);
    const schemaPathRel = args.schema_path_rel ?? defaultPassportSchemaPath();

    try {
      const tasks = await loadTaskPassports(
        ctx.worktree,
        featureId,
        tasksDirRel,
        schemaPathRel
      );
      const plan = buildDispatchPlan(featureId, tasks);

      const planPath = args.output_json_rel ?? defaultDispatchJson(featureId);
      const markdownPath =
        args.output_markdown_rel ?? defaultDispatchMarkdown(featureId);

      await writeDispatchArtifacts(
        ctx.worktree,
        plan,
        planPath,
        markdownPath
      );

      return JSON.stringify({
        success: true,
        feature_id: featureId,
        schema_path: schemaPathRel,
        plan_path: planPath,
        markdown_path: markdownPath,
        plan,
      });
    } catch (error) {
      return JSON.stringify({
        error: String(error),
      });
    }
  },
});

export const wf_runner_init = tool({
  description:
    "Initialize deterministic implementation runner state from generated dispatch plan.",
  args: {
    feature_id: tool.schema
      .string()
      .optional()
      .describe("Feature ID. If omitted, uses active feature."),
    plan_path_rel: tool.schema
      .string()
      .optional()
      .describe("Dispatch plan JSON path relative to repository root."),
    runner_state_path_rel: tool.schema
      .string()
      .optional()
      .describe("Runner state path relative to repository root."),
  },
  async execute(args, ctx) {
    const featureId = await resolveFeatureId(ctx.worktree, args.feature_id);
    if (!featureId) {
      return JSON.stringify({
        error: "No active feature. Use wf_feature_init to create one.",
      });
    }

    const planPath = args.plan_path_rel ?? defaultDispatchJson(featureId);
    const statePath = args.runner_state_path_rel ?? defaultRunnerStatePath(featureId);

    let plan: DispatchPlan;
    try {
      plan = JSON.parse(await readFile(join(ctx.worktree, planPath), "utf-8"));
    } catch {
      return JSON.stringify({
        error: `Dispatch plan not found at '${planPath}'. Run wf_dispatch_build first.`,
      });
    }

    const waveByTask = new Map<string, number>();
    for (const wave of plan.waves) {
      for (const taskId of wave.task_ids) {
        waveByTask.set(taskId, wave.index);
      }
    }

    const now = new Date().toISOString();
    const state: RunnerState = {
      version: "1.0",
      feature_id: featureId,
      status: "in_progress",
      initialized_at: now,
      updated_at: now,
      plan_path: planPath,
      waves: plan.waves,
      tasks: {},
    };

    for (const task of plan.tasks) {
      state.tasks[task.task_id] = {
        task_id: task.task_id,
        wave_index: waveByTask.get(task.task_id) ?? -1,
        dependencies: task.dependencies,
        status: "pending",
        started_at: null,
        finished_at: null,
        notes: [],
      };
    }

    await writeRunnerState(ctx.worktree, statePath, state);
    return JSON.stringify({
      success: true,
      feature_id: featureId,
      plan_path: planPath,
      runner_state_path: statePath,
      task_count: Object.keys(state.tasks).length,
      wave_count: state.waves.length,
    });
  },
});

export const wf_runner_next = tool({
  description:
    "Claim next deterministic runnable tasks from current wave. Claimed tasks move to in_progress.",
  args: {
    feature_id: tool.schema
      .string()
      .optional()
      .describe("Feature ID. If omitted, uses active feature."),
    runner_state_path_rel: tool.schema
      .string()
      .optional()
      .describe("Runner state path relative to repository root."),
  },
  async execute(args, ctx) {
    const featureId = await resolveFeatureId(ctx.worktree, args.feature_id);
    if (!featureId) {
      return JSON.stringify({
        error: "No active feature. Use wf_feature_init to create one.",
      });
    }

    const statePath = args.runner_state_path_rel ?? defaultRunnerStatePath(featureId);

    let state: RunnerState;
    try {
      state = await readRunnerState(ctx.worktree, statePath);
    } catch {
      return JSON.stringify({
        error: `Runner state not found at '${statePath}'. Run wf_runner_init first.`,
      });
    }

    if (state.status === "failed") {
      return JSON.stringify({
        success: false,
        status: "failed",
        message: "Runner is in failed state. Resolve failed task or reinitialize.",
      });
    }

    if (state.status === "completed") {
      return JSON.stringify({
        success: true,
        status: "completed",
        task_ids: [],
        done: true,
      });
    }

    for (const wave of state.waves) {
      const tasksInWave = wave.task_ids.map((taskId) => state.tasks[taskId]);
      if (tasksInWave.some((task) => task.status === "failed")) {
        state.status = "failed";
        state.updated_at = new Date().toISOString();
        await writeRunnerState(ctx.worktree, statePath, state);
        return JSON.stringify({
          success: false,
          status: "failed",
          wave_index: wave.index,
          message: "A task in this wave has failed.",
        });
      }

      const pending = tasksInWave.filter((task) => task.status === "pending");
      const inProgress = tasksInWave.filter(
        (task) => task.status === "in_progress"
      );

      if (pending.length === 0 && inProgress.length === 0) {
        continue;
      }

      if (pending.length === 0) {
        return JSON.stringify({
          success: true,
          status: "in_progress",
          wave_index: wave.index,
          task_ids: [],
          message: "Wave currently has in_progress tasks.",
        });
      }

      const ready = pending
        .filter((task) =>
          task.dependencies.every((depId) => {
            const dep = state.tasks[depId];
            return dep && (dep.status === "completed" || dep.status === "skipped");
          })
        )
        .sort((a, b) => a.task_id.localeCompare(b.task_id));

      if (ready.length === 0) {
        return JSON.stringify({
          success: false,
          status: "in_progress",
          wave_index: wave.index,
          task_ids: [],
          message:
            "No ready tasks in wave. Dependencies are incomplete or runner is in deadlock.",
        });
      }

      const now = new Date().toISOString();
      for (const task of ready) {
        task.status = "in_progress";
        if (!task.started_at) {
          task.started_at = now;
        }
      }

      state.updated_at = now;
      await writeRunnerState(ctx.worktree, statePath, state);

      return JSON.stringify({
        success: true,
        status: "in_progress",
        wave_index: wave.index,
        task_ids: ready.map((task) => task.task_id),
        done: false,
      });
    }

    state.status = "completed";
    state.updated_at = new Date().toISOString();
    await writeRunnerState(ctx.worktree, statePath, state);
    return JSON.stringify({
      success: true,
      status: "completed",
      task_ids: [],
      done: true,
    });
  },
});

export const wf_runner_mark = tool({
  description:
    "Mark a claimed task as completed, failed, or skipped in deterministic runner state.",
  args: {
    feature_id: tool.schema
      .string()
      .optional()
      .describe("Feature ID. If omitted, uses active feature."),
    runner_state_path_rel: tool.schema
      .string()
      .optional()
      .describe("Runner state path relative to repository root."),
    task_id: tool.schema.string().describe("Task ID to update."),
    status: tool.schema
      .enum(["completed", "failed", "skipped"])
      .describe("Final task status."),
    note: tool.schema
      .string()
      .optional()
      .describe("Optional note to attach to task history."),
  },
  async execute(args, ctx) {
    const featureId = await resolveFeatureId(ctx.worktree, args.feature_id);
    if (!featureId) {
      return JSON.stringify({
        error: "No active feature. Use wf_feature_init to create one.",
      });
    }

    const statePath = args.runner_state_path_rel ?? defaultRunnerStatePath(featureId);

    let state: RunnerState;
    try {
      state = await readRunnerState(ctx.worktree, statePath);
    } catch {
      return JSON.stringify({
        error: `Runner state not found at '${statePath}'. Run wf_runner_init first.`,
      });
    }

    const task = state.tasks[args.task_id];
    if (!task) {
      return JSON.stringify({
        error: `Task '${args.task_id}' not found in runner state.`,
      });
    }

    const terminal = new Set<RunnerTaskStatus>(["completed", "failed", "skipped"]);
    if (terminal.has(task.status)) {
      return JSON.stringify({
        error: `Task '${args.task_id}' already in terminal state '${task.status}'.`,
      });
    }

    const now = new Date().toISOString();
    task.status = args.status;
    task.finished_at = now;
    if (!task.started_at) {
      task.started_at = now;
    }

    if (args.note) {
      task.notes.push(args.note);
    }

    if (args.status === "failed") {
      state.status = "failed";
    } else {
      const values = Object.values(state.tasks);
      const allTerminal = values.every(
        (item) => item.status === "completed" || item.status === "skipped"
      );
      if (allTerminal) {
        state.status = "completed";
      }
    }

    state.updated_at = now;
    await writeRunnerState(ctx.worktree, statePath, state);

    return JSON.stringify({
      success: true,
      feature_id: featureId,
      task_id: args.task_id,
      status: args.status,
      runner_status: state.status,
      counts: runnerCounts(state),
    });
  },
});

export const wf_runner_status = tool({
  description:
    "Show deterministic runner summary including wave progress and task status counts.",
  args: {
    feature_id: tool.schema
      .string()
      .optional()
      .describe("Feature ID. If omitted, uses active feature."),
    runner_state_path_rel: tool.schema
      .string()
      .optional()
      .describe("Runner state path relative to repository root."),
  },
  async execute(args, ctx) {
    const featureId = await resolveFeatureId(ctx.worktree, args.feature_id);
    if (!featureId) {
      return JSON.stringify({
        error: "No active feature. Use wf_feature_init to create one.",
      });
    }

    const statePath = args.runner_state_path_rel ?? defaultRunnerStatePath(featureId);

    let state: RunnerState;
    try {
      state = await readRunnerState(ctx.worktree, statePath);
    } catch {
      return JSON.stringify({
        error: `Runner state not found at '${statePath}'. Run wf_runner_init first.`,
      });
    }

    const activeWave = nextWaveWithWork(state);
    return JSON.stringify({
      success: true,
      feature_id: featureId,
      state_path: statePath,
      status: state.status,
      active_wave_index: activeWave?.index ?? null,
      counts: runnerCounts(state),
      waves: state.waves,
    });
  },
});
