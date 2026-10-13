---
title: "Architecture the easy way"
description: "I've picked up a few architectures that make it easy to prototype things that are a bit more complex than a simple webpage"
date: "2026-10-13"
tags: ["AI", "architecture", "prototyping"]
---

> ChatGPT wrote this after reviewing my previous architecture choices across GitHub, because I didn't have time to write it myself. I might come back to it. I've stuck it up here because it may help people trying [Multiple agents the easy way](/posts/multi-agent-easy/).

If you're vibe coding, you can get quite a long way without knowing much about software architecture. Eventually you'll want something that remembers information, lets people sign in, or does work while you've shut your laptop.

You can ask your agent to work this out. It will happily oblige, possibly by building an extraordinary amount of infrastructure for something that three people are ever going to use.

I've used a few approaches now. This blog and [Cultivate](https://github.com/sighmoan1/cultivate) have static Next.js exports. I've used 11ty with Decap CMS in the past. [LinkedIn Slop Filter](https://github.com/sighmoan1/linkedin-slop-filter) is a browser extension. Feedback Analysis has a local Supabase stack and a documented Vercel deployment option. [Delegate](https://github.com/sighmoan1/govuk-delegate-starter) runs several services with Docker and Postgres locally. The Cloud Run work is still an experiment; I wouldn't describe it as my established production setup.

Here's how I'd choose for a new project.

## A decision tree

Start at 1 and follow the answer that fits. You can choose where the app runs separately from where its database lives.

1. Does it need to change another website inside your browser?
   - Yes: a browser extension. You may still need a backend for shared data or a secret API key.
   - No: go to 2.
2. Can it work with published content and information saved on this device?
   - Yes, mostly articles and pages: 11ty + Decap CMS + static hosting.
   - Yes, an interactive app: Next.js static export + Cloudflare Pages.
   - No, or it needs a private server API call: go to 3.
3. Is the server work a small API, with modest data requirements?
   - Yes: a Cloudflare Worker; add D1 if SQLite suits the data. An API proxy alone may need no database.
   - No: go to 4.
4. Does it need a special runtime, several services, or substantial background work?
   - No: Next.js on Vercel is a straightforward starting point. Choose the database at 5.
   - Yes: Docker containers on Cloud Run are worth considering. Choose the database at 5, and plan how jobs run.
5. What do you want the database service to do?
   - Give you Postgres, idle compute savings and convenient database previews: start by looking at Neon.
   - Give you Postgres with an integrated backend, including auth, file storage and realtime: look at Supabase. Neon now has backend services too, so compare the features you actually need.
   - Keep managed Postgres within Google Cloud: look at Cloud SQL.
   - Give you control of the database server, and you're prepared to operate it: Postgres on a persistent VM or another suitable host.

These are starting points. A static site can have a Worker behind it. A Cloud Run app can use Neon or Supabase. Having several agents working on the code doesn't, by itself, mean the app needs several services.

## Websites that don't need a database

For a blog or a site with a lot of content, [11ty](https://www.11ty.dev/) is worth a look. It turns templates and content into ordinary HTML files. [Decap CMS](https://decapcms.org/docs/intro/) gives you an editing interface and saves the content back to Git. Changes trigger a build on your static host. I've used this combination before and it is a perfectly sensible choice if what you want is to publish pages.

The CMS needs authentication configured. "Static website" doesn't mean that everyone can edit it, or that there is no setup involved.

For something with more application-like interaction, I've been using Next.js with static export. Put the code in GitHub and connect it to Cloudflare Pages. A push to the production branch builds and publishes the site. That's how the public reader on this blog works, though its author sign-in uses a separate Worker.

The browser can remember preferences or drafts with localStorage or IndexedDB. Those belong to that browser and device. If people need to share records or pick up where they left off on another device, you need somewhere else to store them.

Tell your agent: "Build a static site deployed from GitHub to Cloudflare Pages. Use 11ty and Decap for content, or Next.js static export for an interactive app. Explain any feature that would require a server before adding one."

## A small backend

A Cloudflare Worker is useful when a website needs to call an API without putting your secret key in the browser, or handle a small amount of server work. D1 is Cloudflare's managed database based on SQLite. It can suit simple records, but it isn't Postgres: check your libraries and required SQL features before choosing it. [Cloudflare's D1 documentation](https://developers.cloudflare.com/d1/) explains the limits and supported behaviour.

Don't add a database just because you've added an API. If the API only forwards a request to another service, there may be nothing to store. And hiding an API key is only part of the job: ask the agent to limit who can call the endpoint and how much they can spend through it.

## An app with users and shared data

Next.js on Vercel is a convenient starting point when you need server code as well as pages. You still need to choose a database and work out how users sign in. Vercel's own hosting bill is separate from the database bill; check its [plan limits](https://vercel.com/pricing) for your project.

Supabase puts Postgres together with authentication, storage, APIs and realtime features. That can save quite a lot of joining things up. Feedback Analysis uses its database, auth and private storage; moving that app to another database provider would also mean dealing with those dependencies.

Neon is an alternative I'd consider when the main requirement is Postgres. It now also lists Managed Better Auth, a Data API, Functions and Object Storage. The old shorthand of "Supabase does the backend, Neon only does the database" is out of date. Ask the agent to compare the specific auth and storage behaviour you need, including what would have to change if you moved later. [Neon's current service and pricing page](https://neon.com/pricing) is the place to start.

## Neon, Supabase or my own Postgres?

For a small prototype that spends most of its life doing nothing, I'd look at Neon first. Its database compute can suspend when idle and wake when a connection arrives. On paid plans the stored data still costs money. Polling and background jobs can keep the database awake, and waking it introduces a delay. "Scales to zero" needs to match how the app actually behaves.

Neon's published Launch rate is $0.106 per CU-hour, with no monthly minimum, plus $0.35 per GB-month for database storage. A CU-hour is compute size multiplied by hours running. At 0.25 CU, ten active hours cost about $0.27 in compute; running for 730 hours costs about $19.35. Storage, history, extra branches and any other services are additional. The free plan has usage limits and suspends compute when some quotas are exhausted. These are USD prices checked on 13 October 2026; use the [live pricing](https://neon.com/pricing) before budgeting.

Supabase's [Free plan](https://supabase.com/pricing) allows two active projects and pauses inactive projects after a week. Pro starts at $25 a month per organisation, with $10 in compute credits covering one Micro instance. Another Micro project is roughly $10 a month in compute before other usage. Paid projects don't automatically pause when idle, so an unused prototype can still have a monthly bill. You may be happy to pay that to get the integrated backend and keep it available.

Database branching is useful with agents. A Git worktree keeps their files apart, but if they all use the same database they can still break each other's work. Neon can create isolated copy-on-write branches from a database, including its data, or just its schema. Writes on a branch don't alter its parent. Included branch allowances apply, with additional branches currently $1.50 per branch-month on paid plans, prorated hourly, plus compute and changed data. See [Neon's branching guide](https://neon.com/docs/introduction/branching).

Supabase also has [preview branches](https://supabase.com/docs/guides/deployment/branching), with separate backend environments and credentials. They start without production data by default; you can seed them, or use the dashboard's data option. [Branch compute](https://supabase.com/docs/guides/platform/manage-your-usage/branching) starts at $0.01344 an hour for Micro, about $9.81 if left running for 730 hours, plus other usage. Compute credits and the spend cap don't cover branch compute. Close or delete previews when you're done.

For agent previews, I'd usually use schema-only branches with synthetic data. Give each preview its own connection string and apply migrations there. Database branches don't merge rows back like Git merges files: promote the reviewed migration through your deployment process. Test that migration against the latest schema before production.

Running Postgres yourself buys control over the machine, extensions and configuration. The software is free; the machine, persistent disks and backups aren't. You also own upgrades, monitoring, recovery and proving that a backup restores. An always-on VM has an idle cost whether anyone uses the app or not. I'd choose this when there is a concrete reason for that control, or when learning to operate Postgres is part of the project.

Cloud SQL is another option: Google operates the database, while you configure access, sizing and backups. It fits a Google Cloud deployment, but an idle running instance still costs money. Stopping it suspends instance charges while storage and some IP charges continue. The bill depends on region, size and availability settings, so use the [Cloud SQL calculator](https://cloud.google.com/products/calculator) rather than assuming it shares Cloud Run's idle pricing. Google's [idle-instance guidance](https://docs.cloud.google.com/sql/docs/postgres/recommender-sql-idle) explains the charges that remain.

## Docker and Cloud Run

Docker is useful when you want a repeatable environment with the runtime and tools your application needs. Delegate's local stack has separate services and Postgres databases. That is evidence of a working local setup, not proof that you can send the same Compose file to Cloud Run and forget about it.

On Cloud Run, deploy the application containers and connect them to a persistent database. Its writable container filesystem is disposable and held in memory. It is unsuitable for keeping your Postgres data directory. Google's [container contract](https://docs.cloud.google.com/run/docs/container-contract) describes this, and its [Cloud SQL connection guide](https://docs.cloud.google.com/sql/docs/postgres/connect-run) gives one supported database arrangement.

For an occasional container app, I'd consider Cloud Run with Neon. For an app already relying on Supabase auth and storage, keeping Supabase may save a migration. Cloud SQL is worth considering when Google Cloud networking and management are requirements. Self-hosted Postgres needs a persistent host and someone willing to operate it.

Choose nearby regions and use an appropriate connection pool. Set limits on how many app instances can start, so autoscaling doesn't exhaust the database's connections. Keep credentials in server secrets, and run migrations as a deliberate deployment step rather than having every container race to change the schema.

Cloud Run services can scale to zero with minimum instances set to zero. Keeping instances warm costs money. Jobs and background workers need their own execution plan; don't assume a request-billed service will carry on processing after it has returned a response. Add database, image storage, builds and network transfer to the [Cloud Run cost estimate](https://cloud.google.com/run/pricing). Two services scaling down independently can also mean two cold starts on the next request.

## What I'd ask the agent to do

Give it the actual requirements: who will use this, whether they need accounts, what must survive closing the browser, and whether any work needs to continue without you. Say what monthly spend is acceptable.

Then ask: "Choose the simplest architecture that meets these requirements. Explain where the code runs, where persistent data lives, how sign-in works and what still costs money when nobody uses it. Put the setup and deployment instructions in the repo. Give previews separate data, test the important user journeys, and verify the published app after deployment."

Put that decision in the repository before you start assigning issues to agents. Otherwise each agent can arrive with its own excellent plan for a completely different app.
