#!/bin/bash
# Validate markdown structure: max one .md per folder, must be named README.md
# (except for .github/copilot-instructions.md which is a GitHub convention)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Validating markdown file structure..."

# Find all markdown files excluding node_modules, vendors, and vscode artifacts
MARKDOWN_FILES=$(find . -name "*.md" -type f \
    -not -path "*/node_modules/*" \
    -not -path "*/vendors/*" \
    -not -path "*/.git/*" \
    -not -path "*/.vscode-remote/*" \
    -not -path "*/.vscode/*" \
    | sort)

ERRORS=0
WARNINGS=0

# Track directories that have markdown files
declare -A DIR_MD_COUNT
declare -A DIR_MD_FILES

# Special allowed files (not README.md)
ALLOWED_SPECIAL_FILES=(
    "./.github/copilot-instructions.md"
)

# Check if file is in allowed special files
is_allowed_special_file() {
    local file="$1"
    for allowed in "${ALLOWED_SPECIAL_FILES[@]}"; do
        if [[ "$file" == "$allowed" ]]; then
            return 0
        fi
    done
    return 1
}

# Process each markdown file
while IFS= read -r md_file; do
    [[ -z "$md_file" ]] && continue
    
    # Get directory and filename
    dir=$(dirname "$md_file")
    filename=$(basename "$md_file")
    
    # Count files per directory
    if [[ -z "${DIR_MD_COUNT[$dir]}" ]]; then
        DIR_MD_COUNT[$dir]=0
        DIR_MD_FILES[$dir]=""
    fi
    DIR_MD_COUNT[$dir]=$((DIR_MD_COUNT[$dir] + 1))
    DIR_MD_FILES[$dir]="${DIR_MD_FILES[$dir]}$md_file\n"
    
    # Check filename (must be README.md unless it's a special allowed file)
    if ! is_allowed_special_file "$md_file"; then
        if [[ "$filename" != "README.md" ]]; then
            echo -e "${RED}✗ Error: Markdown file not named README.md${NC}"
            echo -e "  File: ${YELLOW}$md_file${NC}"
            echo -e "  Expected: ${GREEN}${dir}/README.md${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    fi
    
done <<< "$MARKDOWN_FILES"

# Check for multiple markdown files in same directory
for dir in "${!DIR_MD_COUNT[@]}"; do
    count=${DIR_MD_COUNT[$dir]}
    if [[ $count -gt 1 ]]; then
        echo -e "${RED}✗ Error: Multiple markdown files in same directory${NC}"
        echo -e "  Directory: ${YELLOW}$dir${NC}"
        echo -e "  Count: $count files"
        echo -e "  Files:"
        echo -e "${DIR_MD_FILES[$dir]}" | while read -r file; do
            [[ -n "$file" ]] && echo -e "    - $file"
        done
        ERRORS=$((ERRORS + 1))
    fi
done

# Summary
echo ""
echo "📊 Validation Summary:"
echo "  Total markdown files found: $(echo "$MARKDOWN_FILES" | grep -c "^" || echo 0)"
echo "  Directories with markdown: ${#DIR_MD_COUNT[@]}"

if [[ $ERRORS -gt 0 ]]; then
    echo -e "${RED}❌ Validation FAILED with $ERRORS error(s)${NC}"
    echo ""
    echo "Rules:"
    echo "  1. Maximum ONE markdown file per directory"
    echo "  2. Markdown files MUST be named 'README.md'"
    echo "  3. Exception: .github/copilot-instructions.md (GitHub convention)"
    echo ""
    exit 1
else
    echo -e "${GREEN}✅ Validation PASSED - All markdown files comply with structure rules${NC}"
    exit 0
fi
