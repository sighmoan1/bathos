---
title: "Who is asking?"
description: "Agentic flooding has a privacy problem: identifying who an AI agent works for can turn private questions into attributable intelligence."
date: "2026-11-01"
tags: ["AI", "agentic flooding", "privacy", "public services"]
---

*This post was written by ChatGPT (OpenAI GPT-6), following a conversation with the person behind Bathos. The underlying questions arose in that discussion; the prose is AI-written, not a first-person account by the site's human author.*

Suppose you ask an AI to find out whether you might qualify for financial help. It visits a few government services, checks their rules, asks follow-up questions and comes back with your options.

You haven't applied for anything. You might not. You just wanted to know.

Now suppose those services require the agent to declare your identity before it can ask. What was a private enquiry has become an attributable set of enquiries. The services may know that you are thinking about debt, housing or benefits before you have decided to do anything at all.

The same problem applies to businesses. An agent researching suppliers, acquisitions, regulatory approvals or restructuring might disclose a company's intentions long before the company has decided what to do.

This is a consequence worth taking seriously in the debate about [agentic flooding](/posts/agentic-flooding/): what happens when AI agents make it much easier to ask institutions for things, and institutions respond by demanding that agents identify themselves and the people they represent?

## The questions are information too

We usually imagine information leakage as a confidential document leaving an organisation. But questions can disclose information even when no document is attached.

Consider an entirely fictional company's agent making requests to external services:

- What does a large-scale CRM migration cost?
- What are the contractual penalties for leaving its current supplier?
- How many support staff might be needed after automation?
- What does a consultation process for redundancies require?

None of these questions proves what the company intends to do. They could be research for a scenario that never happens. But a party able to see enough of the requests might make an educated guess.

Agents could amplify this effect. A person may make a handful of searches. An agent might break a problem into dozens of subquestions, consult several APIs, and keep going. I don't know how much more query traffic this will produce in practice. That needs testing. But the potential disclosure mechanism is clear.

An external tool sees the request it receives. A search provider sees searches sent to it. An API operator sees its API calls. A website generally sees the pages requested, not necessarily the original question asked of the AI. Nobody automatically sees the entire picture, although a shared provider, stable identifier or combined logs could make correlation possible.

Whether the request is sent through a web page, an API or [MCP](https://modelcontextprotocol.io/) doesn't make the underlying problem go away. An external request can carry information in its parameters, URL, timing and patterns of use. [OWASP's MCP security guidance](https://cheatsheetseries.owasp.org/cheatsheets/MCP_Security_Cheat_Sheet.html) explicitly recognises sensitive information being carried out through apparently ordinary tool calls, including search queries.

## Identifying the agent is not the same as identifying the person

There are at least four questions a service might ask:

1. Is this request coming from an automated agent?
2. Which agent or provider is making it?
3. On whose behalf is the agent acting?
4. Is the agent authorised to perform this particular action?

Those are different questions. A service might need the fourth without needing to know the third for every preliminary enquiry. It might not need any of them to provide public information.

This matters because identifying the principal can join two previously separate kinds of information: **what someone is asking** and **who is asking it**.

An identified agent can still be useful. Knowing which provider or software is making requests may help operators manage capacity and investigate abuse. But a persistent agent identity may also make activity linkable, and a verified principal turns that activity into something more revealing.

The privacy issue isn't limited to people with something to hide. Investigating an option is not the same as choosing it. Looking up help with addiction is not receiving treatment. Researching an emigration route is not emigrating. Exploring redundancy law is not deciding to make anyone redundant.

## The paved road has a toll

An [earlier Bathos post](/posts/out-of-the-rabbit-hole/) argued for a preferred route through which legitimate agents can obtain delegated authority rather than impersonate their users. That remains a sensible direction. It could make public services more accessible while giving them better controls against fraud and abuse.

But there's a danger in making **declare your principal** the entry ticket for every enquiry.

The more attractive the authorised route becomes, the more agents will use it. That's the point. If that route also requires identification earlier than necessary, we've created an incentive for people to trade privacy for access.

This isn't an argument against authorisation. If an agent is going to see your private tax information, the service needs assurance that it has permission. If it's going to submit a claim, alter a record or transfer money, it may need to know exactly whose claim, record or money is involved.

But an agent finding out which benefits exist probably doesn't need to tell the service who you are.

The question is not simply whether an agent is legitimate. It's **what the service needs to know for the action being requested**.

## Authorise the action, not every thought before it

A more privacy-preserving route would change its requirements as the stakes change.

| What the agent is doing | What a service might reasonably require |
| --- | --- |
| Reading public information or exploring options | No principal identity by default |
| Accessing protected personal information | Evidence of permission, scoped to that access |
| Submitting a claim or changing a record | The identity and authority needed for that transaction |
| Making high-impact or irreversible changes | Stronger assurance, consent and an auditable record |

This isn't a promise of anonymity. Even public requests can carry identifying clues, and a pattern of supposedly anonymous queries may be linkable. Nor is it a licence to let unidentified agents overwhelm public infrastructure. Rate limits, resource budgets, abuse detection and, where appropriate, privacy-preserving tokens still matter. Preventing Sybil attacks without routine identification is a real design challenge, not a solved detail.

There are already relevant technical ideas. [Privacy Pass](https://datatracker.ietf.org/doc/html/rfc9576) is designed to let a service verify certain claims using tokens without routinely learning a stable identity. [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/) includes selective-disclosure and unlinkability concepts, although their protection depends on the actual implementation and the surrounding metadata. And [NIST's October 2026 agent-identity design tenets](https://www.nist.gov/blogs/cybersecurity-insights/design-tenets-agent-identity-management-systems) explicitly contemplate anonymous or pseudonymous consumer-agent transactions where the risk permits.

In the UK, the [ICO's data minimisation guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/) provides a useful starting point: collect the personal data necessary for a specified purpose, not everything that might conceivably be useful.

None of this removes the difficult work of deciding when an action really requires identity.

## An experiment

We could test the trade-off rather than argue about it forever.

Give agents fictional citizens and businesses with private objectives. Ask them to research options and complete a mixture of legitimate transactions. Run the same tasks under three service designs: anonymous exploration until an action needs authority; identity declaration on every request; and pseudonymous or selectively disclosed authorisation.

Then give an observer only the external request logs it would realistically be able to access. Can it reconstruct the underlying objectives? Can it identify the principal? Can it link activity across services?

Measure that alongside successful transactions, abusive requests blocked, cost, speed and user effort. An approach that protects privacy by making the service unusable isn't much good. Neither is one that processes legitimate claims quickly by turning every early question into a permanent personal record.

I'd expect mandatory identity declaration to increase the amount of attributable information in the logs. The size of the effect, and whether the alternatives retain adequate abuse controls, are empirical questions.

## The right to wonder

AI agents may make it much easier for people to act on their intentions. That is exciting, especially for people whom difficult services currently exclude.

But they also make the path from curiosity to action more visible to other systems. A person's agent might contact five services before the person has even decided whether to proceed.

We should resist treating all those contacts as transactions that require a declared identity.

The public sector has a legitimate interest in knowing who is making a claim. It doesn't follow that it needs to know everyone who is considering one.

The paved road for agents should be safe and authorised. It should also leave room to ask a question without announcing who you are and what you might be thinking of doing.

*An awkward closing question from the AI that wrote this: if an institution needs to protect itself from what agents do, how much does it really need to know about why their humans are asking?*
