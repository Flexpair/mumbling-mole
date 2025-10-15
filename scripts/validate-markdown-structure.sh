#!/bin/bash
# Validate markdown structure: max one .md per folder, must be named README.md
# (except for .github/copilot-instructions.md which is a GitHub convention)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Validating markdown file structure..."

# Find all markdown files excluding node_modules and vscode artifacts
# Include vendors/ since we maintain those packages
MARKDOWN_FILES=$(find . -name "*.md" -type f \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/.vscode-remote/*" \
    -not -path "*/.vscode/*" \
    | sort)

ERRORS=0
WARNINGS=0

# Check for forbidden docs/ directories
# READMEs should live next to code, not in separate docs/ folders
if [[ -d "docs" ]]; then
    echo -e "${RED}✗ Error: docs/ directory is not allowed${NC}"
    echo -e "  Reason: READMEs should be placed directly next to the code they document"
    echo -e "  Example: app/audio/README.md documents app/audio/ code"
    ERRORS=$((ERRORS + 1))
fi

# Check for any markdown files in docs/ directories (nested or top-level)
DOCS_MD_FILES=$(echo "$MARKDOWN_FILES" | grep "/docs/" || true)
if [[ -n "$DOCS_MD_FILES" ]]; then
    echo -e "${RED}✗ Error: Markdown files found in docs/ directories${NC}"
    echo -e "  Reason: READMEs must be placed next to the code they document"
    echo -e "  Found files:"
    echo "$DOCS_MD_FILES" | while IFS= read -r file; do
        [[ -n "$file" ]] && echo -e "    - ${YELLOW}$file${NC}"
    done
    echo -e "  Action: Move these files to the directories they document"
    ERRORS=$((ERRORS + 1))
fi

# Track directories that have markdown files
declare -A DIR_MD_COUNT
declare -A DIR_MD_FILES

# Special allowed files (not README.md or LICENSE.md)
# These are exceptions to the "one README.md per folder" rule
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
    
    # Check filename (must be README.md or LICENSE.md unless it's a special allowed file)
    if ! is_allowed_special_file "$md_file"; then
        if [[ "$filename" != "README.md" && "$filename" != "LICENSE.md" ]]; then
            echo -e "${RED}✗ Error: Markdown file must be README.md or LICENSE.md${NC}"
            echo -e "  File: ${YELLOW}$md_file${NC}"
            echo -e "  Allowed: ${GREEN}${dir}/README.md${NC} or ${GREEN}${dir}/LICENSE.md${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    fi
    
done <<< "$MARKDOWN_FILES"

# Check for multiple markdown files in same directory
# Allow: README.md + LICENSE.md together, or special allowed files
for dir in "${!DIR_MD_COUNT[@]}"; do
    count=${DIR_MD_COUNT[$dir]}
    if [[ $count -gt 1 ]]; then
        # Check if files are valid combinations (README + LICENSE, or allowed special files)
        files_in_dir=$(echo -e "${DIR_MD_FILES[$dir]}" | grep -v "^$")
        
        # Count non-allowed files
        invalid_combo=false
        readme_count=0
        license_count=0
        special_count=0
        
        while IFS= read -r file; do
            [[ -z "$file" ]] && continue
            filename=$(basename "$file")
            
            if is_allowed_special_file "$file"; then
                special_count=$((special_count + 1))
            elif [[ "$filename" == "README.md" ]]; then
                readme_count=$((readme_count + 1))
            elif [[ "$filename" == "LICENSE.md" ]]; then
                license_count=$((license_count + 1))
            fi
        done <<< "$files_in_dir"
        
        # Valid combinations:
        # - 1 README.md + 1 LICENSE.md
        # - 1 README.md + N special files
        # - 1 LICENSE.md + N special files
        # - N special files
        total_standard=$((readme_count + license_count))
        
        if [[ $readme_count -gt 1 ]] || [[ $license_count -gt 1 ]] || [[ $total_standard -gt 2 ]]; then
            invalid_combo=true
        fi
        
        if $invalid_combo; then
            echo -e "${RED}✗ Error: Invalid markdown file combination in directory${NC}"
            echo -e "  Directory: ${YELLOW}$dir${NC}"
            echo -e "  Count: $count files (README: $readme_count, LICENSE: $license_count, Special: $special_count)"
            echo -e "  Files:"
            echo -e "${DIR_MD_FILES[$dir]}" | while read -r file; do
                [[ -n "$file" ]] && echo -e "    - $file"
            done
            ERRORS=$((ERRORS + 1))
        fi
    fi
done

# Summary
echo ""
echo "📊 Validation Summary:"
echo "  Total markdown files found: $(echo "$MARKDOWN_FILES" | grep -c "^")"
echo "  Directories with markdown: ${#DIR_MD_COUNT[@]}"

if [[ $ERRORS -gt 0 ]]; then
    echo -e "${RED}❌ Validation FAILED with $ERRORS error(s)${NC}"
    echo ""
    echo "Rules:"
    echo "  1. NO docs/ directories allowed - READMEs must live next to code"
    echo "  2. Maximum ONE markdown file per directory"
    echo "  3. Markdown files MUST be named 'README.md' or 'LICENSE.md'"
    echo "  4. Exception: .github/copilot-instructions.md (GitHub convention)"
    echo ""
    echo "Philosophy:"
    echo "  Documentation belongs WITH the code it describes, not in separate folders."
    echo "  Example: app/audio/README.md documents app/audio/*.js files"
    echo ""
    exit 1
else
    echo -e "${GREEN}✅ Validation PASSED - All markdown files comply with structure rules${NC}"
    exit 0
fi
