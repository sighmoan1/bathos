# Project instructions

## Complete and deploy changes

The owner wants completed project changes deployed automatically. Unless the user explicitly asks for a draft, review only, or no deployment, carry implementation through validation, commit, push, merge to `main`, and production verification without requesting another confirmation.

- Keep unrelated local changes out of commits. Use an isolated worktree when necessary.
- GitHub Actions is intentionally disabled. Before merging, install dependencies with `pnpm install --frozen-lockfile` and `npm ci --prefix workers/admin-oauth`, then run `pnpm verify:release` (Node tests, worker tests, build, desktop/Android reader tests and mobile manager checks). Install Chromium with `pnpm exec playwright install chromium` when needed. Record results in the pull request.
- Require a successful Cloudflare Pages check for the exact PR head commit before merging. Respect branch protections; do not bypass failed local tests or hosting builds or force-push. Historical Actions failures caused solely by billing are not release gates now that Actions is disabled.
- Production is https://bathos.org. The Git-connected Cloudflare Pages project is `bathos-web`; it builds `pnpm build` from `main` and publishes `out`.
- Wait for the deployment of the exact merged commit and verify the affected behavior on production before saying the change is live.
- If publishing fails or credentials are unavailable, explain the specific blocker and distinguish local changes, merged changes, and deployed changes.
- The reader caches content for offline use. Check a fresh online page when verifying deployment, and account for stale service-worker caches when diagnosing old UI.
