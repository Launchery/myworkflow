import type { FeatureRun, StageId } from "./types";
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
  if (!preconditions) {
    return {
      allowed: false,
      reason: `Unknown stage '${targetStage}'.`,
      missing_preconditions: [],
    };
  }
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
