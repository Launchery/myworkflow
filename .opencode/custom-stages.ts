// Custom Stage Definitions — v2.0
// Allows users to define their own workflow stages beyond the built-in 15.

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { StageId } from "./types";
import { STAGE_ORDER, STAGE_PRECONDITIONS, GOVERNED_STAGES } from "./types";

// ─── Custom Stage Types ────────────────────────────────────────

export interface CustomStageDefinition {
  /** Unique stage identifier (kebab-case, e.g. "security-review") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Short description of what this stage does */
  description: string;
  /** Stage IDs that must complete before this stage can start */
  after: string[];
  /** Whether this stage requires HR approval before proceeding */
  governed: boolean;
  /** Skill names that should be available for this stage */
  skills: string[];
  /** Expected artifact types this stage produces */
  artifacts: string[];
  /** Optional: position hint ("before:<stage>" or "after:<stage>") for ordering */
  position?: string;
}

export interface CustomStagesConfig {
  version: string;
  stages: CustomStageDefinition[];
}

// ─── Validation ────────────────────────────────────────────────

const VALID_ID = /^[a-z][a-z0-9-]*$/;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCustomStage(
  def: CustomStageDefinition,
  existingIds: Set<string>
): ValidationResult {
  const errors: string[] = [];

  // ID validation
  if (!def.id || typeof def.id !== "string") {
    errors.push("id is required and must be a string");
  } else if (!VALID_ID.test(def.id)) {
    errors.push(
      `id "${def.id}" must be kebab-case (lowercase letters, numbers, hyphens, starts with a letter)`
    );
  } else if (existingIds.has(def.id)) {
    errors.push(
      `id "${def.id}" already exists (built-in or custom stage)`
    );
  }

  // Name
  if (!def.name || typeof def.name !== "string") {
    errors.push("name is required");
  }

  // Description
  if (!def.description || typeof def.description !== "string") {
    errors.push("description is required");
  }

  // After
  if (!Array.isArray(def.after)) {
    errors.push("after must be an array of stage IDs");
  } else {
    const allKnown = new Set<string>([...STAGE_ORDER, ...existingIds]);
    for (const dep of def.after) {
      if (!allKnown.has(dep)) {
        errors.push(
          `after dependency "${dep}" is not a known stage ID`
        );
      }
    }
    // Prevent circular: a stage cannot depend on itself
    if (def.after.includes(def.id)) {
      errors.push("a stage cannot depend on itself");
    }
  }

  // Skills
  if (!Array.isArray(def.skills)) {
    errors.push("skills must be an array of strings");
  }

  // Artifacts
  if (!Array.isArray(def.artifacts)) {
    errors.push("artifacts must be an array of strings");
  }

  return { valid: errors.length === 0, errors };
}

// ─── Config File I/O ───────────────────────────────────────────

const CUSTOM_STAGES_FILE = "workflow/custom-stages.json";

export function customStagesPath(workdir: string): string {
  return join(workdir, CUSTOM_STAGES_FILE);
}

function emptyConfig(): CustomStagesConfig {
  return { version: "1.0", stages: [] };
}

export async function readCustomStages(
  workdir: string
): Promise<CustomStagesConfig> {
  const path = customStagesPath(workdir);
  if (!existsSync(path)) {
    return emptyConfig();
  }
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as CustomStagesConfig;
  } catch {
    return emptyConfig();
  }
}

export async function writeCustomStages(
  workdir: string,
  config: CustomStagesConfig
): Promise<void> {
  const path = customStagesPath(workdir);
  const dir = join(workdir, "workflow");
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(path, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

// ─── Merged Stage Order ────────────────────────────────────────

export interface MergedStageOrder {
  /** All stage IDs in execution order */
  order: string[];
  /** Stage → precondition stages */
  preconditions: Record<string, { stage: string; approved?: boolean }[]>;
  /** Set of governed stage IDs */
  governed: Set<string>;
  /** Custom stage definitions by ID */
  customDefs: Map<string, CustomStageDefinition>;
}

/**
 * Merge built-in stages with custom stages.
 * Custom stages are placed after their `after` dependencies.
 * If `position` is set ("before:X" / "after:X"), use that for ordering.
 */
export function mergeStageOrder(
  customConfig: CustomStagesConfig
): MergedStageOrder {
  const customDefs = new Map<string, CustomStageDefinition>();
  for (const stage of customConfig.stages) {
    customDefs.set(stage.id, stage);
  }

  // Start with built-in order
  const order: string[] = [...STAGE_ORDER];
  const preconditions: Record<string, { stage: string; approved?: boolean }[]> =
    {};

  // Copy built-in preconditions
  for (const [stageId, deps] of Object.entries(STAGE_PRECONDITIONS)) {
    preconditions[stageId] = deps.map((d) => ({ ...d }));
  }

  // Add custom stages
  for (const custom of customConfig.stages) {
    customDefs.set(custom.id, custom);

    // Build preconditions from `after`
    preconditions[custom.id] = custom.after.map((dep) => {
      const depDef = customDefs.get(dep);
      const isGovernedDep =
        GOVERNED_STAGES.includes(dep as any) ||
        (depDef && depDef.governed);
      return {
        stage: dep,
        ...(isGovernedDep ? { approved: true } : {}),
      };
    });

    // Determine position in order
    if (custom.position) {
      const match = custom.position.match(/^(before|after):(.+)$/);
      if (match) {
        const [, relation, target] = match;
        const idx = order.indexOf(target);
        if (idx !== -1) {
          order.splice(relation === "before" ? idx : idx + 1, 0, custom.id);
          continue;
        }
      }
    }

    // Default: place after last `after` dependency
    let insertIdx = order.length;
    for (const dep of custom.after) {
      const depIdx = order.indexOf(dep);
      if (depIdx !== -1 && depIdx + 1 < insertIdx) {
        insertIdx = depIdx + 1;
      }
    }
    if (insertIdx <= order.length) {
      order.splice(insertIdx, 0, custom.id);
    } else {
      order.push(custom.id);
    }
  }

  // Build governed set
  const governed = new Set<string>(GOVERNED_STAGES);
  for (const custom of customConfig.stages) {
    if (custom.governed) {
      governed.add(custom.id);
    }
  }

  return { order, preconditions, governed, customDefs };
}

// ─── Utility ───────────────────────────────────────────────────

/** Get all known stage IDs (built-in + custom) */
export function allStageIds(customConfig: CustomStagesConfig): Set<string> {
  const ids = new Set(STAGE_ORDER);
  for (const stage of customConfig.stages) {
    ids.add(stage.id);
  }
  return ids;
}
