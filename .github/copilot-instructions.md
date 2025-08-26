# Repository instructions for GitHub Copilot

These instructions tell Copilot how to best assist when working in this repo.

## What this project is
- HTML5 Mumble web client (lite UI), optimized for all major browsers, incl. Safari ≥ 11.
- Bundled with webpack 5 and Babel; runs fully in the browser (no Node APIs at runtime).
- Ships a Docker entrypoint which can either serve static files or provide a WebSocket tunnel via websockify.

## Tech stack and constraints
- Language: JavaScript (ES2015+ transpiled via Babel). No TypeScript in this repo.
- Bundler: webpack 5. Keep config minimal; rely on existing loaders/plugins.
- Styles: SCSS processed via sass-loader (themes under `themes/`).
- Web workers: loaded via `worker-loader`. Don’t convert workers to other patterns.
- Node version: 16.x (see `Dockerfile`). Avoid suggesting upgrades unless explicitly requested.
- Dependencies are pinned/explicit. Prefer adding none; if necessary, pick lightweight, well-maintained libs.

## How to build, run, and test
- Build: `npm run build` (outputs to `dist/`).
- E2E smoke test (WebSocket tunnel & static serving): `npm run test:e2e`.
- Static serving (no tunnel): set `SKIP_TUNNEL=1` and run `./docker-entrypoint.sh` (serves `dist/`).
- Tunnel mode: set `MUMBLE_SERVER=host:port` and run `./docker-entrypoint.sh` (optionally `PLAIN_TARGET=1`).
- Do not edit files in `dist/` directly; change sources and rebuild.

## Repository shape (high-level)
- `app/` browser code, entry points (`index.js`, `index.html`, `config.js`, `theme.js`) and workers.
- `themes/` SCSS themes (MetroMumbleLight is default). Keep asset paths stable.
- `localize/` translations. Keys should be added consistently across locales.
- `scripts/e2e-check.cjs` local tunnel + echo server test. Keep CLI and env vars stable.
- `docker-entrypoint.sh` controls static serving and websockify tunnel. Avoid behavior changes unless required.
- `webpack.config.js` uses NodePolyfillPlugin and specific loaders. Avoid sweeping reconfigurations.

## Coding conventions and preferences
- Favor small, surgical edits. Don’t reformat large files or churn unrelated code.
- Keep browser compatibility in mind; avoid Node-only APIs in `app/` code.
- Use existing patterns/utilities (e.g., workers, DOMPurify, existing stream/adapters) instead of new abstractions.
- Prefer functional, readable JS. Avoid class-heavy rewrites unless necessary.
- Respect public shapes and URLs (e.g., query params like `theme=`, `address=`, `port=`). Treat them as semi-stable API.
- Error handling: fail fast with concise console errors; avoid noisy logs in hot paths.

## Dependency guidance
- Don’t introduce heavy deps for trivial tasks. Check if a native/browser API or existing dep suffices.
- If adding a dep:
  - Pin a specific version.
  - Explain why it’s needed and tradeoffs.
  - Ensure webpack/Babel can bundle it for browsers.
- Avoid major upgrades to webpack/Babel/sass unless requested; note implications if you believe one is necessary.

## Testing and verification
- After changes which affect bundling/runtime, run:
  - `npm run build`
  - `npm run test:e2e`
- Prefer adding small, targeted tests to `scripts/` or add lightweight checks rather than introducing full test frameworks.

## i18n and UI notes
- For user-visible text, add/modify keys under `localize/` and reference them via existing localization utilities.
- Keep the “lite” UI philosophy: minimal, space-efficient, no channel tree or VAD UI.
- Theme additions: follow `themes/MetroMumbleLight/` structure; don’t break existing class names.

## Security & privacy
- Treat all user-provided/remote content as untrusted; sanitize where relevant (DOMPurify is available).
- Don’t embed secrets or assume network trust. Keep tunnel defaults conservative.
- Avoid suggesting mixed-content patterns; prefer secure contexts when relevant.

## What to avoid
- Don’t commit generated artifacts changes by hand; let webpack produce `dist/`.
- Don’t switch build tools or introduce TypeScript without explicit direction.
- Don’t remove NodePolyfillPlugin or worker-loader paths without a migration plan.
- Don’t bake in environment-specific addresses; honor existing env vars and query params.

## Good PR/commit hygiene (for AI-suggested changes)
- Keep PRs small and focused; explain the “why” and impact.
- Use imperative, concise commit messages (e.g., “Fix Safari AudioContext resume on user gesture”).
- Include a short “How verified” section (build + e2e status) in PR descriptions.

## Common tasks Copilot can help with
- Adding a small feature flag/config surfaced via `config.local.js`.
- Minor UI tweaks or theme variables with SCSS.
- Extending localization keys across all locales.
- Small worker adjustments without changing message protocol.
- Tight, targeted performance improvements (e.g., avoid extra array copies, use typed arrays where appropriate).

## Known pitfalls
- Using Node-specific modules in browser code will break at runtime even with polyfills; prefer browser-native APIs.
- Web worker bundling relies on `worker-loader`; changing import styles can break URLs.
- Large assets will trigger webpack size warnings; acceptable but keep mindful of bundle weight.

---
If a requested change conflicts with these guidelines, point it out and propose a minimal, compatible alternative.
