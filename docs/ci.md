# Continuous integration and publishing

The `CI` workflow runs the `Release checks` job for pull requests targeting
`main`, pushes to `main`, merge queues, and manual runs. It uses a standard
GitHub-hosted Ubuntu runner with Node.js 22 and pnpm 10.28.0. Both package
lockfiles are enforced before checking TypeScript and running `pnpm verify:release`, including the
publishing Worker's tests, the static build, desktop/Android browser tests and
mobile manager checks. Browser tests use local servers and mocked publishing
APIs; CI never publishes posts or deploys to Cloudflare.

## Security policy

- Workflow permissions are `contents: read`; all other token permissions are
  disabled. Checkout does not retain GitHub credentials in Git configuration.
- Repository Actions policy allows only the approved checkout and setup-node
  action commits and requires full commit-SHA pinning. Updating a pinned action
  requires reviewing the release and updating the repository allowlist.
- Actions cannot approve pull requests. All external contributors' fork runs
  require maintainer approval. Review changes before approving such runs.
- No publishing credentials or repository/environment secrets are supplied to
  the workflow. Use `pull_request`, never a privileged `pull_request_target`
  workflow that executes untrusted changes. Do not add self-hosted runners.
- Runs have a 25-minute timeout; superseded runs are cancelled. No test
  artifacts or caches are uploaded by this workflow.

## Required checks and release flow

`main` requires pull requests, passing `Release checks` from GitHub Actions,
and passing `Cloudflare Pages` from the Cloudflare integration. Checks must
pass with the branch up to date with `main`. Administrator bypass is disabled;
force pushes and branch deletion are blocked. An owner can merge their own PR
once the checks pass; an additional review approval is not required.

Agents publish content changes through a branch and pull request, wait for the
required checks, and merge (or enable auto-merge). Cloudflare Pages
still builds `pnpm build` and deploys `out` from merged `main` commits. CI does
not receive Cloudflare credentials. Native Cloudflare preview builds are
separate from Actions CI and do not replace the production domain.

The `/manage/` API saves post changes to a new `codex/publish-*` branch, creates
a pull request and enables GitHub auto-merge. Save and Delete retain their
normal interface; the manager shows publishing progress while checks run.
Only authenticated repository writers can submit posts. No extra review
approval is needed, and outside pull requests are never automatically approved
or merged by this flow.

The manager polls its own publication, updates its branch if `main` advances,
and follows the merged commit's production deployment before reporting the
post live. GET status requests never mutate GitHub; polling that may update a
branch or queue a merge uses POST with the existing session and Origin checks.
Further Save/Delete requests are disabled while the publication is pending,
and pending status survives a reload on the same device. Device drafts remain
available. Failed checks leave the publication unmerged and display a progress
link; after fixing or rerunning checks, reload the manager to resume tracking.
Do not introduce a protection bypass to restore direct publishing.

These repository controls do not prevent direct deployments by someone who
already has Cloudflare deployment credentials. Audit those permissions
separately.
