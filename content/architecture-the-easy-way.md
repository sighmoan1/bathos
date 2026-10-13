---
title: "Architecture the easy way"
description: "A short list of setups that make it easy to prototype things that are a bit more complex than a simple webpage"
date: "2026-10-13"
tags: ["AI", "architecture", "prototyping"]
---

> ChatGPT wrote the first version of this after reviewing my previous architecture choices across GitHub, because I didn't have time to write it myself. I've since rewritten it with Claude and done some edits of my own. I might come back to it. I've stuck it up here because it may help people trying [Multiple agents the easy way](/posts/multi-agent-easy/). I'm not particularly happy with it and will try to get to more explicit instructions. It might still be good enough to point your agent at and have it make a call for you.

If you're vibe coding, you can get a long way without knowing anything about software architecture. Then one day you want your thing to remember something, or let people sign in, or keep working after you've shut your laptop, and your agent starts asking you questions you can't answer.

You can let the agent decide, but the risk is every project ends up built a different way, you never get a feel for how any of them work and it becomes harder to maintain and debug than if you have a broad understanding of what has been built. I found it much easier to stick to a small set of setups and reuse them. Then I mostly know where things live when something breaks.

Here's the list, in order of how complicated it gets.

## A decision tree

Go down the list and stop at the first one that sounds like your project.

**1. Do you want to change a site you already use?** For example, hiding posts in your social media feed.

Build a browser extension. It runs in your own browser, so there's nothing to host.

**2. Is it mostly pages people read?** A blog, a portfolio, a site about your project.

Use 11ty with Decap CMS, on Cloudflare Pages. Decap gives you an editing screen, so you can add posts without touching code. If you want a contact form, use Formspree. You don't need a database, all the posts live in GitHub. If you like, you can not bother with Decap and just edit posts directly from the Git repo. 

**3. Is it a tool people use, but nothing needs saving?** A calculator, a quiz, a converter.

Use Next.js with static export, on Cloudflare Pages. If it calls an API that needs a secret key, add a Cloudflare Worker so the key isn't exposed in the browser.

**4. Does it need to save things, but nobody signs in?** A shared guestbook, a voting page, a log.

Add a Cloudflare Worker and D1 to your Cloudflare Pages site.

**5. Do people need to sign in and see their own stuff?** A site with user accounts.

Use Next.js on Vercel with Supabase. If it's a prototype that will sit unused most of the time, consider Neon. Neon is good and gives you more dbs on the free plan. 

**6. Is it several things talking to each other?** Several sites, Python scripts wrangling data, or jobs that run on a timer or in the background.

Ask your agent whether it can all be done with Vercel and Supbase. If not, put the whole thing in Docker, then run it on a rented server or on Google Cloud Run.

Supabase is a cloud product, but it's also an opensource database, so you can run it locally. I often do this during development, because I'm in the habit of being constrained by their free plan, and it is easy to get my agent to put everything for a project in a Docker container and make the services available at different ports on localhost. It's also easy to use cloudflare tunnels and zero trust to give you a demo of something pretty complicated running on your local machine but served to the public internet, or behind zero trust auth – which hits the user before they hit your site, so you don't need to manage auth in your project – while your laptop is on.

**Not sure?** Paste this list into your agent, describe your project, and ask which number it is. 

The rest of this post explains each one.

## 1. Browser extensions

An extension changes what you see on sites you already use. It runs on your machine, so there's no hosting bill and no server to look after.

If it needs data that other people share, or calls an API with a secret key, it needs a backend too. Treat that part as step 3 or 4.

## 2. Pages people read

[11ty](https://www.11ty.dev/) turns your content into ordinary HTML pages. [Decap CMS](https://decapcms.org/docs/intro/) gives you an editing screen and saves your changes back to GitHub. Cloudflare Pages notices the change, rebuilds the site and publishes it. I've used this combination before and it works well if all you want is to publish things.

You still need to set up sign-in for Decap. Otherwise anyone could edit your site. An alternative is not to bother with Decap and just edit the markdown files in your git repo. Now, because I have agents connected to my git repo, I might just write a post to them and tell them to publish it on the blog.

**Contact forms.** I don't have a solution for this yet other than making a site with a database and having the forms submit there. SaaS form products exist, but I don't want to pay for them.

## 3. Tools where nothing needs saving

For anything more interactive, I use Next.js with static export. Put the code on GitHub and connect it to Cloudflare Pages. Every time you push to the main branch, it builds and publishes. That's how the reader on this blog works.

The person's own browser can remember their settings or a draft. That only lives on that browser and that device. If they clear it or switch to their phone, it's gone.

**Secret keys.** If your tool calls an AI model or another paid API, never put the key in the browser code. Anyone can read it. Put the call in a Cloudflare Worker instead, which is a small bit of code that runs on Cloudflare's servers. Ask your agent to limit who can call it and how often, or someone else can run up your bill.

Ask your agent: "Build a static site deployed from GitHub to Cloudflare Pages. Explain any feature that would need a server before adding one."

## 4. Saving things without sign-in

When visitors need to see the same saved data, it has to live on a server. On Cloudflare, that means a Worker plus [D1](https://developers.cloudflare.com/d1/). D1 is a simple database based on SQLite, run for you by Cloudflare. It suits small amounts of simple data.

Without sign-in, anyone can write to it. Ask your agent to add a limit on how often people can post, and a way for you to delete junk.

D1 isn't Postgres. If you think you'll want sign-in later, it may be worth starting at step 5 instead.

## 5. Sign-in and people's own stuff

Next.js on Vercel is the easy starting point when you need server code as well as pages. Then you need a database and a way for people to sign in. Two good options:

**Supabase** puts a Postgres database, sign-in, file storage and live updates in one place. That saves a lot of joining things up. The catch is that your app ends up depending on all of those pieces, so moving away later is more work.

**Neon** is mainly Postgres, though it now also offers sign-in, file storage and other backend services. Its big advantage for prototypes is that the database switches off when nobody's using it and wakes up when someone arrives. That first request is a bit slower.

What it costs (USD, checked 13 October 2026, so check the live pages before budgeting):

- [Supabase](https://supabase.com/pricing): the free plan gives you two projects and pauses them after a week of no use. Pro starts at $25 a month and covers one small project. Each extra small project is about $10 a month. Paid projects don't pause, so a forgotten prototype keeps costing money.
- [Neon](https://neon.com/pricing): there's a free plan with usage limits which is more like 100 dbs. The paid Launch plan has no monthly minimum. A small database running for ten hours costs about 27 cents. Left running all month, about $19. Storage is extra, at 35 cents per GB a month. Anything that pings the database regularly will keep it awake and cost more.

My rule: if it's a prototype that mostly sits there, Neon. If you want sign-in and storage working quickly and you're happy to pay to keep it on, Supabase. Vercel's own bill is separate, so check its [plan limits](https://vercel.com/pricing) too. To be honest, I don't really follow this rule as I find building with Supabase locally more convenient, so I nearly always start with Supabase, but this is really because I've not looked hard enough at Neon recently.

## 6. Several things talking to each other

This is where it gets complicated. Most recently I needed a set of connected services that tools like ChatGPT could talk to, because I wanted to see how an agent would behave when it met them.

First, ask your agent whether the whole thing fits on Vercel, including the scripts and the background jobs. If it does, do that.

If not, I think get the agent to pull everything together in Docker. Docker packages each part of your app with everything it needs to run, so it behaves the same on your laptop and on a server. Get it all working on your laptop first. Supabase is open source, so you can run it locally too.

Then pick where it lives:

**A rented server.** I have used [DigitalOcean](https://www.digitalocean.com/) but I hear [Hetzner](https://www.hetzner.com/) is cheaper. You can run the same Docker setup there, database included, for a fixed monthly price. But you're now the person who installs updates, makes backups and checks a backup actually restores. It costs the same whether anyone uses it or not.

**Cloud Run.** Google runs your app containers and can switch them off when nobody's using them, so you pay less when it's idle. But Cloud Run forgets everything stored inside a container when it stops. Your database has to live somewhere else: hosted Supabase, Neon, or Google's own [Cloud SQL](https://cloud.google.com/sql). You can't take your laptop setup, push it to Cloud Run and expect it to keep your data. Google's [container contract](https://docs.cloud.google.com/run/docs/container-contract) explains why. This is what I'm looking at for my latest complicated project, which I expect I will write about here.

Things to ask your agent to sort out on Cloud Run:

- Put the app and database in nearby regions.
- Cap how many copies of the app can start, so they don't overload the database.
- Keep passwords and keys in Cloud Run's secrets, not in the code.
- Run database changes as a separate step when you deploy, not from every container at once.
- Background jobs need their own plan. A web request that has finished won't keep working in the background.

Check the [Cloud Run pricing](https://cloud.google.com/run/pricing) and add the database cost on top. Cloud SQL keeps charging while it's running, even if nobody's using it.

Probably AWS has something that is cheaper or better than most of this but the DX is too complicated for me.

## Agents and databases

If you've got several agents working on the same app, give each one its own copy of the database. Separate Git worktrees keep their code apart, but if they all share one database they'll break each other's work.

Both Neon and Supabase can do this, with something called branching. A branch is a separate copy of your database that you can mess about with without touching the real one.

- [Neon branches](https://neon.com/docs/introduction/branching) are quick to make and can include your data or just the structure. Extra branches on paid plans are $1.50 a month each, plus usage.
- [Supabase branches](https://supabase.com/docs/guides/deployment/branching) start empty by default. Each one costs about a cent an hour while it's running, which is about $10 a month if you forget to delete it.

I usually give each agent an empty copy with made-up test data. Changes to the database structure get reviewed and then applied to the real database as a deliberate step. Delete branches when you're done.

There is also a database called [Dolt](https://github.com/dolthub/dolt) which I've found recently that claims to be Git for Data. It's used by the tools for [Multiple agents the hard way](https://bathos.org/posts/multi-agent-hard). I don't understand it yet but it seems cool.

## What to tell your agent

Before you start, tell your agent who will use the thing, whether they need to sign in, what needs to be remembered after the browser closes, whether anything needs to run without you, and how much you're willing to spend a month.

Then ask: "Pick the simplest setup that does this, using the list in this post. Explain where the code runs, where saved data lives, how sign-in works, and what costs money when nobody's using it. Write the setup and deployment steps into the repo. Test the main things a user would do, and check the live site after deploying."

Write that decision into the repo before you hand out work to several agents. Otherwise each one arrives with its own excellent plan for a completely different app.
