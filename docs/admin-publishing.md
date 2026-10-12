# Publishing and recovering posts

On your phone, open [bathos.org/admin/](https://bathos.org/admin/), sign in with GitHub, choose **Posts**, and create a post or open an existing one. Fill in its fields, switch between editing and preview, and save. To remove a post, open it and choose **Delete**. Decap asks for confirmation before deleting, including a warning if you have unsaved edits. Cancel that prompt to keep the post.

A successful save means the Markdown change is committed to the repository's `main` branch. A successful delete removes the Markdown file from `main`. Neither action immediately updates the public site. Cloudflare Pages must build and deploy that commit first. The reader's trash is different: it only hides posts in that browser and does not change the repository or anyone else's feed.

## Checking deployment

The publishing panel distinguishes **saved to Git** from deployment status. Tap **Check deployment** after signing in. It shows the checked `main` commit's short SHA, and a build details link when Cloudflare supplies one. This is a snapshot of the branch and may include another author's changes; it does not identify the exact commit of your own save. To confirm your save specifically, open **Git history**, select its commit, and inspect the changed files and Cloudflare check.

The panel accepts only the `Cloudflare Pages` check from the `cloudflare-workers-and-pages` GitHub App for the `bathos-web` project and exact checked SHA. It ignores Vercel, unrelated tests, other Pages projects, checks on a different commit, and Cloudflare checks linked to a pull request or containing a branch preview URL. The newest retry of the matching check determines the result:

- **Queued/building**: wait for deployment. The panel retries once per minute, up to five times while visible.
- **Deployment check passed**: Cloudflare reported a successful deployment. Open the public site to verify the post; a successful check alone does not prove the domain points to that project or that your phone's cached page has refreshed.
- **Failed/cancelled**: the Git change remains saved, but the site may still show its earlier version. Follow the build details link and repair the build or retry it in Cloudflare.
- **Unknown/unavailable**: no matching check, a skipped check, missing permissions, API failure, or a request limit prevented confirmation. Do not infer that the change is live. Open its GitHub commit checks or the Cloudflare dashboard.

Checks are limited to once per minute. Requests use Decap's existing signed-in GitHub credential in memory, only against `api.github.com`; the panel never logs it or persists an additional copy. Signed-out users cannot query this private repository. The adapter depends on the pinned Decap 3.9.0 backend factory and must be checked when upgrading Decap.

## Hosting setup

`bathos-web` is the Git-connected Cloudflare Pages project, with production branch `main`, build command `pnpm build`, and output directory `out`. `bathos.org` must be assigned to this project for repository changes to update that domain. A separate direct-upload project named `bathos` does not automatically rebuild after CMS saves. See the deployment setup before assigning the production domain. Keep build watch paths inclusive of `content/**`; skipping those changes prevents publication. The admin checks never treat a Vercel deployment as deployment of bathos.org.

## Recovering a deleted or overwritten post on a phone

1. Open **Git history** in the publishing panel. Sign in to GitHub if needed; the repository is private.
2. Find the deletion/edit commit and open its changed files. To recover one post, open that Markdown file's version **before** the commit (use the parent commit/browse-files view), choose **Raw**, and copy the complete text, including the front matter between `---` lines.
3. In the repository, open `content`, use **Add file → Create new file**, and enter the original filename for a deletion. For an overwritten post, open its current file and choose **Edit**. Paste the recovered text. Commit to `main` if your permissions allow it, or create a branch and pull request to merge it. A PR must merge before the production site changes.
4. Check the restoration commit's Cloudflare deployment and open the public site.

GitHub may put file controls under a menu on narrow screens; **Request Desktop Website** exposes the full repository editor if needed. For an entire change merged through a pull request, GitHub's **Revert** button on that merged PR creates a new reversal PR; review it and merge it. Direct CMS commits do not have that PR Revert button. Copying the previous file as above works for those commits and restores only the intended post.

## Recovering from a computer

Choose the last good commit or the parent of the deletion commit. Restore only the affected content file so other authors' changes stay intact:

```sh
git switch main
git pull --ff-only
# Replace GOOD_COMMIT and filename.md with the version/path from Git history.
git restore --source=GOOD_COMMIT -- content/filename.md
git diff -- content/filename.md
git add content/filename.md
git commit -m "Restore deleted post"
git push origin main
```

If branch protection requires pull requests, create a recovery branch before restoring and merge its PR instead of pushing `main`. To undo a whole isolated CMS commit, use `git revert COMMIT_SHA` and review all resulting changes before committing/pushing. Recovery produces a new Git commit and still needs a successful deployment; never force-push or rewrite history to restore a post.
