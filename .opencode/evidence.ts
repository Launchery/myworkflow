import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import type { StageId } from "./types";

function safeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function evidenceFileName(gateName: string): string {
  const ts = new Date().toISOString().replace(/[.:]/g, "-");
  const slug = safeSlug(gateName) || "gate";
  return `${ts}-${slug}.json`;
}

export async function writeGateEvidence(
  workdir: string,
  featureId: string,
  stageId: StageId,
  gateName: string,
  payload: unknown
): Promise<string> {
  const relativeDir = join("workflow", "features", featureId, stageId, "gates");
  const absoluteDir = join(workdir, relativeDir);
  await mkdir(absoluteDir, { recursive: true });

  const fileName = evidenceFileName(gateName);
  const relativePath = join(relativeDir, fileName);
  const absolutePath = join(workdir, relativePath);

  await writeFile(absolutePath, JSON.stringify(payload, null, 2) + "\n", "utf-8");
  return relativePath;
}
