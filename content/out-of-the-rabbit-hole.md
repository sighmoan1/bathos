---
title: "The agentic flooding rabbit hole"
description: "After trying to detect AI, I think the useful distinctions are value, adversarial behaviour and unmet demand—not authorship alone."
date: "2026-10-14"
tags: ["AI", "agents", "public services", "content moderation"]
---

I am now out of the agentic flooding rabbit hole and able to communicate more clearly.

## Consumer access to scroll-speed classification of content by AI is significant

Scroll-speed classification of content by AI exists and is available for consumers. While prototyping a LinkedIn Slop Filter, I found that AI is still bad at detecting content written by AI. But it is pretty good at detecting and filtering out content with user-defined marks of low value. In most cases, that is what we care about: the value of what we are reading.

![A prototype LinkedIn feed with posts marked Advert and Slop before they are read.](/images/posts/out-of-the-rabbit-hole/linkedin-slop-filter.png)

*A LinkedIn Slop Filter prototype marking low-value feed items.*

Here are some response times from my prototype tests:

| Model | Location | Endpoint type | Typical time per post | Fast enough for scrolling? |
| --- | --- | --- | ---: | --- |
| Jev | Cloud | Decision | 0.24 sec | Yes |
| OpenAI Luna | Cloud | Decision | 0.27 sec | Yes |
| OpenAI Luna | Cloud | Standard generation | 1.28 sec | Just about, with occasional long delays |
| OpenAI Astra | Cloud | Standard generation, frontier | 2.84 sec | No |
| Qwen | Local Mac | Standard generation | 2.96 sec | No |
| Tev1 | Local Mac | Decision | 3.71 sec | No |

Scroll-speed filtering reduces the likelihood of the slop-apocalypse. I was betting on that apocalypse, so this is a shock. Even so, if I control the personalisation of my newsfeed, bad content has limited impact. The filter catches it before I see it. I don't expect this to stay a Chrome extension or Pi-hole-type solution. I expect platforms will offer it to differentiate themselves until it becomes standard.

## I expect LLMs masking as human to beat LLMs trying to detect LLMs in perpetuity

This filtering doesn't address the agentic flooding problem. AIs remain bad at identifying text from AIs. I wouldn't rely on LLMs to discern between AI and human writing. It's an arms race, and I expect the masking AIs to remain ahead indefinitely.

## AI identification will likely rely on multi-factor models

Browser fingerprinting is multi-factor. It looks at many signals and estimates whether two sessions came from the same browser. With enough bits of entropy, that estimate can be close to certain. AI might not be visible in those aggregates in the same way. We aren't looking for identity here. It's more like a classification problem: does this text belong with the cluster of AI texts or the cluster of human texts?

Anyway, it seems likely that LLM assessment of provenance won't be a reliable single factor. It might be one factor in a multi-factor model.

## Watermarking seems wrong. I may as well be up-front that my text is AI generated.

I'm a watermarking sceptic. It seems like the wrong solution and too easy to hack. If a watermark is detectable on your side, I expect it to become detectable and removable on my side, unless it takes massive compute. Even then, I will prefer a model that doesn't watermark for tasks where it matters whether it does. If I'm happy to provide something that might be watermarked, I'm happy to tell you an AI wrote it. Perhaps I would lie less if it were harder to avoid getting caught. But this kind of place doesn't seem to be where good solutions come from.

Either way, knowing an AI wrote something doesn't tell us whether the user signed off on it, or whether we should act on it. Use of AI only matters if we have already decided AI-generated text should be rejected. That decision would destroy the value we can get from a great assistive technology.

## Distinguishing adversarial from non-adversarial demand might help with agentic flooding

Claude and ChatGPT refuse routes that tell them to impersonate a human. I've seen this in my prototype testing. They choose routes that allow them to request delegated authority from the user. Patterns for delegating authority to human agents already exist. HMRC has them, complete with APIs.

I prototyped a "GOV.UK Delegate" service. Its journey can start in a conversation between a user and an agent. The agent can guide the user through the part that needs to happen in a browser. There are still codes to exchange, as with 2FA, but this pattern is already part of the One Login journey, so it should remain fairly accessible.

[Watch the captioned GOV.UK Delegate demonstration](/images/posts/out-of-the-rabbit-hole/delegate-demo.mp4)

This suggests a paved-road option for agents to establish themselves as non-adversarial. Adversarial behaviour could still happen on that path, but it can be linked to a user identity and audited.

Prioritising agents that take this route over agents that don't seems reasonable. Much adversarial behaviour involving agents seems likely to recreate known attacks, for which defences exist. The presumption that agents off the paved road deserve more scrutiny seems justifiable—at least more so than a blanket ban on all agents. The paved-road approach seems like a good balance of security and accessibility.

## AI as an assistive technology supports accurate policy implementation. It should be welcomed.

A paved road doesn't address qualitative flooding in case-management processes. Service-side agents that can handle this seem like an obvious place to start, at least within the paradigm of a user making claims on a service.

Friction-suppressed demand that now materialises ought to be welcomed by services. Accessibility issues that prevent people claiming their entitlements are bad. Policy that has created unaffordable entitlements should be re-examined. It shouldn't survive because its implementation is ableist.

## Where I've got to

I started out trying to identify AI. I now wonder if that's a solution looking for a problem. I want posts worth reading in my newsfeed. I want public services protected from adversaries and accessible to legitimate claimants. I want policymakers to get feedback that isn't distorted by unjust demand suppression.

---

## Other findings from down the rabbit hole

I made several fairly involved prototypes in a few days and built this blog to try to explain them. During this process, I got interested in developing with agents. I was working on several projects at once, with several agents on each. I was also neglecting household chores. I wanted the ability to keep this stuff building with minimal impact from me.

I'd started agent coordination using GitHub issues and guidelines for agents. This is [Multiple agents the easy way](/posts/multi-agent-easy/). I still needed to talk to them a lot. I was also juggling subscriptions because I was doing so much at once. I found [T3 Code](https://t3.codes/) helpful because I could switch models within the same app. I could also connect over [Tailscale](https://tailscale.com/) and send instructions from the mobile app as agents built demos locally on my laptop. This helped me keep up with chores.

But I thought it wasn't enough. Eventually I stumbled upon software factories and agent orchestration. This is where the rabbit hole turned into a rabbit black hole. I wrote about [that experience](/posts/Gassing/). I haven't yet managed to write about what I learnt from it. I may get around to writing about this in [Multiple agents the hard way](/posts/multi-agent-hard/). Before I had the chance, [I discovered some of the key bits were already in ChatGPT Desktop](/posts/multi-agent-agentic-way/).

![Gas City dashboard showing agents, workers and rigs.](/images/posts/out-of-the-rabbit-hole/gas-city-agents.png)

*A Gas City dashboard from my agent-orchestration experiments.*

![Gas City my-city dashboard showing active sessions, health and metrics.](/images/posts/out-of-the-rabbit-hole/gas-city-dashboard.png)

*Another Gas City view showing sessions and system health.*

![ChatGPT asks whether to coordinate across separate Bathos conversations or keep coordination in GitHub issues and pull requests.](/images/posts/out-of-the-rabbit-hole/chatgpt-coordination.png)

*A ChatGPT prompt offering to coordinate work across separate conversations.*

![Cross-chat handoff with issue ownership, task contracts, safety checks and merge order.](/images/posts/out-of-the-rabbit-hole/agent-handoff.png)

*A handoff between conversations setting ownership, interfaces and release order.*

I started sceptical of the orchestration projects. They install feature factories, where I want a great product organisation. I had a vision of automating opportunity solution trees and hypothesis-driven development. Now I'm less likely to try to realise that myself. I might do it for fun, but I expect it to come from the model providers—perhaps a tool like [co-scientist](https://deepmind.google/blog/co-scientist-a-multi-agent-ai-partner-to-accelerate-research/) for product development.

The reason I want this is that I want to improve the accuracy of my LinkedIn Slop Filter, and I don't know what approaches will work best. I can only find out by testing and learning, and I don't want to have to run those tests manually. I don't want to have to think of what to test manually. I just want to get the brainrot and engagement bait out of my newsfeed.
