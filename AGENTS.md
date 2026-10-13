# Project instructions

## Complete and deploy changes

The owner wants completed project changes deployed automatically. Unless the user explicitly asks for a draft, review only, or no deployment, carry implementation through validation, commit, push, merge to `main`, and production verification without requesting another confirmation.

- Keep unrelated local changes out of commits. Always create a separate Git worktree and task branch from current `origin/main` before implementation. Never switch branches, edit files, stage changes, or run builds in another agent’s worktree.
- GitHub Actions is intentionally disabled. Before merging, install dependencies with `pnpm install --frozen-lockfile` and `npm ci --prefix workers/admin-oauth`, then run `pnpm verify:release` (Node tests, worker tests, build, desktop/Android reader tests and mobile manager checks). Install Chromium with `pnpm exec playwright install chromium` when needed. Record results in the pull request.
- Require a successful Cloudflare Pages check for the exact PR head commit before merging. Respect branch protections; do not bypass failed local tests or hosting builds or force-push. Historical Actions failures caused solely by billing are not release gates now that Actions is disabled.
- Production is https://bathos.org. The Git-connected Cloudflare Pages project is `bathos-web`; it builds `pnpm build` from `main` and publishes `out`.
- Wait for the deployment of the exact merged commit and verify the affected behavior on production before saying the change is live.
- If publishing fails or credentials are unavailable, explain the specific blocker and distinguish local changes, merged changes, and deployed changes.
- The reader caches content for offline use. Check a fresh online page when verifying deployment, and account for stale service-worker caches when diagnosing old UI.

## Concurrent work

- Create each worktree outside the primary checkout, for example `git worktree add ../bathos-worktrees/TASK -b TASK origin/main` after `git fetch origin`.
- Keep dependency installs, generated output, validation and commits in your own worktree. Do not share `node_modules` or build directories between worktrees.
- Link each PR to its issue, check for overlapping PRs, and integrate current `origin/main` before release validation. Leave other agents’ worktrees and branches intact.

## Email subscriptions

Subscriber emails must be ad-free. Do not enable advertising, sponsorships, or an ad-supported delivery tier. Bathos owns its subscriber list, consent flow, delivery queue and scheduling; Resend is the mail transport. Only display email signup after this backend and delivery path are configured and verified; document the provider and any owner-approved recurring cost.

## Publishing article images

- Store article images in `public/images/posts/<slug>/<name>.<extension>` and reference `/images/posts/<slug>/<name>.<extension>` in Markdown. Preserve the article slug's case. Do not use temporary attachment paths in published posts.
- Inspect the actual image before writing alt text. Describe its relevant content; put source, date and contextual explanation in an optional caption. Never invent a screenshot or use a placeholder when an attachment is unavailable.
- Use `pnpm blog:add-image --post SLUG --file PATH --name NAME --alt "Description" --caption "Optional caption" --after "Exact heading"`. The article must already exist in `content/`. `--name` is an extension-free filename; omit it only if the source basename already contains letters, numbers and hyphens. `--after` inserts immediately after one matching Markdown heading; omit it to append. Omit `--caption` for no caption.
- The helper validates and fully decodes still PNG, JPEG, WebP or GIF images, requires matching extensions, limits files to 10 MiB and 40 million pixels, escapes Markdown text, and refuses overwrites, duplicate references, unsafe paths and symlinked destinations. It preserves source bytes and adds accessible image Markdown plus an italic caption paragraph.
- Run the helper in your isolated task worktree. Review the generated Markdown and image on desktop and mobile. Commit the image, article and any helper changes together; the helper does not commit, push or deploy. Follow all release gates above, including exact-commit Pages checks and fresh production verification.
- Conversation attachments must be downloaded into the task workspace first. If using GitHub's binary blob API, encode the original bytes as base64, include image and article in the same tree/commit, and apply the same validation. Ask for the missing attachment rather than publishing a broken image reference.
