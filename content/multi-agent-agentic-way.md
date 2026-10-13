---
title: Multiple agents the agentic way
description: While working on my blog, ChatGPT unexpectedly offered to coordinate two independently started coding conversations, using GitHub issues and branches to organise work across them. It’s a small but striking example of model providers absorbing capabilities that recently required complex orchestration tools. Those tools still solve harder problems, but I increasingly suspect that building elaborate agent infrastructure risks being overtaken by improvements to consumer AI products.
date: "2026-10-13"
tags:
  - AI
  - agents
  - software factories
  - codex
---

> ChatGPT wrote this article at my request, about something it did while working on this site . I supplied the screenshot and explained why I thought it was interesting.

Today I had two ChatGPT conversations working on different aspects of this blog. Both had access to the repo and I was expecting them to coordinate using issues, PRs and the rules in [agents.md](https://github.com/sighmoan1/bathos/blob/main/AGENTS.md).

One conversation was working on [webmentions](https://en.wikipedia.org/wiki/Webmention) infrastructure. This makes it possible for sites to notify one another when an article links to or replies to another. The other was working on making it easy for people and agents looking at the site to adopt that standard.

I'd already written [Multiple agents the easy way](/posts/multi-agent-easy/). This explains how to use GitHub issues, worktrees and `AGENTS.md` to coordinate agents. The blog repo was following those conventions. What I hadn't done was establish an orchestration layer between the two conversations. I didn't expect to get orchestration without adopting [Multiple agents the hard way](/posts/multi-agent-hard/). I have experiemented with the hard way and at the time of writing this post, my ability to explain it lags behind my ability to do it.

ChatGPT noticed the overlapping work and asked for permission to coordinate across chats.

![ChatGPT asks permission to coordinate merge timing with other Bathos chats, offering direct chat coordination or keeping coordination in GitHub issues and pull requests\.](/images/posts/multi-agent-agentic-way/orchestration-permission.png)

ChatGPT offering to coordinate overlapping Bathos releases on 13 October 2026, while asking for explicit permission to message the other chats\.

I authorised it. Then a message appeared in the other conversation with the heading “Sent by ChatGPT from another task.” This was evidence of the ChatGPT desktop app orchestrating ongoing work on my behalf. I didn't expect this, I expected the separate threads to try to coordinate via GitHub.

## What it actually sent

![ChatGPT task handoff labelled Sent by ChatGPT from another task, assigning Webmention issues and branches, defining API contracts and sequencing merges\.](/images/posts/multi-agent-agentic-way/cross-chat-coordination.png)

A real cross\-chat coordination message sent by ChatGPT on 13 October 2026, after I authorised coordination between the two tasks\.

ChatGPT identified which conversation was responsible for each part of the work. It agreed how the changes would fit together, proposed a merge order and flagged unresolved dependencies.

So: the ChatGPT desktop app had identified that coordination would be beneficial. Then asked to do it and started handling it.

## Why I find this interesting

I had been experiencing limitations with running codex and claude code sessions. I had seen what looked like people trying to address this. I was expecting to have to [sift through a bunch of complications](/posts/Gassing/) to make my life easier. But I have now discovered, again, that more of the complicated just-now-possible frontier stuff has been absorbed by the model provider. 

While I have been busily trying to understand how people at the bleeding edge are doing orchestration, the consumer application is now offering to orchestrate work that had begun independently. There is something here about how fast the model providers are productising things. OK, [welcome to gastown](https://yegge.ai/essays/welcome-to-gas-town/) was published in January and [welcome to gascity](https://yegge.ai/listings/welcome-to-gas-city) looks like it came out in May. But I don't think orchestration concerns are particularly ubiquitous. I thought it was still experimental terrain. Apparently not.

My [easy-way approach](/posts/multi-agent-easy/) puts durable project state in GitHub. Issues describe tasks, worktrees isolate changes, pull requests provide integration points and `AGENTS.md` tells agents how to behave. The conversations can come and go because the repository holds the record.

That remains useful. In fact, the cross-chat message drew heavily on exactly that state: issue numbers, branch names, responsibilities and release constraints. The new behaviour didn't replace the repository's coordination machinery. It used it, then added communication between conversations.

## Does this make Gas Town or Gas City obsolete?

No. But it makes the boundary more interesting.

In [Gassing](/posts/Gassing/) I complained about having to learn the vocabulary of Steve Yegge's Gas Town and Gas City. I wanted the benefits of a software factory without spending my time trying to understand the imagination of someone able to create the ability to make one.

Gas Town and Gas City tackle harder problems than the exchange I saw today: persistent work scheduling, recovery, dependencies, agent lifecycles and integration across larger amounts of concurrent work. A message between two chats does not demonstrate any of those things are solved.

The screenshot does not prove that ChatGPT has a general-purpose scheduler, an automatic merge refinery or reliable conflict resolution. It asked permission. It communicated a plan. We would still need to inspect the subsequent PRs, tests, merges and production deployment to establish whether the plan worked.

But it is running and I'm arguing with the mayor of my gas city about why everything has stalled. So – ok, I'm not an expert on this stuff and people with the expertise will move faster. But still, it seems that effort to pull the future in faster than the model providers are producing it has a high risk of being wasted. I will still keep looking at it. It is helping me learn new concepts and imagine how organisations will use these tools in future. But I doubt I'll be recommending [the hard way](/posts/multi-agent-hard/) to anyone who wants to ship faster.

## Does this change anything for my workflow?

Not really. I found myself using the ChatGPT app more than [T3 Code](https://t3.codes/) today. Partly because Gas Town burnt all my tokens and I jumped up a tier. 

For now, not much. I still want GitHub issues as the backlog, worktrees to avoid agents overwriting each other, pull requests to integrate changes and tests that have to pass. A conversational handoff is not a substitute for any of those.

But I may no longer need to be the messenger between independently started conversations. That is a surprisingly useful thing to stop doing.

And it changes the question I was asking in [Multiple agents the easy way](/posts/multi-agent-easy/). I was trying to work out how to make agents coordinate across many threads and now it seems they notice when they need to and start doing it. 

Different story if you are trying to stay on the entry-level pricing across a few providers. This doesn't add more Claude and Codex coordination, but maybe that's the point.

## Future predictions

I guess the model provider wants you in their app spending tokens with them, not in tool that makes it easy to spend tokens with someone else. I expect [Dots](https://www.youtube.com/watch?v=uXspbC2srEQ) will show up with the ability to orchestrate across many coding subagents. Then, I expect the DX to get so good that using anything else will make no sense. The Dot as the mayor of a Gas City that just works seems a bit like an end- state. But we will want to simulate great product organisations and empowered product teams, not feature factories. So, I expect to see something like [hypothesis-driven development](https://www.alexandercowan.com/hypothesis-driven-development-practitioners-guide/) against [Opportunity Solution Trees](https://www.producttalk.org/opportunity-solution-trees/).

My ambition to build something like that on top of Gas City has diminished further today. Maybe it is still worth it to impose my sense of how things should be done on to the system. But if it's any good, I'd expect it to appear as a core feature pretty soon.
