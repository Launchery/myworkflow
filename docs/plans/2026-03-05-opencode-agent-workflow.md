# OpenCode Agentic Workflow — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a deterministic, slash-command-driven workflow system for AI-assisted software development in OpenCode with 15 stages, quality gates, HR checkpoints, and full state management.

**Architecture:** Lightweight TS plugin (custom tools + command hook) for state/gates/artifacts orchestration. Rich markdown skills for stage domain logic. Slash commands defined in opencode.json config.

**Tech Stack:** TypeScript, Bun, @opencode-ai/plugin SDK, Zod for validation, YAML for task passports.

---

### Task 1: Project Setup — package.json and tsconfig

**Files:**
- Modify: `.opencode/package.json`
- Create: `.opencode/tsconfig.json`

**Step 1: Update package.json with proper fields and dependencies**

```json
{
  "name": "myworkflow-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "plugin.ts",
  "dependencies": {
    "@opencode-ai/plugin": "1.2.16"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": ".",
    "types": ["bun-types"]
  },
  "include": ["*.ts", "**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Install dependencies**

Run: `cd .opencode && bun install`
Expected: Dependencies installed, `bun.lock` created.

**Step 4: Commit**

```bash
git add .opencode/package.json .opencode/tsconfig.json
git commit -m "chore: setup project with TS config and dependencies"
```

---

### Task 2: Create Directory Structure

**Files:**
- Create: `workflow/state/.gitkeep`
- Create: `workflow/features/.gitkeep`
- Create: `workflow/schemas/.gitkeep`

**Step 1: Create workflow directories**

Run: `mkdir -p workflow/state workflow/features workflow/schemas`

**Step 2: Add .gitkeep files**

Run: `touch workflow/state/.gitkeep workflow/features/.gitkeep workflow/schemas/.gitkeep`

**Step 3: Commit**

```bash
git add workflow/
git commit -m "chore: create workflow directory structure"
```

---

### Task 3: Task Passport YAML Schema

**Files:**
- Create: `workflow/schemas/task-passport.schema.yaml`

**Step 1: Write the task passport schema**

```yaml
# Task Passport Schema v1.0
# Each task dispatched to a subagent must conform to this schema

type: object
required:
  - task_id
  - goal
  - inputs
  - outputs
  - gates
  - dod
properties:
  task_id:
    type: string
    description: Unique identifier for this task
    pattern: "^[a-z0-9-]+$"
  goal:
    type: string
    description: What this task achieves (one sentence)
  inputs:
    type: array
    description: Files and artifacts needed to execute this task
    items:
      type: object
      required: [path, description]
      properties:
        path:
          type: string
        description:
          type: string
  outputs:
    type: array
    description: Files this task will produce or modify
    items:
      type: object
      required: [path, type]
      properties:
        path:
          type: string
        type:
          type: string
          enum: [create, modify, test]
  allowed_tools:
    type: array
    description: Tools the subagent is permitted to use
    items:
      type: object
      required: [tool_name]
      properties:
        tool_name:
          type: string
  gates:
    type: array
    description: Quality gates that must pass
    items:
      type: object
      required: [name, check]
      properties:
        name:
          type: string
        check:
          type: string
          description: Command or validation to run
  dod:
    type: array
    description: Definition of Done criteria
    items:
      type: object
      required: [criterion]
      properties:
        criterion:
          type: string
  owner_agent:
    type: string
    description: Which agent type executes this task
    default: general
```

**Step 2: Commit**

```bash
git add workflow/schemas/task-passport.schema.yaml
git commit -m "feat: add task passport YAML schema"
```

---

### Task 4: Plugin — State Management Types and Helpers

**Files:**
- Create: `.opencode/types.ts`

**Step 1: Write TypeScript types for the data model**

```typescript
// Workflow State Types

export interface WorkflowState {
  version: string;
  active_feature: string | null;
  features: Record<string, FeatureRun>;
}

export interface FeatureRun {
  feature_id: string;
  title: string;
  created_at: string;
  status: "in_progress" | "completed" | "failed" | "cancelled";
  current_stage: StageId;
  stages: Partial<Record<StageId, StageExecution>>;
}

export type StageId =
  | "discover"
  | "spike"
  | "arch"
  | "spec"
  | "plan"
  | "tasks"
  | "tooling"
  | "dispatch"
  | "implement"
  | "review"
  | "finish-branch"
  | "project-report"
  | "human-qa"
  | "debug"
  | "finish-report";

export interface StageExecution {
  stage_id: StageId;
  command: string;
  started_at: string;
  finished_at: string | null;
  result: "completed" | "failed" | "in_progress" | "skipped";
  diagnostics_path: string | null;
  artifacts: ArtifactRecord[];
  gates: GateResult[];
  approval: ApprovalRecord;
}

export interface ArtifactRecord {
  artifact_type: string;
  path: string;
  checksum: string;
  generated_at: string;
}

export interface GateResult {
  gate_name: string;
  status: "passed" | "failed" | "skipped";
  evidence_path: string | null;
  timestamp: string;
}

export interface ApprovalRecord {
  decision: "approved" | "rejected" | "pending" | "not_required";
  reviewer: string;
  timestamp: string;
  notes: string;
}

// Stage transition map
export const STAGE_ORDER: StageId[] = [
  "discover",
  "spike",
  "arch",
  "spec",
  "plan",
  "tasks",
  "tooling",
  "dispatch",
  "implement",
  "review",
  "finish-branch",
  "project-report",
  "human-qa",
  "debug",
  "finish-report",
];

// Stages that require HR approval before next stage
export const GOVERNED_STAGES: StageId[] = [
  "arch",
  "spec",
  "plan",
  "tasks",
  "tooling",
];

// Preconditions: what must be true to enter a stage
export const STAGE_PRECONDITIONS: Record<
  StageId,
  { stage: StageId; approved?: boolean }[]
> = {
  discover: [],
  spike: [{ stage: "discover" }],
  arch: [{ stage: "spike" }],
  spec: [{ stage: "arch", approved: true }],
  plan: [{ stage: "spec", approved: true }],
  tasks: [{ stage: "plan", approved: true }],
  tooling: [{ stage: "tasks", approved: true }],
  dispatch: [{ stage: "tooling", approved: true }],
  implement: [{ stage: "dispatch" }],
  review: [{ stage: "implement" }],
  "finish-branch": [{ stage: "review" }],
  "project-report": [{ stage: "finish-branch" }],
  "human-qa": [{ stage: "project-report" }],
  debug: [{ stage: "human-qa" }],
  "finish-report": [{ stage: "human-qa" }], // or debug.completed
};
```

**Step 2: Commit**

```bash
git add .opencode/types.ts
git commit -m "feat: add workflow state types and stage transition definitions"
```

---

### Task 5: Plugin — State Read/Write Helpers

**Files:**
- Create: `.opencode/state.ts`

**Step 1: Write state persistence helpers**

```typescript
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { WorkflowState, FeatureRun, StageId, StageExecution } from "./types";

const STATE_DIR = "workflow/state";
const STATE_FILE = "workflow_state.json";

function statePath(workdir: string): string {
  return join(workdir, STATE_DIR, STATE_FILE);
}

export function emptyState(): WorkflowState {
  return {
    version: "1.0",
    active_feature: null,
    features: {},
  };
}

export async function readState(workdir: string): Promise<WorkflowState> {
  const path = statePath(workdir);
  if (!existsSync(path)) {
    return emptyState();
  }
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as WorkflowState;
}

export async function writeState(
  workdir: string,
  state: WorkflowState
): Promise<void> {
  const dir = join(workdir, STATE_DIR);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const path = statePath(workdir);
  await writeFile(path, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

export function getActiveFeature(state: WorkflowState): FeatureRun | null {
  if (!state.active_feature) return null;
  return state.features[state.active_feature] ?? null;
}

export function getStage(
  feature: FeatureRun,
  stageId: StageId
): StageExecution | null {
  return feature.stages[stageId] ?? null;
}

export function newStageExecution(stageId: StageId): StageExecution {
  return {
    stage_id: stageId,
    command: `/wf.${stageId}`,
    started_at: new Date().toISOString(),
    finished_at: null,
    result: "in_progress",
    diagnostics_path: null,
    artifacts: [],
    gates: [],
    approval: {
      decision: "not_required",
      reviewer: "",
      timestamp: "",
      notes: "",
    },
  };
}
```

**Step 2: Commit**

```bash
git add .opencode/state.ts
git commit -m "feat: add state persistence helpers"
```

---

### Task 6: Plugin — Gate Checking Logic

**Files:**
- Create: `.opencode/gates.ts`

**Step 1: Write gate checking functions**

```typescript
import type {
  WorkflowState,
  FeatureRun,
  StageId,
} from "./types";
import { STAGE_PRECONDITIONS, GOVERNED_STAGES } from "./types";
import { getStage } from "./state";

export interface GateCheckResult {
  allowed: boolean;
  reason: string;
  missing_preconditions: string[];
}

export function checkStagePreconditions(
  feature: FeatureRun,
  targetStage: StageId
): GateCheckResult {
  const preconditions = STAGE_PRECONDITIONS[targetStage];
  const missing: string[] = [];

  for (const pre of preconditions) {
    const stage = getStage(feature, pre.stage);

    if (!stage || stage.result !== "completed") {
      missing.push(`Stage '${pre.stage}' must be completed`);
      continue;
    }

    if (pre.approved && stage.approval.decision !== "approved") {
      missing.push(
        `Stage '${pre.stage}' must be approved (current: ${stage.approval.decision})`
      );
    }
  }

  if (missing.length > 0) {
    return {
      allowed: false,
      reason: `Cannot enter stage '${targetStage}': preconditions not met.`,
      missing_preconditions: missing,
    };
  }

  return {
    allowed: true,
    reason: `All preconditions met for stage '${targetStage}'.`,
    missing_preconditions: [],
  };
}

export function isGovernedStage(stageId: StageId): boolean {
  return GOVERNED_STAGES.includes(stageId);
}

export function formatGateCheckResult(result: GateCheckResult): string {
  if (result.allowed) {
    return `GATE CHECK PASSED: ${result.reason}`;
  }
  const lines = [
    `GATE CHECK FAILED: ${result.reason}`,
    "",
    "Missing preconditions:",
    ...result.missing_preconditions.map((p) => `  - ${p}`),
  ];
  return lines.join("\n");
}
```

**Step 2: Commit**

```bash
git add .opencode/gates.ts
git commit -m "feat: add gate checking logic for stage transitions"
```

---

### Task 7: Plugin — Custom Tools (wf_state_read, wf_state_write)

**Files:**
- Create: `.opencode/tools/state-tools.ts`

**Step 1: Write state tools**

```typescript
import { tool } from "@opencode-ai/plugin/tool";
import { readState, writeState, getActiveFeature, newStageExecution } from "../state";
import { emptyState } from "../state";
import type { StageId } from "../types";
import { STAGE_ORDER } from "../types";

export const wf_state_read = tool({
  description:
    "Read the current workflow state. Returns the full state including active feature, stages, artifacts, gates, and approvals. Call this at the start of any workflow stage to understand the current context.",
  args: {
    feature_id: tool.schema
      .string()
      .optional()
      .describe(
        "Specific feature ID to read. If omitted, reads the active feature."
      ),
  },
  async execute(args, ctx) {
    const state = await readState(ctx.worktree);

    if (args.feature_id) {
      const feature = state.features[args.feature_id];
      if (!feature) {
        return JSON.stringify({
          error: `Feature '${args.feature_id}' not found`,
          available_features: Object.keys(state.features),
        });
      }
      return JSON.stringify({ state: { ...state, features: { [args.feature_id]: feature } } }, null, 2);
    }

    if (!state.active_feature) {
      return JSON.stringify({
        message: "No active feature. Use wf_feature_init to create one.",
        state,
      });
    }

    return JSON.stringify(state, null, 2);
  },
});

export const wf_state_write = tool({
  description:
    "Update the workflow state for a specific feature and stage. Use this to mark stages as started, completed, or failed.",
  args: {
    feature_id: tool.schema.string().describe("Feature ID to update"),
    stage_id: tool.schema
      .string()
      .describe("Stage ID to update (e.g., 'discover', 'spec', 'plan')"),
    action: tool.schema
      .enum(["start", "complete", "fail"])
      .describe("Action to perform on the stage"),
    diagnostics_path: tool.schema
      .string()
      .optional()
      .describe("Path to diagnostics file (for failed stages)"),
  },
  async execute(args, ctx) {
    const state = await readState(ctx.worktree);
    const feature = state.features[args.feature_id];

    if (!feature) {
      return JSON.stringify({ error: `Feature '${args.feature_id}' not found` });
    }

    const stageId = args.stage_id as StageId;

    if (args.action === "start") {
      feature.stages[stageId] = newStageExecution(stageId);
      feature.current_stage = stageId;
    } else if (args.action === "complete") {
      const stage = feature.stages[stageId];
      if (stage) {
        stage.result = "completed";
        stage.finished_at = new Date().toISOString();
      }
    } else if (args.action === "fail") {
      const stage = feature.stages[stageId];
      if (stage) {
        stage.result = "failed";
        stage.finished_at = new Date().toISOString();
        stage.diagnostics_path = args.diagnostics_path ?? null;
      }
    }

    await writeState(ctx.worktree, state);
    return JSON.stringify({
      success: true,
      action: args.action,
      stage: args.stage_id,
      feature: args.feature_id,
    });
  },
});
```

**Step 2: Commit**

```bash
git add .opencode/tools/state-tools.ts
git commit -m "feat: add wf_state_read and wf_state_write tools"
```

---

### Task 8: Plugin — Custom Tools (wf_gate_check, wf_gate_record)

**Files:**
- Create: `.opencode/tools/gate-tools.ts`

**Step 1: Write gate tools**

```typescript
import { tool } from "@opencode-ai/plugin/tool";
import { readState, writeState, getActiveFeature } from "../state";
import { checkStagePreconditions, formatGateCheckResult } from "../gates";
import type { StageId } from "../types";

export const wf_gate_check = tool({
  description:
    "Check if preconditions are met to enter a specific workflow stage. Returns whether the transition is allowed and what preconditions are missing.",
  args: {
    target_stage: tool.schema
      .string()
      .describe("The stage you want to transition to (e.g., 'spec', 'plan')"),
    feature_id: tool.schema
      .string()
      .optional()
      .describe("Feature ID. If omitted, uses the active feature."),
  },
  async execute(args, ctx) {
    const state = await readState(ctx.worktree);
    const featureId = args.feature_id ?? state.active_feature;

    if (!featureId) {
      return "No active feature. Use wf_feature_init to create one.";
    }

    const feature = state.features[featureId];
    if (!feature) {
      return `Feature '${featureId}' not found.`;
    }

    const result = checkStagePreconditions(
      feature,
      args.target_stage as StageId
    );
    return formatGateCheckResult(result);
  },
});

export const wf_gate_record = tool({
  description:
    "Record the result of a quality gate check for a specific stage. Use this after running a gate check (e.g., tests pass, lint clean, artifact valid).",
  args: {
    feature_id: tool.schema.string().describe("Feature ID"),
    stage_id: tool.schema.string().describe("Stage ID"),
    gate_name: tool.schema
      .string()
      .describe("Name of the gate (e.g., 'tests-pass', 'lint-clean')"),
    status: tool.schema
      .enum(["passed", "failed", "skipped"])
      .describe("Gate result"),
    evidence_path: tool.schema
      .string()
      .optional()
      .describe("Path to evidence file (test output, lint report, etc.)"),
  },
  async execute(args, ctx) {
    const state = await readState(ctx.worktree);
    const feature = state.features[args.feature_id];

    if (!feature) {
      return JSON.stringify({ error: `Feature '${args.feature_id}' not found` });
    }

    const stage = feature.stages[args.stage_id as StageId];
    if (!stage) {
      return JSON.stringify({
        error: `Stage '${args.stage_id}' not started for feature '${args.feature_id}'`,
      });
    }

    stage.gates.push({
      gate_name: args.gate_name,
      status: args.status,
      evidence_path: args.evidence_path ?? null,
      timestamp: new Date().toISOString(),
    });

    await writeState(ctx.worktree, state);
    return JSON.stringify({
      success: true,
      gate: args.gate_name,
      status: args.status,
    });
  },
});
```

**Step 2: Commit**

```bash
git add .opencode/tools/gate-tools.ts
git commit -m "feat: add wf_gate_check and wf_gate_record tools"
```

---

### Task 9: Plugin — Custom Tools (wf_artifact_register, wf_hr_record, wf_feature_init)

**Files:**
- Create: `.opencode/tools/artifact-tools.ts`
- Create: `.opencode/tools/feature-tools.ts`

**Step 1: Write artifact registration tool**

```typescript
// .opencode/tools/artifact-tools.ts
import { tool } from "@opencode-ai/plugin/tool";
import { readState, writeState } from "../state";
import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";
import type { StageId } from "../types";

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
      .describe("Relative path to the artifact file from project root"),
  },
  async execute(args, ctx) {
    const state = await readState(ctx.worktree);
    const feature = state.features[args.feature_id];

    if (!feature) {
      return JSON.stringify({ error: `Feature '${args.feature_id}' not found` });
    }

    const stage = feature.stages[args.stage_id as StageId];
    if (!stage) {
      return JSON.stringify({
        error: `Stage '${args.stage_id}' not started for feature '${args.feature_id}'`,
      });
    }

    // Compute checksum
    let checksum = "sha256:unknown";
    try {
      const content = await readFile(join(ctx.worktree, args.path), "utf-8");
      const hash = createHash("sha256").update(content).digest("hex");
      checksum = `sha256:${hash}`;
    } catch {
      // File might not exist yet or be binary
    }

    stage.artifacts.push({
      artifact_type: args.artifact_type,
      path: args.path,
      checksum,
      generated_at: new Date().toISOString(),
    });

    await writeState(ctx.worktree, state);
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
    feature_id: tool.schema.string().describe("Feature ID"),
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
    const state = await readState(ctx.worktree);
    const feature = state.features[args.feature_id];

    if (!feature) {
      return JSON.stringify({ error: `Feature '${args.feature_id}' not found` });
    }

    const stage = feature.stages[args.stage_id as StageId];
    if (!stage) {
      return JSON.stringify({
        error: `Stage '${args.stage_id}' not started for feature '${args.feature_id}'`,
      });
    }

    stage.approval = {
      decision: args.decision,
      reviewer: "user",
      timestamp: new Date().toISOString(),
      notes: args.notes ?? "",
    };

    await writeState(ctx.worktree, state);
    return JSON.stringify({
      success: true,
      stage: args.stage_id,
      decision: args.decision,
    });
  },
});
```

**Step 2: Write feature init tool**

```typescript
// .opencode/tools/feature-tools.ts
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
      .describe("Human-readable title for this feature (e.g., 'User Authentication')"),
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
    const featureDir = join(ctx.worktree, "workflow", "features", featureId);
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
```

**Step 3: Commit**

```bash
git add .opencode/tools/artifact-tools.ts .opencode/tools/feature-tools.ts
git commit -m "feat: add wf_artifact_register, wf_hr_record, and wf_feature_init tools"
```

---

### Task 10: Plugin — Main Entry Point

**Files:**
- Create: `.opencode/plugin.ts`

**Step 1: Write the main plugin file**

```typescript
import type { Plugin } from "@opencode-ai/plugin";
import { wf_state_read, wf_state_write } from "./tools/state-tools";
import { wf_gate_check, wf_gate_record } from "./tools/gate-tools";
import { wf_artifact_register, wf_hr_record } from "./tools/artifact-tools";
import { wf_feature_init } from "./tools/feature-tools";
import { readState, getActiveFeature } from "./state";
import { checkStagePreconditions, formatGateCheckResult, isGovernedStage } from "./gates";
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

const plugin: Plugin = async (input) => {
  return {
    // Register all custom tools
    tool: {
      wf_state_read,
      wf_state_write,
      wf_gate_check,
      wf_gate_record,
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
          {
            type: "text",
            text: [
              "## Workflow Error: No Active Feature",
              "",
              "No active feature found. You must first:",
              "1. Create a feature with `wf_feature_init` tool",
              "2. Or run `/wf.discover` to start a new feature workflow",
              "",
              `Current state: ${JSON.stringify(state, null, 2)}`,
            ].join("\n"),
          },
        ];
        return;
      }

      // If discover and no feature, that's fine — skill will init
      if (stageId === "discover" && !feature) {
        output.parts = [
          {
            type: "text",
            text: [
              "## Workflow Context",
              "",
              "Starting new feature discovery. No active feature yet.",
              "Use `wf_feature_init` tool to create a feature entry before proceeding.",
              "",
              `Workflow state: ${JSON.stringify(state, null, 2)}`,
            ].join("\n"),
          },
        ];
        return;
      }

      if (feature) {
        // Check preconditions
        const gateResult = checkStagePreconditions(feature, stageId);

        if (!gateResult.allowed) {
          output.parts = [
            {
              type: "text",
              text: [
                "## Workflow Error: Preconditions Not Met",
                "",
                formatGateCheckResult(gateResult),
                "",
                "Use `/wf.status` to see the current workflow state.",
                "Use `/wf.gates` to see all gate statuses.",
              ].join("\n"),
            },
          ];
          return;
        }

        // Inject workflow context
        const governed = isGovernedStage(stageId);
        const stageIndex = STAGE_ORDER.indexOf(stageId);
        const nextStage = stageIndex < STAGE_ORDER.length - 1
          ? STAGE_ORDER[stageIndex + 1]
          : null;

        output.parts = [
          {
            type: "text",
            text: [
              "## Workflow Context",
              "",
              `**Feature:** ${feature.feature_id} — ${feature.title}`,
              `**Current Stage:** ${stageId} (${stageIndex + 1}/${STAGE_ORDER.length})`,
              `**HR Required:** ${governed ? "Yes — must get approval before proceeding" : "No"}`,
              nextStage ? `**Next Stage:** /wf.${nextStage}` : "**Final Stage**",
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
              "- `wf_artifact_register` — register produced artifacts",
              "- `wf_hr_record` — record approval decisions",
              "",
              `### Current State`,
              "```json",
              JSON.stringify(feature, null, 2),
              "```",
            ].join("\n"),
          },
        ];
      }
    },
  };
};

export default plugin;
```

**Step 2: Commit**

```bash
git add .opencode/plugin.ts
git commit -m "feat: add main plugin entry point with command hook and tool registration"
```

---

### Task 11: OpenCode Config — Slash Commands

**Files:**
- Create: `opencode.json`

**Step 1: Write the opencode.json config with all 21 commands**

```json
{
  "commands": {
    "wf.discover": {
      "template": "Execute Stage 1: Discovery. Load and follow the wf-discover skill. Use wf_state_read to check state first. If no active feature exists, use wf_feature_init to create one. Then conduct a deep discovery interview to produce project-concept.md.",
      "description": "Stage 1: Discovery — deep interview to produce project-concept.md"
    },
    "wf.spike": {
      "template": "Execute Stage 2: Spike. Load and follow the wf-spike skill. Use wf_state_read to check state. Validate key technical assumptions and produce spike-report.md.",
      "description": "Stage 2: Spike — validate technical assumptions"
    },
    "wf.arch": {
      "template": "Execute Stage 3: Architecture. Load and follow the wf-arch skill. Use wf_state_read to check state. Design architecture and produce architecture.md and decisions.md. This is a governed stage — HR approval required.",
      "description": "Stage 3: Architecture — design and HR approval"
    },
    "wf.spec": {
      "template": "Execute Stage 4: Specification. Load and follow the wf-spec skill. Use wf_state_read to check state. Create detailed specification with acceptance criteria. This is a governed stage — HR approval required.",
      "description": "Stage 4: Specification — detailed spec with acceptance criteria"
    },
    "wf.plan": {
      "template": "Execute Stage 5: Plan. Load and follow the wf-plan skill. Use wf_state_read to check state. Create implementation plan with tasks and dependencies. This is a governed stage — HR approval required.",
      "description": "Stage 5: Plan — implementation plan with tasks"
    },
    "wf.tasks": {
      "template": "Execute Stage 6: Tasks. Load and follow the wf-tasks skill. Use wf_state_read to check state. Generate ABI task passports with goal, inputs, outputs, gates, and DoD. This is a governed stage — HR approval required.",
      "description": "Stage 6: Tasks — generate ABI task passports"
    },
    "wf.tooling": {
      "template": "Execute Stage 7: Tooling. Load and follow the wf-tooling skill. Use wf_state_read to check state. Execute the 5-step tooling mini-workflow: stack inference, web research, setup synthesis, capability check, HR review.",
      "description": "Stage 7: Tooling — stack inference, research, setup, verify"
    },
    "wf.dispatch": {
      "template": "Execute Stage 8: Dispatch. Load and follow the wf-dispatch skill. Use wf_state_read to check state. Analyze task passports and create dispatch plan with parallelism strategy.",
      "description": "Stage 8: Dispatch — plan subagent task execution"
    },
    "wf.implement": {
      "template": "Execute Stage 9: Implement. Load and follow the wf-implement skill. Use wf_state_read to check state. Execute SDD+TDD: dispatch subagents by task passports, enforce test-first and mandatory gates.",
      "description": "Stage 9: Implement — SDD+TDD execution via subagents"
    },
    "wf.review": {
      "template": "Execute Stage 10: Review. Load and follow the wf-review skill. Use wf_state_read to check state. Conduct code review: structural analysis, consistency, test coverage.",
      "description": "Stage 10: Review — code review and analysis"
    },
    "wf.finish-branch": {
      "template": "Execute Stage 11: Finish Branch. Load and follow the wf-finish-branch skill. Use wf_state_read to check state. Finalize development branch: cleanup, squash/rebase, PR prep.",
      "description": "Stage 11: Finish Branch — finalize dev branch"
    },
    "wf.project-report": {
      "template": "Execute Stage 12: Project Report. Load and follow the wf-project-report skill. Use wf_state_read to check state. Generate skill-report.md and human-qa-plan.md.",
      "description": "Stage 12: Project Report — generate Skill.md and QA plan"
    },
    "wf.human-qa": {
      "template": "Execute Stage 13: Human QA. Load and follow the wf-human-qa skill. Use wf_state_read to check state. Guide user through smoke + critical-path QA on localhost.",
      "description": "Stage 13: Human QA — guided localhost testing"
    },
    "wf.debug": {
      "template": "Execute Stage 14: Debug. Load and follow the wf-debug skill. Use wf_state_read to check state. Run bounded debug loop: diagnose, fix, verify. Max 5 iterations.",
      "description": "Stage 14: Debug — bounded debug loop"
    },
    "wf.finish-report": {
      "template": "Execute Stage 15: Finish Report. Load and follow the wf-finish-report skill. Use wf_state_read to check state. Generate final executive report summarizing what was built.",
      "description": "Stage 15: Finish Report — executive summary"
    },
    "wf.status": {
      "template": "Show the current workflow status. Use wf_state_read to read the full state. Present a clear summary: active feature, current stage, gate statuses, approval statuses, and next available command.",
      "description": "Service: Show current workflow status"
    },
    "wf.resume": {
      "template": "Resume the workflow from the last interruption point. Use wf_state_read to find the last stage with result 'failed' or 'in_progress'. Restore context from artifacts and state, then continue execution of that stage.",
      "description": "Service: Resume from last interruption"
    },
    "wf.gates": {
      "template": "Show all gate statuses for the active feature. Use wf_state_read to read state. Present a table of all stages with their gate check results, approval statuses, and any missing preconditions.",
      "description": "Service: Show gate statuses"
    },
    "wf.history": {
      "template": "Show the history of feature runs. Use wf_state_read to read the full state. Present all features with their status, stages completed, and timestamps.",
      "description": "Service: Show feature run history"
    },
    "wf.approve": {
      "template": "Manually approve a workflow stage. The user will specify which stage. Use wf_hr_record to record the approval. Args: stage name.",
      "description": "Service: Manually approve a stage"
    },
    "wf.reject": {
      "template": "Manually reject a workflow stage. The user will specify which stage and reason. Use wf_hr_record to record the rejection. Args: stage name, reason.",
      "description": "Service: Manually reject a stage"
    }
  }
}
```

**Step 2: Commit**

```bash
git add opencode.json
git commit -m "feat: add opencode.json with all 21 slash commands"
```

---

### Task 12: Skill — wf-discover (adapted from discovery-interview)

**Files:**
- Create: `.opencode/skill/wf-discover/SKILL.md`

**Step 1: Write the discover skill**

The skill adapts the existing discovery-interview with workflow state integration. It should:
- Start with `wf_state_read` and `wf_feature_init` if needed
- Call `wf_state_write` to start the stage
- Conduct deep discovery interview (phases 1-6 from discovery-interview)
- Output: `workflow/features/<id>/discover/project-concept.md`
- Call `wf_artifact_register`
- Call `wf_gate_record` for completeness check
- Call `wf_state_write` to complete the stage

Full content: ~200-300 lines of markdown instructions combining discovery-interview logic with workflow integration protocol.

**Step 2: Commit**

```bash
git add .opencode/skill/wf-discover/SKILL.md
git commit -m "feat: add wf-discover skill (adapted from discovery-interview)"
```

---

### Task 13: Skill — wf-spike

**Files:**
- Create: `.opencode/skill/wf-spike/SKILL.md`

**Step 1: Write the spike skill**

The skill should:
- Read state, start stage
- Read project-concept.md from discover stage
- Identify key technical risks/assumptions
- Formulate hypotheses to validate
- Conduct spike experiments (prototype code, research, benchmarks)
- Document findings: what worked, what didn't, risks identified
- Output: `workflow/features/<id>/spike/spike-report.md`
- Register artifact, record gates, complete stage

**Step 2: Commit**

```bash
git add .opencode/skill/wf-spike/SKILL.md
git commit -m "feat: add wf-spike skill"
```

---

### Task 14: Skill — wf-arch

**Files:**
- Create: `.opencode/skill/wf-arch/SKILL.md`

**Step 1: Write the architecture skill**

The skill should:
- Read state, start stage
- Read project-concept.md and spike-report.md
- Design system architecture: components, responsibilities, interfaces
- Document data flow and key interactions
- Create ADRs for significant decisions
- Output: `architecture.md`, `decisions.md`
- Register artifacts, record gates
- **HR Checkpoint**: present architecture summary, ask user to approve/reject
- Record HR decision, complete stage

**Step 2: Commit**

```bash
git add .opencode/skill/wf-arch/SKILL.md
git commit -m "feat: add wf-arch skill with HR checkpoint"
```

---

### Task 15: Skill — wf-spec

**Files:**
- Create: `.opencode/skill/wf-spec/SKILL.md`

**Step 1: Write the specification skill**

The skill should:
- Read state, start stage
- Read all prior artifacts (concept, spike, architecture)
- Generate detailed specification with:
  - Functional requirements (P0/P1/P2) with acceptance criteria
  - Non-functional requirements with measurable metrics
  - Data model details
  - API contracts (if applicable)
  - Error handling specification
  - Security requirements
- Output: `specification.md`
- Register artifact, record gates
- **HR Checkpoint**: present spec summary, ask approve/reject
- Complete stage

**Step 2: Commit**

```bash
git add .opencode/skill/wf-spec/SKILL.md
git commit -m "feat: add wf-spec skill with HR checkpoint"
```

---

### Task 16: Skill — wf-plan

**Files:**
- Create: `.opencode/skill/wf-plan/SKILL.md`

**Step 1: Write the plan skill**

The skill should:
- Read state, start stage
- Read specification and architecture artifacts
- Create implementation plan following writing-plans patterns:
  - Bite-sized tasks (2-5 min each)
  - Exact file paths
  - TDD steps: write failing test, run, implement, run, commit
  - Task dependencies and ordering
  - Estimated effort per task
- Output: `implementation-plan.md`
- Register artifact, record gates
- **HR Checkpoint**: present plan summary, ask approve/reject
- Complete stage

**Step 2: Commit**

```bash
git add .opencode/skill/wf-plan/SKILL.md
git commit -m "feat: add wf-plan skill with HR checkpoint"
```

---

### Task 17: Skill — wf-tasks

**Files:**
- Create: `.opencode/skill/wf-tasks/SKILL.md`

**Step 1: Write the tasks skill**

The skill should:
- Read state, start stage
- Read implementation plan
- For each task in the plan, generate a YAML task passport:
  - task_id, goal, inputs, outputs, allowed_tools, gates, dod, owner_agent
- Validate each passport against `workflow/schemas/task-passport.schema.yaml`
- Output: `tasks/` directory with one `.yaml` file per task
- Register artifacts, record gates (schema validation gate)
- **HR Checkpoint**: present task overview, ask approve/reject
- Complete stage

**Step 2: Commit**

```bash
git add .opencode/skill/wf-tasks/SKILL.md
git commit -m "feat: add wf-tasks skill with passport generation and HR checkpoint"
```

---

### Task 18: Skill — wf-tooling

**Files:**
- Create: `.opencode/skill/wf-tooling/SKILL.md`

**Step 1: Write the tooling skill**

The skill should execute the 5-step mini-workflow:
- **7.1 Stack Inference**: analyze spec and plan, list required technologies
- **7.2 Web Research**: use WebFetch to research best practices, versions, gotchas for each technology
- **7.3 Setup Synthesis**: synthesize setup instructions, config files, dependency lists
- **7.4 Capability Check**: run commands to verify tools are installed and working (node --version, bun --version, etc.)
- **7.5 HR Review**: present tooling decisions for approve/reject
- Output: `tooling-report.md`, `setup.md`
- Register artifacts, record gates per sub-step
- Complete stage

**Step 2: Commit**

```bash
git add .opencode/skill/wf-tooling/SKILL.md
git commit -m "feat: add wf-tooling skill with 5-step mini-workflow"
```

---

### Task 19: Skill — wf-dispatch

**Files:**
- Create: `.opencode/skill/wf-dispatch/SKILL.md`

**Step 1: Write the dispatch skill**

The skill should:
- Read state, start stage
- Read all task passports from tasks/ directory
- Analyze file dependencies between tasks (which tasks touch the same files)
- Determine parallelism strategy: which tasks can run concurrently
- Assess risk profile per task
- Create dispatch plan with execution order and groups
- Output: `dispatch-plan.md`
- Register artifact, record gates
- Complete stage

**Step 2: Commit**

```bash
git add .opencode/skill/wf-dispatch/SKILL.md
git commit -m "feat: add wf-dispatch skill"
```

---

### Task 20: Skill — wf-implement

**Files:**
- Create: `.opencode/skill/wf-implement/SKILL.md`

**Step 1: Write the implement skill**

The skill should:
- Read state, start stage
- Read dispatch plan and task passports
- For each task group (respecting parallelism):
  - Launch subagent(s) via Task tool
  - Each subagent receives: task passport, relevant context files, TDD instructions
  - Subagent protocol: write failing test -> implement -> verify -> commit
  - Collect subagent results
- After each task: verify gates from passport
- If gate fails: Stop + Diagnose (write diagnostics, halt)
- After all tasks: run integration checks
- Register artifacts per task, record all gates
- Complete stage

**Step 2: Commit**

```bash
git add .opencode/skill/wf-implement/SKILL.md
git commit -m "feat: add wf-implement skill with SDD+TDD execution"
```

---

### Task 21: Skill — wf-review

**Files:**
- Create: `.opencode/skill/wf-review/SKILL.md`

**Step 1: Write the review skill**

The skill should:
- Read state, start stage
- Review all code changes from implement stage
- Structural analysis: file organization, naming, patterns
- Consistency check: style, conventions, imports
- Test coverage review: are all requirements tested?
- Security review: secrets, input validation, auth
- Output: `review-report.md` with findings and recommendations
- Register artifact, record gates
- If critical issues found: optionally escalate to HR
- Complete stage

**Step 2: Commit**

```bash
git add .opencode/skill/wf-review/SKILL.md
git commit -m "feat: add wf-review skill"
```

---

### Task 22: Skill — wf-finish-branch

**Files:**
- Create: `.opencode/skill/wf-finish-branch/SKILL.md`

**Step 1: Write the finish-branch skill**

The skill should:
- Read state, start stage
- Check git status: clean working tree, all committed
- Decide cleanup strategy: squash, rebase, or merge
- Run pre-merge checks: tests pass, lint clean, no secrets
- Optionally: create PR via `gh` if configured
- Output: branch metadata (commit range, PR URL if applicable)
- Register artifacts, record gates
- Complete stage

**Step 2: Commit**

```bash
git add .opencode/skill/wf-finish-branch/SKILL.md
git commit -m "feat: add wf-finish-branch skill"
```

---

### Task 23: Skill — wf-project-report

**Files:**
- Create: `.opencode/skill/wf-project-report/SKILL.md`

**Step 1: Write the project-report skill**

The skill should:
- Read state, start stage
- Read all stage artifacts
- Generate `skill-report.md`: what was learned, patterns used, reusable knowledge
- Generate `human-qa-plan.md`: structured QA plan for human testing
  - Smoke tests: basic functionality checks
  - Critical-path tests: core user journey verification
  - Edge cases to watch for
- Register artifacts, record gates
- Complete stage

**Step 2: Commit**

```bash
git add .opencode/skill/wf-project-report/SKILL.md
git commit -m "feat: add wf-project-report skill"
```

---

### Task 24: Skill — wf-human-qa

**Files:**
- Create: `.opencode/skill/wf-human-qa/SKILL.md`

**Step 1: Write the human-qa skill**

The skill should:
- Read state, start stage
- Read `human-qa-plan.md`
- Guide user through each QA step interactively:
  - Present test instruction
  - Ask user to execute and report result (pass/fail/skip)
  - Record result
- Categorize findings: critical bugs, minor issues, observations
- Output: `qa-report.md` with all results and findings
- Register artifact, record gates
- If critical bugs found: suggest `/wf.debug` as next step
- If all pass: suggest `/wf.finish-report`
- Complete stage

**Step 2: Commit**

```bash
git add .opencode/skill/wf-human-qa/SKILL.md
git commit -m "feat: add wf-human-qa skill"
```

---

### Task 25: Skill — wf-debug

**Files:**
- Create: `.opencode/skill/wf-debug/SKILL.md`

**Step 1: Write the debug skill**

The skill should:
- Read state, start stage
- Read `qa-report.md` for issues to fix
- Bounded debug loop (max 5 iterations):
  - Iteration N:
    1. Diagnose: identify root cause of next issue
    2. Propose fix: describe the fix
    3. Implement fix: make the change
    4. Verify: run relevant tests/checks
    5. Record: log iteration result
  - If fix works: move to next issue
  - If fix fails: try alternative approach (counts as iteration)
- After max iterations with remaining issues: stop, report what's fixed and what remains
- Output: `debug-log.md` with all iterations
- Register artifact, record gates
- Complete stage

**Step 2: Commit**

```bash
git add .opencode/skill/wf-debug/SKILL.md
git commit -m "feat: add wf-debug skill with bounded loop"
```

---

### Task 26: Skill — wf-finish-report

**Files:**
- Create: `.opencode/skill/wf-finish-report/SKILL.md`

**Step 1: Write the finish-report skill**

The skill should:
- Read state, start stage
- Read all stage artifacts across the feature
- Generate executive summary `final-report.md`:
  - Project overview (from concept)
  - Architecture decisions (from arch)
  - What was built (from implement)
  - Quality results (from review + QA)
  - Debug fixes applied (from debug, if any)
  - Metrics: total stages, time per stage, gates passed/failed
  - Lessons learned
  - Recommendations for future work
- Mark feature as completed in state
- Register artifact, record gates
- Complete stage

**Step 2: Commit**

```bash
git add .opencode/skill/wf-finish-report/SKILL.md
git commit -m "feat: add wf-finish-report skill"
```

---

### Task 27: Plugin Tests — State Management

**Files:**
- Create: `.opencode/tests/state.test.ts`

**Step 1: Write tests for state management**

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { readState, writeState, emptyState, getActiveFeature, newStageExecution } from "../state";
import { rmSync, mkdirSync } from "fs";
import { join } from "path";

const TEST_DIR = join(import.meta.dir, "__test_workdir__");

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("state management", () => {
  test("readState returns empty state when no file exists", async () => {
    const state = await readState(TEST_DIR);
    expect(state.version).toBe("1.0");
    expect(state.active_feature).toBeNull();
    expect(state.features).toEqual({});
  });

  test("writeState and readState roundtrip", async () => {
    const state = emptyState();
    state.active_feature = "test-feature";
    state.features["test-feature"] = {
      feature_id: "test-feature",
      title: "Test Feature",
      created_at: "2026-03-05T00:00:00Z",
      status: "in_progress",
      current_stage: "discover",
      stages: {},
    };
    await writeState(TEST_DIR, state);
    const loaded = await readState(TEST_DIR);
    expect(loaded.active_feature).toBe("test-feature");
    expect(loaded.features["test-feature"].title).toBe("Test Feature");
  });

  test("getActiveFeature returns null when no active", () => {
    const state = emptyState();
    expect(getActiveFeature(state)).toBeNull();
  });

  test("newStageExecution creates proper structure", () => {
    const stage = newStageExecution("discover");
    expect(stage.stage_id).toBe("discover");
    expect(stage.result).toBe("in_progress");
    expect(stage.artifacts).toEqual([]);
    expect(stage.gates).toEqual([]);
  });
});
```

**Step 2: Run tests**

Run: `cd .opencode && bun test tests/state.test.ts`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add .opencode/tests/state.test.ts
git commit -m "test: add state management unit tests"
```

---

### Task 28: Plugin Tests — Gate Checking

**Files:**
- Create: `.opencode/tests/gates.test.ts`

**Step 1: Write tests for gate checking**

```typescript
import { describe, test, expect } from "bun:test";
import { checkStagePreconditions, isGovernedStage } from "../gates";
import type { FeatureRun } from "../types";

function makeFeature(stages: Record<string, any> = {}): FeatureRun {
  return {
    feature_id: "test",
    title: "Test",
    created_at: "2026-03-05T00:00:00Z",
    status: "in_progress",
    current_stage: "discover",
    stages,
  };
}

describe("gate checking", () => {
  test("discover has no preconditions", () => {
    const feature = makeFeature();
    const result = checkStagePreconditions(feature, "discover");
    expect(result.allowed).toBe(true);
  });

  test("spike requires discover completed", () => {
    const feature = makeFeature();
    const result = checkStagePreconditions(feature, "spike");
    expect(result.allowed).toBe(false);
    expect(result.missing_preconditions).toContain(
      "Stage 'discover' must be completed"
    );
  });

  test("spike allowed when discover completed", () => {
    const feature = makeFeature({
      discover: { result: "completed" },
    });
    const result = checkStagePreconditions(feature, "spike");
    expect(result.allowed).toBe(true);
  });

  test("spec requires arch completed AND approved", () => {
    const feature = makeFeature({
      spike: { result: "completed" },
      arch: { result: "completed", approval: { decision: "pending" } },
    });
    const result = checkStagePreconditions(feature, "spec");
    expect(result.allowed).toBe(false);
  });

  test("spec allowed with arch completed and approved", () => {
    const feature = makeFeature({
      spike: { result: "completed" },
      arch: { result: "completed", approval: { decision: "approved" } },
    });
    const result = checkStagePreconditions(feature, "spec");
    expect(result.allowed).toBe(true);
  });

  test("governed stages are correct", () => {
    expect(isGovernedStage("arch")).toBe(true);
    expect(isGovernedStage("spec")).toBe(true);
    expect(isGovernedStage("plan")).toBe(true);
    expect(isGovernedStage("tasks")).toBe(true);
    expect(isGovernedStage("tooling")).toBe(true);
    expect(isGovernedStage("discover")).toBe(false);
    expect(isGovernedStage("implement")).toBe(false);
  });
});
```

**Step 2: Run tests**

Run: `cd .opencode && bun test tests/gates.test.ts`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add .opencode/tests/gates.test.ts
git commit -m "test: add gate checking unit tests"
```

---

### Task 29: Integration — Verify Plugin Loads

**Step 1: Verify TypeScript compiles without errors**

Run: `cd .opencode && bunx tsc --noEmit`
Expected: No errors.

**Step 2: Run all tests**

Run: `cd .opencode && bun test`
Expected: All tests pass.

**Step 3: Commit if any fixes needed**

---

### Task 30: Final Verification and Cleanup

**Step 1: Verify directory structure is correct**

Run: `find . -type f | grep -v node_modules | grep -v .git | sort`
Expected: All planned files exist.

**Step 2: Verify all skills have correct frontmatter**

Check each `.opencode/skill/wf-*/SKILL.md` has proper `name`, `description`, `user-invocable: false`.

**Step 3: Verify opencode.json has all 21 commands**

Run: `cat opencode.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d['commands']), 'commands')"`
Expected: `21 commands`

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete OpenCode Agentic Workflow system v1.0

- TS plugin with 7 custom tools for state, gates, artifacts, HR
- 15 stage skills (discover through finish-report)
- 6 service commands (status, resume, gates, history, approve, reject)
- Task passport YAML schema
- Unit tests for state management and gate checking
- Full stage transition map with preconditions and governed stages"
```
