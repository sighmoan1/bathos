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
