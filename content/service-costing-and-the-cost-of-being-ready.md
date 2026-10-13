---
title: "Service costing and the cost of being ready"
description: "A reply to Francis Bacon on service costing, variable demand and the numbers we ask services to justify themselves with."
date: "2026-10-13"
tags: ["services", "costing", "Webmention", "AI"]
inReplyTo: ["https://www.andeggs.me/2026/10/12/follow-the-money.html"]
---

> ChatGPT wrote this post at my request. I asked it to help me think through a reply to Francis, drawing on my experience managing a portfolio of humanitarian services and being asked for cost-to-serve and social return on investment metrics. That experience is mine; the argument and wording below are ChatGPT's attempt to work through it in the style of this blog.

I read Francis Bacon's [Follow the money: the importance of service costing](https://www.andeggs.me/2026/10/12/follow-the-money.html) and wanted to reply because something didn't quite sit right. I had managed a product portfolio of humanitarian services with variable demand, while being asked to produce cost-to-serve and social return on investment metrics. I recognised the need for the numbers. I was less comfortable with what people might think the numbers told them.

Francis's argument is that service owners need visibility of the whole cost of a service if they are to make meaningful trade-offs. Costs are often spread across functional budgets, leaving the person responsible for the service lobbying for resources without a clear expenditure envelope. Making those costs visible can change the conversation about who controls what and which trade-offs are available.

That seems useful. He also ends by discussing forecasting, including planning capacity when demand changes. So this reply isn't a correction to an argument that ignores variable demand. It's a question about what happens after we have made costs visible, particularly when we turn them into ratios and use those ratios to compare services.

## What is the unit?

Cost-to-serve sounds reassuringly straightforward. Take the cost, divide it by the number of people served, and see whether it goes down.

But some of the cost is there before anyone arrives. You may need trained people, premises, systems, relationships and the ability to respond when demand increases. How much of that capacity is justified is a real management question. Dividing it by this month's demand doesn't answer it.

As a made-up illustration, suppose a service costs £100,000 to keep available for a period. At 1,000 cases that is £100 a case; at 500 it is £200. Those are arithmetic examples, not figures from my work. Nothing in them establishes that the second period was less well managed. Demand changed. We would need to know what capacity was required, what costs could actually be changed and what happened to people before making that judgement.

The reverse is awkward too. More demand can make the ratio look better while waiting times grow and staff lose the space to deal properly with difficult cases. A falling unit cost can coexist with a worsening service.

It helps to distinguish the average full cost, the additional cost of one more case within existing capacity, and the cost of expanding capacity once it is exhausted. All three are useful. They answer different decisions. Knowing the average doesn't tell you how much money you would save by serving one fewer person.

## Being available is part of the service

I think the humanitarian context makes the denominator especially uncomfortable. Need doesn't arrive at a rate designed to make a budget look efficient. And observed demand isn't necessarily all the need: barriers to access can keep people out of the count.

A service may have to retain capacity for an uncertain surge. It may also have a commitment to be available in places or circumstances where the volume will never be large. There is a cost to that commitment. There is also a cost to withdrawing it, although that cost may fall on someone else's budget or on people who don't appear in a financial report.

None of this makes unused capacity automatically good. Readiness needs a reason, a plausible demand range and some account of how quickly capacity can be increased or reduced. Otherwise it can become a convenient label for expenditure nobody wants to examine.

But a portfolio decision should make the commitment explicit: what are we paying to keep available, for whom, and how much risk are we willing to accept? A league table of cost per case is a poor substitute for that conversation.

Cases also aren't interchangeable. A simple enquiry and a prolonged, complicated intervention can both count as one person served. A change in case mix can move the average even if the service handles each kind of case just as well as before. Worse, a target based on that average can make the easiest cases look attractive. The people who need the most help then become a threat to the metric.

## Putting a price on the result

Social return on investment tries to connect expenditure to benefits that ordinary financial accounts miss. That is a worthwhile ambition. Asking who benefits, which outcomes matter and what would have happened without the service can improve a decision.

I get wary when that reasoning disappears behind a headline saying that each pound spent creates so many pounds of social value.

An outcome can depend on the service, other organisations, a person's own efforts and wider conditions. What would have happened anyway? How much contribution belongs to each participant? How long does a benefit last? Which monetary proxy represents something that doesn't have a market price? Different defensible assumptions can produce different ratios.

There is also a portfolio problem. If two services help the same person achieve an outcome, adding their claimed returns can count the same benefit twice. A precise-looking total doesn't repair uncertain attribution.

That doesn't mean abandon SROI. It means keep the assumptions visible, show how the answer changes when they change, and retain evidence about outcomes that can't sensibly be monetised. The ratio should help someone question a decision, rather than end the discussion.

## The conversation I would want

Francis's proposal to make the full service cost visible gives us a better starting point. I'd want to carry that into a discussion of demand ranges, case complexity, readiness and the costs the owner can actually change over the relevant period. Alongside that, I'd want evidence about access, quality and outcomes, with the uncertainty still attached.

There may still be a good reason to spend less. There may be a better reason to retain capacity. The point is to expose the trade-off well enough to argue about it. I don't think we get there by asking one ratio to explain the service.

## Replying from another blog

Wanting to have this conversation raised a smaller practical question: how do you reply to someone else's blog from your own?

You can publish a post and link to theirs. The [Webmention standard](https://www.w3.org/TR/webmention/) adds a notification: your site tells the other site that your published page links to it. The receiver checks the link and decides what to display. You don't need to build a receiver yourself just to send a reply.

That seemed a useful thing to make easier on Bathos, both for people and for AI agents they have authorised to help maintain their blogs. The work includes a [human guide and published-reply form](/webmentions/), an [agent-readable guide](/webmentions-agent.md), and examples for common ways of publishing a blog. The aim is to make the next conversation easier to join from a site you control. An agent should be able to explain and implement the mechanism without treating an article as permission to publish on its owner's behalf.

This post is marked as a reply to Francis's canonical article. At the time of writing, its HTTP page advertised no Webmention receiver in its response headers or HTML, and its canonical HTTPS address failed certificate validation. No Webmention has been sent, and I can't claim a delivered notification. The linked reply can still stand on its own; the protocol only adds the possibility of letting the other site know.
