# Project instructions

## Complete and deploy changes

The owner wants completed project changes deployed automatically. Unless the user explicitly asks for a draft, review only, or no deployment, carry implementation through validation, commit, push, merge to `main`, and production verification without requesting another confirmation.

- Keep unrelated local changes out of commits. Always create a separate Git worktree and task branch from current `origin/main` before implementation. Never switch branches, edit files, stage changes, or run builds in another agent’s worktree.
- GitHub Actions CI is enabled. The required `Release checks` job in `.github/workflows/ci.yml` installs locked dependencies and runs `pnpm verify:release` (Node tests, worker tests, build, desktop/Android reader tests and mobile manager checks). Before merging, also validate locally with `pnpm install --frozen-lockfile`, `npm ci --prefix workers/admin-oauth`, and `pnpm verify:release`. Install Chromium with `pnpm exec playwright install chromium` when needed. Record results in the pull request.
- Require successful `Release checks` and Cloudflare Pages checks for the exact PR head commit before merging. Respect branch protections; do not bypass failed CI, local tests or hosting builds or force-push. See `docs/ci.md` for the CI security policy and protected publishing flow.
- Production is https://bathos.org. The Git-connected Cloudflare Pages project is `bathos-web`; it builds `pnpm build` from `main` and publishes `out`.
- Wait for the deployment of the exact merged commit and verify the affected behavior on production before saying the change is live.
- If publishing fails or credentials are unavailable, explain the specific blocker and distinguish local changes, merged changes, and deployed changes.
- The reader caches content for offline use. Check a fresh online page when verifying deployment, and account for stale service-worker caches when diagnosing old UI.

## Concurrent work

- Create each worktree outside the primary checkout, for example `git worktree add ../bathos-worktrees/TASK -b TASK origin/main` after `git fetch origin`.
- Keep dependency installs, generated output, validation and commits in your own worktree. Do not share `node_modules` or build directories between worktrees.
- Link each PR to its issue, check for overlapping PRs, and integrate current `origin/main` before release validation. Leave other agents’ worktrees and branches intact.

## Email subscriptions

Subscriber emails must be ad-free. Do not enable advertising, sponsorships, or an ad-supported delivery tier. Only display email signup after the real newsletter and delivery path are configured and verified; document the provider and any owner-approved recurring cost.
