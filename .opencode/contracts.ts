import type { FeatureRun, StageExecution, StageId } from "./types";

export interface StageExitValidation {
  ok: boolean;
  errors: string[];
}

function hasArtifactEvidence(stage: StageExecution): boolean {
  return stage.artifacts.length > 0;
}

function hasPassedGateEvidence(stage: StageExecution): boolean {
  return stage.gates.some(
    (gate) => gate.status === "passed" && Boolean(gate.evidence_path)
  );
}

function hasRecordedHrOutcome(stage: StageExecution): boolean {
  return (
    stage.approval.decision === "approved" ||
    stage.approval.decision === "rejected"
  );
}

function hasApprovalToExit(stage: StageExecution): boolean {
  return stage.approval.decision === "approved";
}

export function validateStageExit(
  feature: FeatureRun,
  stageId: StageId
): StageExitValidation {
  const stage = feature.stages[stageId];
  if (!stage) {
    return {
      ok: false,
      errors: [
        `Stage '${stageId}' has not been started for feature '${feature.feature_id}'.`,
      ],
    };
  }

  const errors: string[] = [];

  if (!hasArtifactEvidence(stage)) {
    errors.push(
      `Stage '${stageId}' requires at least one registered artifact before completion.`
    );
  }

  if (!hasPassedGateEvidence(stage)) {
    errors.push(
      `Stage '${stageId}' requires at least one passed gate with evidence before completion.`
    );
  }

  if (!hasRecordedHrOutcome(stage)) {
    errors.push(
      `Stage '${stageId}' requires a recorded HR outcome (approved/rejected) before completion.`
    );
  }

  if (!hasApprovalToExit(stage)) {
    errors.push(
      `Stage '${stageId}' must be approved before completion (current: ${stage.approval.decision}).`
    );
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
