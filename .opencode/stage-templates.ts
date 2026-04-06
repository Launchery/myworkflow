// Stage Templates Library — v2.0
// Pre-built stage definitions for common workflow patterns.
// Users can load these as a starting point and customize further.

import type { CustomStageDefinition } from "../custom-stages";

export interface StageTemplate {
  id: string;
  name: string;
  description: string;
  category: "quality" | "security" | "deployment" | "documentation" | "testing" | "compliance";
  stages: CustomStageDefinition[];
}

// ─── Built-in Templates ────────────────────────────────────────

export const TEMPLATES: StageTemplate[] = [
  {
    id: "security-gate",
    name: "Security Review Gate",
    description:
      "Add a security review stage after code review. Includes SAST scan and vulnerability assessment.",
    category: "security",
    stages: [
      {
        id: "security-review",
        name: "Security Review",
        description:
          "Automated and manual security review. Run SAST tools, check for OWASP top 10, review dependency vulnerabilities.",
        after: ["review"],
        governed: true,
        skills: ["wf-security-review"],
        artifacts: ["security-report", "dependency-audit"],
        position: "after:review",
      },
    ],
  },
  {
    id: "perf-benchmark",
    name: "Performance Benchmark",
    description:
      "Add performance benchmarking before final report. Measures regressions against baseline.",
    category: "testing",
    stages: [
      {
        id: "perf-benchmark",
        name: "Performance Benchmark",
        description:
          "Run performance benchmarks, compare against baseline, flag regressions. Produce perf report.",
        after: ["review", "human-qa"],
        governed: false,
        skills: ["wf-perf-benchmark"],
        artifacts: ["perf-report", "benchmark-results"],
        position: "before:finish-report",
      },
    ],
  },
  {
    id: "accessibility-check",
    name: "Accessibility Audit",
    description:
      "Add WCAG 2.1 accessibility checking after review. Validates UI against accessibility standards.",
    category: "quality",
    stages: [
      {
        id: "a11y-audit",
        name: "Accessibility Audit",
        description:
          "Run automated WCAG 2.1 checks, validate keyboard navigation, screen reader compatibility.",
        after: ["review"],
        governed: false,
        skills: ["wf-a11y-audit"],
        artifacts: ["accessibility-report"],
        position: "after:review",
      },
    ],
  },
  {
    id: "staging-deploy",
    name: "Staging Deployment",
    description:
      "Add staging deployment and smoke testing after review, before final report.",
    category: "deployment",
    stages: [
      {
        id: "staging-deploy",
        name: "Deploy to Staging",
        description:
          "Deploy the feature branch to staging environment, run smoke tests, verify integration.",
        after: ["finish-branch"],
        governed: false,
        skills: ["wf-staging-deploy"],
        artifacts: ["staging-url", "smoke-test-results"],
      },
      {
        id: "staging-verify",
        name: "Staging Verification",
        description:
          "Manual and automated verification on staging. Check API contracts, UI flows, data integrity.",
        after: ["staging-deploy"],
        governed: true,
        skills: ["wf-staging-verify"],
        artifacts: ["verification-report"],
      },
    ],
  },
  {
    id: "compliance-check",
    name: "Compliance Check",
    description:
      "Add GDPR/HIPAA/SOC2 compliance review for regulated industries.",
    category: "compliance",
    stages: [
      {
        id: "compliance-review",
        name: "Compliance Review",
        description:
          "Review changes for regulatory compliance (GDPR, HIPAA, SOC2). Check data handling, privacy, audit trails.",
        after: ["review"],
        governed: true,
        skills: ["wf-compliance-review"],
        artifacts: ["compliance-report"],
        position: "after:review",
      },
    ],
  },
  {
    id: "docs-generation",
    name: "Documentation Generation",
    description:
      "Add automated documentation generation and review after implementation.",
    category: "documentation",
    stages: [
      {
        id: "docs-gen",
        name: "Generate Documentation",
        description:
          "Auto-generate API docs, README updates, changelog entries from code changes.",
        after: ["implement"],
        governed: false,
        skills: ["wf-docs-gen"],
        artifacts: ["generated-docs", "api-reference"],
        position: "before:review",
      },
    ],
  },
  {
    id: "integration-test",
    name: "Integration Testing",
    description:
      "Add integration and E2E testing stage between review and finish-branch.",
    category: "testing",
    stages: [
      {
        id: "integration-test",
        name: "Integration Testing",
        description:
          "Run integration tests, E2E tests, API contract tests. Verify cross-service compatibility.",
        after: ["review"],
        governed: false,
        skills: ["wf-integration-test"],
        artifacts: ["test-results", "coverage-report"],
        position: "after:review",
      },
    ],
  },
  {
    id: "release-prep",
    name: "Release Preparation",
    description:
      "Add release preparation steps: version bump, release notes, changelog, tag.",
    category: "deployment",
    stages: [
      {
        id: "release-prep",
        name: "Release Preparation",
        description:
          "Bump version, generate release notes from git history, update CHANGELOG, create git tag.",
        after: ["finish-report"],
        governed: true,
        skills: ["wf-release-prep"],
        artifacts: ["release-notes", "version-bump"],
      },
    ],
  },
];

// ─── Lookup ────────────────────────────────────────────────────

export function getTemplate(id: string): StageTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function listTemplatesByCategory(): Record<string, StageTemplate[]> {
  const result: Record<string, StageTemplate[]> = {};
  for (const t of TEMPLATES) {
    if (!result[t.category]) result[t.category] = [];
    result[t.category].push(t);
  }
  return result;
}
