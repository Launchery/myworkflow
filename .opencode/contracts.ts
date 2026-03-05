import { isGovernedStage } from "./gates";
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

function hasRequiredApproval(stageId: StageId, stage: StageExecution): boolean {
  if (!isGovernedStage(stageId)) {
    return true;
  }

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

  if (!hasRequiredApproval(stageId, stage)) {
    errors.push(
      `Stage '${stageId}' is governed and must be approved before completion.`
    );
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
