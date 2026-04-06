#!/usr/bin/env bash
# myworkflow setup script
# Clones, installs deps, and verifies the plugin is ready for OpenCode.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔧 myworkflow setup"
echo "   Repo: $REPO_ROOT"
echo ""

# Check prerequisites
check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo "❌ $1 not found. Please install $2."
    return 1
  fi
  echo "✅ $1 found"
}

echo "Checking prerequisites..."
check_cmd node "Node.js 18+"
check_cmd bun "Bun 1.0+ (https://bun.sh)"
echo ""

# Install dependencies
echo "📦 Installing plugin dependencies..."
cd "$REPO_ROOT/.opencode"
bun install
echo ""

# Verify build
echo "🔍 Verifying TypeScript compilation..."
if bunx tsc --noEmit; then
  echo "✅ TypeScript OK"
else
  echo "⚠️  TypeScript check had warnings (non-blocking)"
fi
echo ""

# Verify tests
echo "🧪 Running tests..."
if bun test 2>/dev/null; then
  echo "✅ Tests passed"
else
  echo "⚠️  Some tests failed or no tests found (non-blocking)"
fi
echo ""

echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Open this directory in OpenCode"
echo "  2. Run /wf.discover to start your first workflow"
echo "  3. See docs/examples/ for walkthrough scenarios"
