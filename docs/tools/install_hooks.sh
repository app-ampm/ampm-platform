#!/bin/bash
# Install the project git hooks (hooks are not versioned by git, so run this after cloning).
cd "$(dirname "$0")/../.." || exit 1
cp docs/tools/git-hooks/post-commit .git/hooks/post-commit && chmod +x .git/hooks/post-commit && echo "post-commit hook installed"
