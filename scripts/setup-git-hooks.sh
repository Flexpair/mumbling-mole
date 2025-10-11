#!/bin/bash
# Setup Git hooks for markdown structure validation
# Run this script after cloning the repository

set -e

echo "🔧 Setting up Git hooks..."

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Git pre-commit hook to validate markdown structure
# This hook prevents commits that violate the markdown structure rules

# Run the validation script
./scripts/validate-markdown-structure.sh

# Exit with the same code as the validation script
exit $?
EOF

# Make it executable
chmod +x .git/hooks/pre-commit

echo "✅ Git pre-commit hook installed successfully"
echo ""
echo "The hook will now validate markdown structure on every commit."
echo "To bypass the hook (not recommended), use: git commit --no-verify"
