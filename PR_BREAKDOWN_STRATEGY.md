# Breaking Down Large PR: Strategic Approach

**Issue:** Current PR contains 191 files in a single commit - too many changes to review effectively.

**Solution:** Break into 7 focused, prioritized PRs with clear dependencies.

## Current State Analysis

The commit `c1193af` adds:
- **191 files** in categories from core app code to themes to vendor dependencies
- **Multiple concerns** mixed together (app logic + dev tools + CI + documentation)
- **Build issues** due to ES module import problems
- **Impossible to review** due to scope and complexity

## Recommended PR Breakdown Strategy

### Phase 1: Foundation (HIGH PRIORITY)

#### PR #1: Core Application & Basic Build
**Files:** ~30 | **Priority:** HIGH | **Dependencies:** None

**What:**
- Core app/ JavaScript files (with import fixes)
- Essential build infrastructure (webpack, package.json)
- Basic Docker setup
- Minimal README

**Why First:** 
- Establishes working baseline
- Fixes import/build issues
- Enables testing of subsequent changes
- Smallest viable increment

**Key Fixes:**
- Add `.js` extensions to ES module imports
- Ensure webpack compilation succeeds
- Test basic app loading

---

### Phase 2: Development Experience (MEDIUM PRIORITY)

#### PR #2: Development Tooling & CI
**Files:** ~15 | **Priority:** MEDIUM | **Dependencies:** PR #1

**What:**
- ESLint, Prettier configuration
- Basic GitHub Actions CI workflow  
- E2E test scripts
- VS Code settings

**Why Second:**
- Enables quality checks on subsequent PRs
- Provides consistent development experience
- Adds automated testing

#### PR #3: Unit Testing Framework
**Files:** ~10 | **Priority:** MEDIUM | **Dependencies:** PR #1

**What:**
- Vitest configuration and setup
- Test mocks and utilities  
- Sample test files
- Testing-related npm scripts

**Why Third:**
- Builds on working application base
- Enables TDD for future features
- Isolated testing concern

---

### Phase 3: Content & Polish (MEDIUM PRIORITY)

#### PR #4: Documentation & Internationalization
**Files:** ~15 | **Priority:** MEDIUM | **Dependencies:** PR #1

**What:**
- Complete README.md and CLAUDE.md
- All localization JSON files
- GitHub/Copilot instructions
- Security audit baseline

**Why Fourth:**
- App functionality is working
- Documentation reflects actual implementation
- Localization can be tested

---

### Phase 4: Advanced Features (LOW PRIORITY)

#### PR #5: Advanced Development Environment
**Files:** ~15 | **Priority:** LOW | **Dependencies:** PR #1, #2

**What:**
- DevContainer setup with Docker Compose
- Advanced webpack configurations
- Bundle analysis tools  
- SSL certificates for local dev

**Why Fifth:**
- Nice-to-have for advanced development
- Builds on core tooling
- Self-contained environment concern

#### PR #6: Themes & UI Assets  
**Files:** ~25 | **Priority:** LOW | **Dependencies:** PR #1

**What:**
- MetroMumble theme files
- SVG icons and images
- SCSS stylesheets
- Favicon assets

**Why Sixth:**
- Visual improvements only
- App functionality independent
- Easy to review as pure assets

#### PR #7: Vendored Dependencies
**Files:** ~90 | **Priority:** LOW | **Dependencies:** PR #1

**What:**
- vendors/mumble-client/ integration
- vendors/netlify-identity-widget/ integration
- Related build configurations

**Why Last:**
- Largest file count but low complexity
- External library integration
- Least likely to break existing functionality

---

## Implementation Approach

### Option A: Incremental Extraction (Recommended)
1. Create new branch from `lite` 
2. Cherry-pick only essential files for PR #1
3. Fix imports and test build
4. Submit PR #1 for review
5. After PR #1 merges, create PR #2 building on it
6. Continue sequence

### Option B: Branch-per-PR (Alternative)
1. Create 7 separate feature branches
2. Each extracts its subset of files from current branch
3. Submit all PRs simultaneously
4. Merge in dependency order

## Benefits of This Approach

- **Reviewable:** Each PR focuses on single concern (~10-30 files)
- **Testable:** Each PR maintains working state
- **Prioritized:** High-value changes land first  
- **Logical:** Clear dependencies between PRs
- **Risk Management:** Issues contained to specific scope
- **Parallelizable:** Lower-priority PRs can be developed in parallel

## Timeline Estimate

- **Week 1:** PR #1 (Foundation)
- **Week 2:** PR #2 & #3 (Development tools) 
- **Week 3:** PR #4 (Documentation)
- **Week 4:** PR #5, #6, #7 (Polish & assets)

This transforms a single overwhelming review into a month of manageable, focused improvements.