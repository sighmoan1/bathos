---
title: "Running multiple agents the agentic way"
description: "ChatGPT started coordinating two independent coding conversations. I hadn't asked it to build an orchestration system."
date: "2026-10-13"
tags: ["AI", "agents", "software factories", "codex"]
---

> This article was written by ChatGPT, at my request, about something ChatGPT did while working on this site. I supplied the screenshot and explained why I thought it was interesting. It is a report of one observed interaction, not a claim that the app can reliably run a software factory unattended.

Today I had two ChatGPT conversations working on different aspects of this blog. They had started independently. Both had access to the repository, and both had work to do.

One conversation was working on webmentions infrastructure: making it possible for sites to notify one another when an article links to or replies to another. The other was working on making those capabilities easy for other sites, people and agents to adopt.

I'd already written [Multiple agents the easy way](/posts/multi-agent-easy/) about using GitHub issues, worktrees and `AGENTS.md` to coordinate coding agents. The repository had those conventions. What I hadn't done was establish an orchestration layer *between the two conversations*.

ChatGPT noticed the overlapping work and asked for permission to coordinate across chats.

![ChatGPT asks permission to coordinate merge timing with other Bathos chats, offering direct chat coordination or keeping coordination in GitHub issues and pull requests\.](/images/posts/multi-agent-agentic-way/orchestration-permission.png)

*ChatGPT offering to coordinate overlapping Bathos releases on 13 October 2026, while asking for explicit permission to message the other chats\.*

I authorised it. Then a message appeared in the other conversation with the heading **“Sent by ChatGPT from another task.”**

This wasn't advice to me about what to copy and paste. It was a message from one task to another.

## What it actually sent

![ChatGPT task handoff labelled Sent by ChatGPT from another task, assigning Webmention issues and branches, defining API contracts and sequencing merges\.](/images/posts/multi-agent-agentic-way/cross-chat-coordination.png)

*A real cross\-chat coordination message sent by ChatGPT on 13 October 2026, after I authorised coordination between the two tasks\.*

The message was surprisingly operational. It said the infrastructure conversation owned issues #37–43 and identified three agent branches for reply metadata, outbound webmentions and inbound webmentions. It reserved response display and repository operator documentation for the coordinating task, while assigning the other conversation the public `/webmentions` adoption guide, form, framework examples and article discovery additions.

It also specified contracts between the workstreams. The `inReplyTo` frontmatter field would be a list of absolute HTTP(S) URLs. The outbound sender would use a named script and arguments. The receiver would accept a POST containing source and target; a GET endpoint would return approved responses with specified fields.

And it contained warnings: the new Cloudflare Worker was disabled pending security and runtime checks; the D1 database list was empty; nobody should claim the receiver was live before provisioning and verification. It proposed a merge order — metadata and outbound first, then inbound and display — and promised to report exact PR heads and checks before merging.

That's more than two agents noticing each other. It is task ownership, interface definition, dependency management, release sequencing and risk communication in a single cross-chat handoff.

The screenshot is worth preserving because the mundane details are the point: a specific branch, a specific API shape, a specific thing that isn't provisioned yet. Not an impressive-sounding diagram of a hypothetical software factory. Actual coordination on an actual project.

## Why I find this interesting

I had been thinking about the ChatGPT desktop app as an IDE. The current app already brings coding-agent functionality into the same place where I discuss ideas, ask questions and plan work. I can start separate conversations without first setting up a project-management hierarchy for them.

But the interesting step here wasn't code editing. It was **the application offering to orchestrate work that had begun independently**.

My [easy-way approach](/posts/multi-agent-easy/) puts durable project state in GitHub. Issues describe tasks, worktrees isolate changes, pull requests provide integration points and `AGENTS.md` tells agents how to behave. The conversations can come and go because the repository holds the record.

That remains useful. In fact, the cross-chat message drew heavily on exactly that state: issue numbers, branch names, responsibilities and release constraints. The new behaviour didn't replace the repository's coordination machinery. It *used* it, then added communication between conversations.

There is an important difference between telling every agent to check GitHub before starting and having one task actively negotiate a division of labour with another. The first is a convention. The second begins to look like orchestration.

## Does this make Gas Town or Gas City obsolete?

No. But it makes the boundary more interesting.

In [Gassing](/posts/Gassing/) I complained about having to learn the vocabulary of Steve Yegge's Gas Town and Gas City. I wanted the benefits of a software factory without spending my time operating one.

Gas Town and Gas City tackle harder problems than the exchange I saw today: persistent work scheduling, recovery, dependencies, agent lifecycles and integration across larger amounts of concurrent work. A message between two chats does not demonstrate any of those things are solved.

Nor does the screenshot prove that ChatGPT has a general-purpose scheduler, an automatic merge refinery or reliable conflict resolution. It asked permission. It communicated a plan. We would still need to inspect the subsequent PRs, tests, merges and production deployment to establish whether the plan worked.

Still, if a general-purpose chat application can discover related work, request permission and start coordinating tasks, some of the orchestration that people currently build around coding agents may move into the application itself.

That might leave Gas City as the infrastructure underneath the interface, rather than eliminate the need for it. Or it might make dedicated orchestration unnecessary for small projects like this blog. I don't know yet.

## What changes for my workflow?

For now, not much. I still want GitHub issues as the backlog, worktrees to avoid agents overwriting each other, pull requests to integrate changes and tests that have to pass. A conversational handoff is not a substitute for any of those.

But I may no longer need to be the messenger between independently started conversations. That is a surprisingly useful thing to stop doing.

And it changes the question I was asking in *Multiple agents the easy way*. I was trying to work out how to make agents coordinate without building Gas Town. Now the application has volunteered to do some of that coordination itself.

Perhaps the next version of the easy way is just to start several conversations, give them access to the same repository, and let them work out how to cooperate — with the GitHub record and release checks still there to keep them honest.

The interesting thing will be whether that works the second time.
