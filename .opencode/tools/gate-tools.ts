import { spawn } from "child_process";
import { join } from "path";
import { tool } from "@opencode-ai/plugin/tool";
import { readState, updateState } from "../state";
import {
  checkStagePreconditions,
  formatGateCheckResult,
} from "../gates";
import { writeGateEvidence } from "../evidence";
import { isStageId } from "../types";

interface CommandRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
  startedAt: string;
  finishedAt: string;
}

function runShellCommand(
  command: string,
  cwd: string,
  timeoutMs: number
): Promise<CommandRunResult> {
  return new Promise((resolve) => {
    const startedAt = new Date();
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const finish = (exitCode: number, extraStderr = "") => {
      if (settled) return;
      settled = true;

      if (extraStderr) {
        stderr = stderr ? `${stderr}\n${extraStderr}` : extraStderr;
      }

      const finishedAt = new Date();
      resolve({
        exitCode,
        stdout,
        stderr,
        timedOut,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
      });
    };

    const child = spawn(command, {
      cwd,
      shell: true,
      env: process.env,
    });

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      finish(1, String(error));
    });

    child.on("close", (code, signal) => {
      if (signal) {
        finish(code ?? 1, `Process terminated by signal ${signal}.`);
        return;
      }

      finish(code ?? 1);
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    const clear = () => clearTimeout(timer);
    child.on("close", clear);
    child.on("error", clear);
  });
}

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
    if (!isStageId(args.target_stage)) {
      return `Invalid stage '${args.target_stage}'.`;
    }

    const state = await readState(ctx.worktree);
    const featureId = args.feature_id ?? state.active_feature;

    if (!featureId) {
      return "No active feature. Use wf_feature_init to create one.";
    }

    const feature = state.features[featureId];
    if (!feature) {
      return `Feature '${featureId}' not found.`;
    }

    const result = checkStagePreconditions(feature, args.target_stage);
    return formatGateCheckResult(result);
  },
});

export const wf_gate_run = tool({
  description:
    "Execute a gate command, capture command output and exit code, persist evidence, and record gate status in workflow state.",
  args: {
    gate_name: tool.schema
      .string()
      .describe("Gate name to record (e.g., tests-pass, typecheck)"),
    command: tool.schema
      .string()
      .describe("Shell command to execute for this gate"),
    stage_id: tool.schema
      .string()
      .describe("Stage ID where the gate result should be recorded"),
    feature_id: tool.schema
      .string()
      .optional()
      .describe("Feature ID. If omitted, uses the active feature."),
    cwd_rel: tool.schema
      .string()
      .optional()
      .describe("Optional working directory relative to repository root"),
    timeout_ms: tool.schema
      .number()
      .optional()
      .describe("Command timeout in milliseconds (default: 120000)"),
  },
  async execute(args, ctx) {
    if (!isStageId(args.stage_id)) {
      return JSON.stringify({
        error: `Invalid stage '${args.stage_id}'`,
      });
    }

    const state = await readState(ctx.worktree);
    const featureId = args.feature_id ?? state.active_feature;

    if (!featureId) {
      return JSON.stringify({
        error: "No active feature. Use wf_feature_init to create one.",
      });
    }

    const feature = state.features[featureId];
    if (!feature) {
      return JSON.stringify({
        error: `Feature '${featureId}' not found`,
      });
    }

    const stage = feature.stages[args.stage_id];
    if (!stage) {
      return JSON.stringify({
        error: `Stage '${args.stage_id}' not started for feature '${featureId}'`,
      });
    }

    const cwd = args.cwd_rel ? join(ctx.worktree, args.cwd_rel) : ctx.worktree;
    const timeoutMs = args.timeout_ms ?? 120000;

    const run = await runShellCommand(args.command, cwd, timeoutMs);
    const status = !run.timedOut && run.exitCode === 0 ? "passed" : "failed";

    const updateResult = await updateState(ctx.worktree, async (nextState) => {
      const nextFeature = nextState.features[featureId];
      if (!nextFeature) {
        return {
          success: false as const,
          error: `Feature '${featureId}' not found`,
        };
      }

      const nextStage = nextFeature.stages[args.stage_id];
      if (!nextStage) {
        return {
          success: false as const,
          error: `Stage '${args.stage_id}' not started for feature '${featureId}'`,
        };
      }

      const evidencePayload = {
        kind: "command-execution",
        gate_name: args.gate_name,
        stage_id: args.stage_id,
        feature_id: featureId,
        command: args.command,
        cwd,
        status,
        exit_code: run.exitCode,
        timed_out: run.timedOut,
        started_at: run.startedAt,
        finished_at: run.finishedAt,
        duration_ms: run.durationMs,
        stdout: run.stdout,
        stderr: run.stderr,
      };

      const evidencePath = await writeGateEvidence(
        ctx.worktree,
        featureId,
        args.stage_id,
        args.gate_name,
        evidencePayload
      );

      nextStage.gates.push({
        gate_name: args.gate_name,
        status,
        evidence_path: evidencePath,
        timestamp: new Date().toISOString(),
        method: "run",
        command: args.command,
        exit_code: run.exitCode,
      });

      return {
        success: true as const,
        evidencePath,
      };
    });

    if (!updateResult.success) {
      return JSON.stringify({
        error: updateResult.error,
        exit_code: run.exitCode,
        timed_out: run.timedOut,
        stdout: run.stdout,
        stderr: run.stderr,
      });
    }

    return JSON.stringify({
      success: true,
      status,
      gate_name: args.gate_name,
      stage_id: args.stage_id,
      feature_id: featureId,
      exit_code: run.exitCode,
      timed_out: run.timedOut,
      evidence_path: updateResult.evidencePath,
      stdout: run.stdout,
      stderr: run.stderr,
    });
  },
});

export const wf_gate_record = tool({
  description:
    "Record the result of a quality gate check for a specific stage and persist gate evidence. Use wf_gate_run when command execution is required.",
  args: {
    feature_id: tool.schema.string().describe("Feature ID"),
    stage_id: tool.schema.string().describe("Stage ID"),
    gate_name: tool.schema
      .string()
      .describe("Name of the gate (e.g., tests-pass, lint-clean)"),
    status: tool.schema
      .enum(["passed", "failed", "skipped"])
      .describe("Gate result"),
    evidence_path: tool.schema
      .string()
      .optional()
      .describe("Optional path to evidence file"),
  },
  async execute(args, ctx) {
    if (!isStageId(args.stage_id)) {
      return JSON.stringify({
        error: `Invalid stage '${args.stage_id}'`,
      });
    }

    const result = await updateState(ctx.worktree, async (state) => {
      const feature = state.features[args.feature_id];

      if (!feature) {
        return {
          success: false as const,
          error: `Feature '${args.feature_id}' not found`,
        };
      }

      const stage = feature.stages[args.stage_id];
      if (!stage) {
        return {
          success: false as const,
          error: `Stage '${args.stage_id}' not started for feature '${args.feature_id}'`,
        };
      }

      const evidencePath =
        args.evidence_path ??
        (await writeGateEvidence(
          ctx.worktree,
          args.feature_id,
          args.stage_id,
          args.gate_name,
          {
            kind: "manual-gate-record",
            gate_name: args.gate_name,
            stage_id: args.stage_id,
            feature_id: args.feature_id,
            status: args.status,
            timestamp: new Date().toISOString(),
          }
        ));

      stage.gates.push({
        gate_name: args.gate_name,
        status: args.status,
        evidence_path: evidencePath,
        timestamp: new Date().toISOString(),
        method: "record",
        command: null,
        exit_code: null,
      });

      return {
        success: true as const,
        evidencePath,
      };
    });

    if (!result.success) {
      return JSON.stringify({
        error: result.error,
      });
    }

    return JSON.stringify({
      success: true,
      gate: args.gate_name,
      status: args.status,
      evidence_path: result.evidencePath,
    });
  },
});
