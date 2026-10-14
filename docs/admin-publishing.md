# Publishing and recovering posts

Use the [post manager](post-manager.md) at https://bathos.org/manage/. `/admin/` redirects there; Decap and its browser-token flow have been retired. Sign in with a GitHub account that can write to Bathos, create or edit a post, preview it and save. Deletion requires confirmation. The reader's trash only hides posts on that device.

Saving or deleting submits a change on a publishing branch and creates a pull request. The required release and Cloudflare Pages preview checks must pass before automatic merge. The public site updates after Cloudflare deploys the exact merged commit. Failed checks preserve the Git change and your device draft. See [CI and publishing](ci.md) for retries, conflicts and protected publishing.

## Checking deployment

The manager tracks its own publication and follows the exact merged commit's production deployment. Open the progress link to inspect checks or failures. A successful preview is not a production deployment; verify the affected post on a fresh public page after the production check passes.

The publishing Worker keeps credentials in encrypted HttpOnly sessions. Browser JavaScript does not receive GitHub tokens. See [authentication](admin-auth.md) for scope restrictions, reauthorization and standalone Worker deployment requirements.

## Hosting setup

`bathos-web` is the Git-connected Cloudflare Pages project, with production branch `main`, build command `pnpm build`, and output directory `out`. `bathos.org` must be assigned to this project. Keep build watch paths inclusive of `content/**`. Cloudflare Pages builds do not deploy the separate authentication Worker; its rollout must be verified separately.

## Recovering a deleted or overwritten post on a phone

1. Open the repository [Git history](https://github.com/sighmoan1/bathos/commits/main/). Sign in to GitHub to make changes.
2. Find the deletion/edit commit and open its changed files. To recover one post, open that Markdown file's version **before** the commit (use the parent commit/browse-files view), choose **Raw**, and copy the complete text, including the front matter between `---` lines.
3. In the repository, open `content`, use **Add file → Create new file**, and enter the original filename for a deletion. For an overwritten post, open its current file and choose **Edit**. Paste the recovered text. Create a recovery branch and pull request. The required checks must pass and the PR must merge before the production site changes.
4. Check the restoration commit's Cloudflare deployment and open the public site.

GitHub may put file controls under a menu on narrow screens; **Request Desktop Website** exposes the full repository editor if needed. For an entire change merged through a pull request, GitHub's **Revert** button on that merged PR creates a new reversal PR; review it and merge it. Older direct commits do not have that PR Revert button. Copying the previous file as above works for those commits and restores only the intended post.

## Recovering from a computer

Choose the last good commit or the parent of the deletion commit. Restore only the affected content file so other authors' changes stay intact:

```sh
git fetch origin
git worktree add ../bathos-recovery -b recovery/restore-post origin/main
cd ../bathos-recovery
# Replace GOOD_COMMIT and filename.md with the version/path from Git history.
git restore --source=GOOD_COMMIT -- content/filename.md
git diff -- content/filename.md
git add content/filename.md
git commit -m "Restore deleted post"
git push -u origin recovery/restore-post
```

Create a pull request for the recovery branch, pass the release and Pages checks, and merge it. To undo a whole isolated commit, use `git revert COMMIT_SHA` on a recovery branch and review all resulting changes before committing/pushing. Recovery produces a new Git commit and still needs a successful deployment; never force-push or rewrite history to restore a post.
