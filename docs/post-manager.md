# Manage posts from your phone

Open https://bathos.org/manage/ and choose **Sign in with GitHub**. Use an account with write access to the Bathos repository. `/admin/` redirects to this manager. The editor ships with the site, so it does not need to download an external CMS before it opens.

Create a post with **New post**, enter its title, description, date, tags and Markdown body, and preview it before saving. A post's slug determines its Markdown filename and must be unique. Open an existing post to edit it. Deletion requires confirmation and removes that post from the repository; the reader's trash only hides posts on that device.

Saving commits content to GitHub. The public site changes after Cloudflare Pages successfully builds that commit. Check publishing status and open the public site to verify the result. A saved commit is not a guarantee that deployment has finished. If another editor changed a post, a conflict preserves your draft: compare the latest version before retrying. Git history can recover a deleted post.

## Add it to your home screen

On iPhone or iPad, open the manager in Safari, tap **Share**, then **Add to Home Screen**. On Android, open it in Chrome and use **Install app** or **Add to Home screen** in the browser menu. Browser labels and installation availability vary. Open the installed Bathos manager icon to write in a standalone window.

Visit the manager online once so its shell and assets can be cached. Use **Device drafts** to continue saved writing, including edits to existing posts, after reopening the app. While offline, you can create or continue a local draft; saving to GitHub, fetching posts, signing in and checking publishing need a connection. Drafts are stored in this browser on this device. They are not synced to other devices, and clearing site data removes them. Sign out on a shared device and review any retained local drafts.

## Release checks

Run `pnpm build`, `node --test tests/*.test.cjs`, and `npm test --prefix workers/admin-oauth`. The production-export browser check is `NODE_PATH=/path/to/playwright/node_modules node scripts/check-post-manager.cjs`; install Playwright and its Chromium browser separately when needed. It mocks only the author API and checks the actual compiled site, including offline shell loading. It does not authenticate against GitHub or write repository content.

Before calling mobile sign-in verified, test the deployed site with an authorized GitHub account: sign in, create a temporary post, update it, confirm its deployment, delete it, and sign out. Also check denied repository access and expired sessions. Perform a real iPhone Safari Add to Home Screen test and an Android Chrome installation test, including the software keyboard, offline draft recovery and returning from OAuth in standalone mode. Desktop mobile viewport emulation cannot prove those device behaviors.

See [authentication and Worker setup](admin-auth.md) for server configuration. Deploy the Worker and Pages changes together, and ensure `/api/*` reaches the Worker.
