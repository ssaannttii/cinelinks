#!/usr/bin/env bash
# One-shot: clear any stale git lock, stage everything, commit, push.
# Usage:
#   ./push.sh "your commit message"
#   ./push.sh                      # uses a default message
set -e
cd "$(dirname "$0")"

# A sandbox/editor sometimes leaves these behind and blocks git.
rm -f .git/index.lock .git/HEAD.lock 2>/dev/null || true

MSG="${1:-chore: update $(date +%Y-%m-%d\ %H:%M)}"

git add -A
if git diff --cached --quiet; then
  echo "Nothing to commit."
else
  git commit -m "$MSG"
fi
git push
echo "Done."
