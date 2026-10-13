# Project instructions

## Complete and deploy changes

The owner wants completed project changes deployed automatically. Unless the user explicitly asks for a draft, review only, or no deployment, carry implementation through validation, commit, push, merge to `main`, and production verification without requesting another confirmation.

- Keep unrelated local changes out of commits. Use an isolated worktree when necessary.
- Run checks appropriate to the change and respect required CI and branch protections. Use a pull request when needed; do not bypass failing checks or force-push.
- Production is https://bathos.org. The Git-connected Cloudflare Pages project is `bathos-web`; it builds `pnpm build` from `main` and publishes `out`.
- Wait for the deployment of the exact merged commit and verify the affected behavior on production before saying the change is live.
- If publishing fails or credentials are unavailable, explain the specific blocker and distinguish local changes, merged changes, and deployed changes.
- The reader requires an online connection and does not register a service worker. The legacy /sw.js endpoint retires old reader caches and registrations. Check a fresh online page when verifying deployment, and account for legacy service-worker caches when diagnosing old UI.
