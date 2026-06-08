# Copilot Instructions — mumbling-mole

`AGENTS.md` at the repository root is the **single canonical, tool-independent source** of agent
guidance. GitHub Copilot reads `AGENTS.md` natively, so this file stays a thin pointer to avoid
duplicated, drifting rules.

- Read [`AGENTS.md`](../AGENTS.md) before doing repository work.
- Path-specific rules live in [`.github/instructions/`](instructions/) with `applyTo` globs and
  are summarized in `AGENTS.md` under "Scoped rules".
- The default branch is `lite`; branch off and target `lite`, never `master`/`upstream-master`.

### Scoped rules (`.github/instructions/`)

- `@.github/instructions/containerization-docker-best-practices.instructions.md` — optimized, secure Docker images and container runtime.
- `@.github/instructions/devops-core-principles.instructions.md` — DevOps principles (CALMS) and DORA metrics.
- `@.github/instructions/github-actions-ci-cd-best-practices.instructions.md` — secure, efficient GitHub Actions CI/CD.
- `@.github/instructions/playwright-typescript.instructions.md` — Playwright test generation.
- `@.github/instructions/security-and-owasp.instructions.md` — OWASP Top 10 secure-coding standards.
- `@.github/instructions/self-explanatory-code-commenting.instructions.md` — self-explanatory code with minimal comments.
- `@.github/instructions/shell.instructions.md` — shell scripting best practices (bash/sh/zsh).
- `@.github/instructions/vuejs3.instructions.md` — Vue 3 Composition API and TypeScript standards.

Do **not** copy rules into this file. If a rule should apply to agents, update `AGENTS.md` instead.
