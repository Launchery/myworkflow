import { existsSync } from "fs";
import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import { homedir } from "os";
import { dirname, join } from "path";

export type SkillSource = "local" | "global";

export interface SkillCandidate {
  skill_name: string;
  source: SkillSource;
  path: string;
}

export interface SkillResolution {
  skill_name: string;
  status: "resolved" | "collision" | "missing";
  selected_source: SkillSource | null;
  selected_path: string | null;
  candidates: SkillCandidate[];
  message: string;
}

interface SkillSelectionStore {
  version: "1.0";
  updated_at: string;
  selections: Record<string, SkillSource>;
}

interface ResolverOptions {
  local_root?: string;
  global_roots?: string[];
}

const SKILL_SELECTION_STATE_PATH = join("workflow", "state", "skill-resolver.json");

function defaultGlobalRoots(): string[] {
  const configured = process.env.OPENCODE_GLOBAL_SKILLS_DIR?.trim();
  if (configured) {
    return configured
      .split(":")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [join(homedir(), ".config", "opencode", "skills")];
}

function emptySelectionStore(): SkillSelectionStore {
  return {
    version: "1.0",
    updated_at: new Date().toISOString(),
    selections: {},
  };
}

async function readSelectionStore(worktree: string): Promise<SkillSelectionStore> {
  const absolute = join(worktree, SKILL_SELECTION_STATE_PATH);
  if (!existsSync(absolute)) {
    return emptySelectionStore();
  }

  try {
    const raw = await readFile(absolute, "utf-8");
    const parsed = JSON.parse(raw) as SkillSelectionStore;
    if (parsed && parsed.version === "1.0" && parsed.selections) {
      return parsed;
    }
  } catch {
    // Fall back to empty store.
  }

  return emptySelectionStore();
}

async function writeSelectionStore(
  worktree: string,
  store: SkillSelectionStore
): Promise<void> {
  const absolute = join(worktree, SKILL_SELECTION_STATE_PATH);
  await mkdir(dirname(absolute), { recursive: true });
  store.updated_at = new Date().toISOString();
  await writeFile(absolute, JSON.stringify(store, null, 2) + "\n", "utf-8");
}

async function discoverGlobalSkillCandidates(
  root: string,
  skillName: string,
  maxDepth = 5
): Promise<string[]> {
  const found: string[] = [];

  async function walk(currentDir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const entryName = entry.name.toString();
      const entryPath = join(currentDir, entryName);
      if (entryName === skillName) {
        const candidate = join(entryPath, "SKILL.md");
        if (existsSync(candidate)) {
          found.push(candidate);
        }
      }

      await walk(entryPath, depth + 1);
    }
  }

  await walk(root, 0);
  return found;
}

function sortCandidates(candidates: SkillCandidate[]): SkillCandidate[] {
  return candidates
    .slice()
    .sort((a, b) => `${a.source}:${a.path}`.localeCompare(`${b.source}:${b.path}`));
}

export async function discoverSkillCandidates(
  worktree: string,
  skillName: string,
  options: ResolverOptions = {}
): Promise<SkillCandidate[]> {
  const localRoot = options.local_root ?? join(worktree, ".opencode", "skill");
  const globalRoots = options.global_roots ?? defaultGlobalRoots();

  const candidates: SkillCandidate[] = [];
  const localPath = join(localRoot, skillName, "SKILL.md");
  if (existsSync(localPath)) {
    candidates.push({
      skill_name: skillName,
      source: "local",
      path: localPath,
    });
  }

  for (const globalRoot of globalRoots) {
    const globalPaths = await discoverGlobalSkillCandidates(globalRoot, skillName);
    for (const path of globalPaths) {
      candidates.push({
        skill_name: skillName,
        source: "global",
        path,
      });
    }
  }

  const deduped = new Map<string, SkillCandidate>();
  for (const candidate of candidates) {
    deduped.set(`${candidate.source}:${candidate.path}`, candidate);
  }

  return sortCandidates([...deduped.values()]);
}

function pickCandidateBySource(
  candidates: SkillCandidate[],
  source: SkillSource
): SkillCandidate | null {
  const filtered = candidates.filter((candidate) => candidate.source === source);
  if (filtered.length === 0) {
    return null;
  }
  return sortCandidates(filtered)[0];
}

export async function setSkillSelection(
  worktree: string,
  skillName: string,
  source: SkillSource
): Promise<void> {
  const store = await readSelectionStore(worktree);
  store.selections[skillName] = source;
  await writeSelectionStore(worktree, store);
}

export async function clearSkillSelection(
  worktree: string,
  skillName: string
): Promise<void> {
  const store = await readSelectionStore(worktree);
  delete store.selections[skillName];
  await writeSelectionStore(worktree, store);
}

export async function resolveSkill(
  worktree: string,
  skillName: string,
  options: ResolverOptions = {}
): Promise<SkillResolution> {
  const candidates = await discoverSkillCandidates(worktree, skillName, options);

  if (candidates.length === 0) {
    return {
      skill_name: skillName,
      status: "missing",
      selected_source: null,
      selected_path: null,
      candidates,
      message: `No skill named '${skillName}' found in local or global skill locations.`,
    };
  }

  if (candidates.length === 1) {
    return {
      skill_name: skillName,
      status: "resolved",
      selected_source: candidates[0].source,
      selected_path: candidates[0].path,
      candidates,
      message: `Resolved '${skillName}' from ${candidates[0].source} skills.`,
    };
  }

  const sourceSet = new Set(candidates.map((candidate) => candidate.source));
  if (sourceSet.size === 1) {
    const selected = sortCandidates(candidates)[0];
    return {
      skill_name: skillName,
      status: "resolved",
      selected_source: selected.source,
      selected_path: selected.path,
      candidates,
      message: `Resolved '${skillName}' deterministically from ${selected.source} candidates.`,
    };
  }

  const store = await readSelectionStore(worktree);
  const preferredSource = store.selections[skillName];
  if (preferredSource) {
    const selected = pickCandidateBySource(candidates, preferredSource);
    if (selected) {
      return {
        skill_name: skillName,
        status: "resolved",
        selected_source: selected.source,
        selected_path: selected.path,
        candidates,
        message: `Resolved '${skillName}' using stored ${preferredSource} selection.`,
      };
    }
  }

  return {
    skill_name: skillName,
    status: "collision",
    selected_source: null,
    selected_path: null,
    candidates,
    message:
      `Skill name collision detected for '${skillName}'. ` +
      "Select local or global using wf_skill_resolve.",
  };
}
