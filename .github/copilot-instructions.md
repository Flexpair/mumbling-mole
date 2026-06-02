# Copilot Instructions — mumbling-mole

`AGENTS.md` at the repository root is the **single canonical, tool-independent source** of agent
guidance. GitHub Copilot reads `AGENTS.md` natively, so this file stays a thin pointer to avoid
duplicated, drifting rules.

- Read [`AGENTS.md`](../AGENTS.md) before doing repository work.
- Path-specific rules live in [`.github/instructions/`](instructions/) with `applyTo` globs and
  are summarized in `AGENTS.md` under "Scoped rules".
- The default branch is `lite`; branch off and target `lite`, never `master`/`upstream-master`.

Do **not** copy rules into this file. If a rule should apply to agents, update `AGENTS.md` instead.
