# TikTok blog feed

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
Vercel Analytics is enabled only on Vercel deployments.

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/sighmoan1s-projects/v0-tik-tok-blog-feed)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/nc74kTneA77)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Deployment

Your project is live at:

**[https://vercel.com/sighmoan1s-projects/v0-tik-tok-blog-feed](https://vercel.com/sighmoan1s-projects/v0-tik-tok-blog-feed)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/nc74kTneA77](https://v0.app/chat/nc74kTneA77)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

## Shared Bathos design system

The canonical catalogue is https://design.bathos.org. The reader consumes a pinned `@bathos/design-system` release and maps namespaced typography, radius, lavender selection and amber focus tokens into its existing dark theme. Recipes, reading controls, saved articles and trash retain their behaviour. `pnpm verify` builds the static export and checks desktop/Android reader navigation.

The Git-connected Cloudflare Pages project `bathos-web` builds `pnpm build` from main and publishes `out`. The former direct-upload `bathos` project is retained for rollback. Compatible release updates verify the consumer, open an adoption PR and merge it; Git-connected Pages builds deploy the resulting main revision. Major upgrades require deliberate review.

Enable `DESIGN_SYSTEM_UPDATES_ENABLED=true` only after private-repository Actions billing is working and Actions may create update PRs. The updater runs reader verification and waits for hosting checks before merging. GitHub blocked the initial CI job before it started because account billing needs attention; local and Cloudflare-preview browser checks passed.

## Install the reader

The public reader fills the browser viewport on desktop and phones. Use the
Install Bathos button for a browser install prompt or platform instructions.
On iPhone/iPad, use Safari → Share → Add to Home Screen. On supported Android
and desktop browsers, choose Install app from the browser menu.

Visit online once before reading offline. The installed app opens the reader
in a standalone window, and the exported articles and reader assets are cached
together. Saved articles, hidden articles and filters remain on this device.
Use **Update app** when offered to load a new release and its articles.
The reader cache excludes sign-in, post management and API responses; the
manager keeps its own offline shell and device drafts.

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
Post pages and their assets are included in the reader’s offline cache.
