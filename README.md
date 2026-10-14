# Bathos

## Manage posts from your phone

Open [bathos.org/manage/](https://bathos.org/manage/) and sign in with GitHub
using an account with repository write access. Create, preview, update and delete
posts in the mobile editor. Add it to your home screen for an app-like window;
local drafts remain available offline after the first online visit. Saving and
publishing require a connection and a successful Cloudflare deployment.

See [installation, draft recovery and release checks](docs/post-manager.md) and
[authentication setup](docs/admin-auth.md). The reader's trash only hides posts
in that browser.

## Cloudflare Pages

Cloudflare Pages and Workers are the hosting platform. The experimental
DigitalOcean migration (PR #21) was abandoned on 14 October 2026 and never
merged. See [operating status and remaining activation work](docs/operations-status.md).

This app exports a static site. Recipes are read from `content/*.md` at build
time; reading, swiping, filtering, saved articles, and trash run in the browser.
Saved articles and preferences are specific to the browser and domain.

The Git-connected project is `bathos-web` for `sighmoan1/bathos`. Use these build settings:

- Framework preset: **Next.js (Static HTML Export)**
- Build command: `pnpm build`
- Build output directory: `out`
- Production branch: `main`

Assign `bathos.org` under `bathos-web`'s **Custom domains**. The separate
direct-upload project `bathos` does not publish CMS commits automatically.
Cloudflare manages the DNS record and HTTPS certificate for the domain when
its zone is in the same account. Recipe changes require a new build; connected
Git pushes trigger this automatically. The public reader is static; author sign-in uses the separate OAuth Worker.

## Shared Bathos design system

The canonical catalogue is https://design.bathos.org. The reader consumes a pinned `@bathos/design-system` release and maps namespaced typography, radius, lavender selection and amber focus tokens into its existing dark theme. Recipes, reading controls, saved articles and trash retain their behaviour. `pnpm verify` builds the static export and checks desktop/Android reader navigation.

The Git-connected Cloudflare Pages project `bathos-web` builds `pnpm build` from `main` and publishes `out`. The former direct-upload `bathos` project is retained for rollback.

## Validate and release

GitHub Actions runs the required `Release checks` job. Validate locally before
opening a pull request:

```sh
pnpm install --frozen-lockfile
npm ci --prefix workers/admin-oauth
npm ci --prefix workers/webmention
pnpm exec playwright install chromium
pnpm exec tsc --noEmit
pnpm verify:release
pnpm verify:webmentions-enabled
```

Record validation results in the PR, wait for both `Release checks` and `Cloudflare Pages` to succeed for its exact head commit, then merge to `main`. Wait for the Cloudflare production deployment of the exact merged commit and check the affected behavior on a fresh online page. Verify that old reader registrations and caches are retired on existing installations.

Design-system updates are manual: run `node scripts/update-design-system.mjs` with authenticated GitHub access, review the dependency changes, then follow the same validation, PR and deployment process. Major upgrades require deliberate review. The former scheduled Actions updater is disabled.

## Install the reader

The public reader fills the browser viewport on desktop and phones. Use the
Install Bathos button for a browser install prompt or platform instructions.
On iPhone/iPad, use Safari → Share → Add to Home Screen. On supported Android
and desktop browsers, choose Install app from the browser menu.

The installed app opens the reader in a standalone window. Articles require an
internet connection; refresh to load new releases. Saved articles, hidden
articles and filters remain on this device. Existing reader caches are removed
on upgrade; the manager keeps its separate offline shell and device drafts.

Validation: `pnpm build`, `pnpm test:e2e`, `node --test tests/*.test.cjs`,
`npm test --prefix workers/admin-oauth`, and the mobile manager browser check.
A real device installation check is still needed to verify native home-screen
and standalone behavior.

## Share a post

Each post has a permanent `/posts/<slug>/` URL based on its Markdown filename.
Open a title or Read Article to read it, then use Share on the card or article
to open the device share sheet or copy its link. If clipboard access is blocked,
a selectable link is shown. Direct links open even when the post is hidden or
excluded by local filters. Keep filenames unchanged to preserve existing links.
Post pages require an internet connection.
