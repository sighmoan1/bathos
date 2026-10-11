# TikTok blog feed

## Cloudflare Pages

This app exports a static site. Recipes are read from `content/*.md` at build
time; reading, swiping, filtering, saved articles, and trash run in the browser.
Saved articles and preferences are specific to the browser and domain.

Connect `sighmoan1/bathos` to Cloudflare Pages with these build settings:

- Framework preset: **Next.js (Static HTML Export)**
- Build command: `pnpm build`
- Build output directory: `out`
- Production branch: the repository's default branch

After deployment, add `bathos.org` under the Pages project's **Custom domains**.
Cloudflare manages the DNS record and HTTPS certificate for the domain when
its zone is in the same account. Recipe changes require a new build; connected
Git pushes trigger this automatically. No Workers or server functions are needed.
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
