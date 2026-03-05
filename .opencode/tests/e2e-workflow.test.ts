import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { wf_hr_record, wf_artifact_register } from "../tools/artifact-tools";
import { wf_feature_init } from "../tools/feature-tools";
import {
  wf_gate_check,
  wf_gate_run,
} from "../tools/gate-tools";
import { wf_state_read, wf_state_write } from "../tools/state-tools";
import { GOVERNED_STAGES, STAGE_ORDER, type StageId } from "../types";

const TEST_DIR = join(import.meta.dir, "__e2e_workdir__");
const PASS_GATE_SCRIPT = join(import.meta.dir, "fixtures", "gate-pass.sh");
const FAIL_GATE_SCRIPT = join(import.meta.dir, "fixtures", "gate-fail.sh");

const passGateCommand = `sh "${PASS_GATE_SCRIPT}"`;
const failGateCommand = `sh "${FAIL_GATE_SCRIPT}"`;

const makeCtx = (worktree: string) => ({ worktree } as any);

function asJson(value: string): any {
  return JSON.parse(value);
}

async function writeStageArtifact(
  workdir: string,
  featureId: string,
  stageId: StageId,
  content = "fixture artifact"
): Promise<string> {
  const relativePath = `workflow/features/${featureId}/${stageId}/artifact-${stageId}.md`;
  const absolutePath = join(workdir, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf-8");
  return relativePath;
}

beforeEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("gate execution with persisted evidence", () => {
  test("wf_gate_run executes command and writes evidence", async () => {
    const ctx = makeCtx(TEST_DIR);
    const init = asJson(await wf_feature_init.execute({ title: "Gate Run Test" }, ctx));
    const featureId = init.feature_id as string;

    await wf_state_write.execute(
      { feature_id: featureId, stage_id: "discover", action: "start" },
      ctx
    );

    const passResult = asJson(
      await wf_gate_run.execute(
        {
          feature_id: featureId,
          stage_id: "discover",
          gate_name: "fixture-pass",
          command: passGateCommand,
        },
        ctx
      )
    );

    expect(passResult.status).toBe("passed");
    expect(passResult.exit_code).toBe(0);
    expect(passResult.evidence_path).toContain("/gates/");

    const evidence = JSON.parse(
      await readFile(join(TEST_DIR, passResult.evidence_path), "utf-8")
    );
    expect(evidence.kind).toBe("command-execution");
    expect(evidence.stdout).toContain("gate-pass");

    const failResult = asJson(
      await wf_gate_run.execute(
        {
          feature_id: featureId,
          stage_id: "discover",
          gate_name: "fixture-fail",
          command: failGateCommand,
        },
        ctx
      )
    );

    expect(failResult.status).toBe("failed");
    expect(failResult.exit_code).toBe(2);
  });
});

describe("runtime stage-exit contract", () => {
  test("enforces artifact + gate evidence + governed approval", async () => {
    const ctx = makeCtx(TEST_DIR);
    const init = asJson(
      await wf_feature_init.execute({ title: "Contract Validation" }, ctx)
    );
    const featureId = init.feature_id as string;

    await wf_state_write.execute(
      { feature_id: featureId, stage_id: "discover", action: "start" },
      ctx
    );

    const earlyComplete = asJson(
      await wf_state_write.execute(
        { feature_id: featureId, stage_id: "discover", action: "complete" },
        ctx
      )
    );
    expect(earlyComplete.error).toContain("Stage exit contract failed");

    const discoverArtifact = await writeStageArtifact(TEST_DIR, featureId, "discover");
    await wf_artifact_register.execute(
      {
        feature_id: featureId,
        stage_id: "discover",
        artifact_type: "discover-artifact",
        path: discoverArtifact,
      },
      ctx
    );
    await wf_gate_run.execute(
      {
        feature_id: featureId,
        stage_id: "discover",
        gate_name: "discover-gate",
        command: passGateCommand,
      },
      ctx
    );

    const discoverComplete = asJson(
      await wf_state_write.execute(
        { feature_id: featureId, stage_id: "discover", action: "complete" },
        ctx
      )
    );
    expect(discoverComplete.success).toBe(true);

    await wf_state_write.execute(
      { feature_id: featureId, stage_id: "spike", action: "start" },
      ctx
    );
    const spikeArtifact = await writeStageArtifact(TEST_DIR, featureId, "spike");
    await wf_artifact_register.execute(
      {
        feature_id: featureId,
        stage_id: "spike",
        artifact_type: "spike-artifact",
        path: spikeArtifact,
      },
      ctx
    );
    await wf_gate_run.execute(
      {
        feature_id: featureId,
        stage_id: "spike",
        gate_name: "spike-gate",
        command: passGateCommand,
      },
      ctx
    );
    await wf_state_write.execute(
      { feature_id: featureId, stage_id: "spike", action: "complete" },
      ctx
    );

    await wf_state_write.execute(
      { feature_id: featureId, stage_id: "arch", action: "start" },
      ctx
    );
    const archArtifact = await writeStageArtifact(TEST_DIR, featureId, "arch");
    await wf_artifact_register.execute(
      {
        feature_id: featureId,
        stage_id: "arch",
        artifact_type: "arch-artifact",
        path: archArtifact,
      },
      ctx
    );
    await wf_gate_run.execute(
      {
        feature_id: featureId,
        stage_id: "arch",
        gate_name: "arch-gate",
        command: passGateCommand,
      },
      ctx
    );

    const archWithoutApproval = asJson(
      await wf_state_write.execute(
        { feature_id: featureId, stage_id: "arch", action: "complete" },
        ctx
      )
    );
    expect(archWithoutApproval.error).toContain("Stage exit contract failed");

    await wf_hr_record.execute(
      {
        feature_id: featureId,
        stage_id: "wf.arch",
        decision: "approved",
      },
      ctx
    );

    const archComplete = asJson(
      await wf_state_write.execute(
        { feature_id: featureId, stage_id: "arch", action: "complete" },
        ctx
      )
    );
    expect(archComplete.success).toBe(true);
  });
});

describe("e2e pipeline with fixtures", () => {
  test("can progress through all stages with contract-compliant evidence", async () => {
    const ctx = makeCtx(TEST_DIR);
    const init = asJson(
      await wf_feature_init.execute({ title: "End To End Feature" }, ctx)
    );
    const featureId = init.feature_id as string;

    for (const stageId of STAGE_ORDER) {
      const stageEntryCheck = await wf_gate_check.execute(
        {
          feature_id: featureId,
          target_stage: stageId,
        },
        ctx
      );
      expect(stageEntryCheck).toContain("PASSED");

      const startResult = asJson(
        await wf_state_write.execute(
          {
            feature_id: featureId,
            stage_id: stageId,
            action: "start",
          },
          ctx
        )
      );
      expect(startResult.success).toBe(true);

      const artifactPath = await writeStageArtifact(TEST_DIR, featureId, stageId);
      const artifactResult = asJson(
        await wf_artifact_register.execute(
          {
            feature_id: featureId,
            stage_id: stageId,
            artifact_type: `${stageId}-artifact`,
            path: artifactPath,
          },
          ctx
        )
      );
      expect(artifactResult.success).toBe(true);

      const gateResult = asJson(
        await wf_gate_run.execute(
          {
            feature_id: featureId,
            stage_id: stageId,
            gate_name: `${stageId}-gate`,
            command: passGateCommand,
          },
          ctx
        )
      );
      expect(gateResult.status).toBe("passed");

      if (GOVERNED_STAGES.includes(stageId)) {
        const approvalResult = asJson(
          await wf_hr_record.execute(
            {
              feature_id: featureId,
              stage_id: stageId,
              decision: "approved",
            },
            ctx
          )
        );
        expect(approvalResult.success).toBe(true);
      }

      const completeResult = asJson(
        await wf_state_write.execute(
          {
            feature_id: featureId,
            stage_id: stageId,
            action: "complete",
          },
          ctx
        )
      );
      expect(completeResult.success).toBe(true);
    }

    await wf_state_write.execute(
      {
        feature_id: featureId,
        action: "set_feature_status",
        feature_status: "completed",
      },
      ctx
    );

    const stateResult = asJson(
      await wf_state_read.execute({ feature_id: featureId }, ctx)
    );
    const feature = stateResult.state.features[featureId];

    for (const stageId of STAGE_ORDER) {
      expect(feature.stages[stageId].result).toBe("completed");
    }
    expect(feature.status).toBe("completed");
  });
});
