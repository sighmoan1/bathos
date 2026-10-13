---

title: "Multiple agents the easy way"

description: "Using GitHub issues, worktrees and an AGENTS.MD to coordinate is better than not"

date: "2026-10-12"

tags: ["AI", "git", "software factories"]

---

In [another post](https://bathos.org/posts/Gassing/) I mention the software factory rabbit hole. This I will write up as [multiple agents the hard way](https://bathos.org/posts/multi-agent-hard) once I can find the words.

Before I got there I had a workflow that was easy to use and which made building with agents more effective.

An Agents.md file in the repo would tell agents how to coordinate. A compressed version of the [Agents.md in LinkedIn Slop Filter](https://github.com/sighmoan1/linkedin-slop-filter/blob/main/AGENTS.md) says:

```

Before changing the LinkedIn Slop Filter, check active issues, PRs and worktrees; claim approved work through a uniquely identified, issue-linked branch, worktree and draft PR, coordinate file overlap, keep GitHub checkpoints and a resumable handoff, and never merge your own PR without the owner’s instruction or start suggestion issues without approval. The extension is a dependency-free Chrome MV3 app; run npm ci, install Playwright Chromium and pass npm test before review; GitHub Actions is disabled and must stay off unless authorised. Preserve its security and behaviour: API keys stay in the service worker, posts fold only when a category’s probability exceeds its threshold, and errors leave posts visible; classification sends extracted text by default, while image checks are opt-in and limited to validated post images, with no cookies, avatars, comments, screenshots or stored image bytes/URLs. Keep credentials private and all assets local. When merging or changing UI, update and verify the installed extension in the owner’s signed-in Brave session and live LinkedIn feed; use genuine screenshots if requested, never interact with posts to test, and report any live checks that remain blocked. Link acceptance criteria to actual test evidence, keep issues open until merged, and describe verified and unverified behavior honestly.

```

It might be obvious that I didn't write this or what it is compressing.  I start projects by brainstorming with a powerful model and it produced this. I fed this compressed version back into the model and it said it is too long and contains things it shouldn't. 

Don't worry about getting this wrong or having to understand all this stuff in detail, then. We're doing multi-agents the easy way. We want enough Git stuff to make this easier than working with the model providers apps only.

The easiest way I have found is:

* Use a powerful model to establish what I want. 
* Tell the model to create Github issues that will enable a team of agents to build what I want.

* Tell a faster and cheaper model to create subagents and get them to complete the Github Issues and make sure they follow agents.md.

I know little about code quality so on my projects I will often tell the agents to merge their own code. Sometimes, there are merge conflicts. When this happens, I will get the powerful agent back again and tell it to sort out the merge conflicts. 

This approach has not failed me so far. I'm not doing especially complicated things and it's only me working on these projects. But it seems fine for getting sites with auth and databases up and running. 

You can also ask the models to think of ways to improve your product. Get them to raise Github Issues labelled "suggestion", and have Agents.md explain not to pick up suggestions. Then you can approve work on the ones you like and bin off the ones you don't by asking it to delete/archive or change the label to approved. Don't know what you like? Ask a model to review and rate the suggestions and provide reasoning. 

So this is the easy way – you get the AI to do everything and if you don't know what to get it to do, you ask it.  The mindset shift is that all your work should be happening in the conversation with the agent. But the project work and the memory of what is happening lives in GitHub. This allows you to change agents, models or conversations without starting again. And it means that you can run subagents that don't need a lot of context to do work on the project effectively. They can get their context from GitHub.

The things I think you should be asking your agent to write into your projects' agents.md are:

* Check what everyone else is doing before starting work. Look at the open issues and pull requests and don't start work someone else is already doing.
* Use GitHub issues to track work. Every task should have an issue describing what needs doing and how we'll know it's done.
* Claim your work. Label an issue as in progress before starting it, so other agents know to leave it alone.
* Use a separate branch and worktree for each issue. This lets multiple agents work simultaneously without overwriting each other's changes.
* Create a pull request for every change. Link it to the issue, run the tests and record what you've done.
* Keep everyone informed. Update the issue or pull request as you go, particularly when you're blocked or handing work to another agent. Close issues when you have merged the related PR.
* Don't lose work. Commit and push changes, and leave enough information for another agent to pick up where you stopped.
* Test things before declaring victory. Tell me what you've actually tested and what you haven't.
* Keep suggestions separate from approved work. Agents can propose improvements, but shouldn't start building them until I've approved them.
* Agent identity: Each agent should use a unique identifier when claiming work, because multiple agents may share the same GitHub account.
* Claims aren't locks: Two agents could claim an issue simultaneously. They need to check for conflicting claims and coordinate.
* Worktrees are local: They stop agents overwriting each other's working files, but don't prevent conflicting changes when branches merge.
* Automated checks: Where practical, establish a test command and have GitHub Actions run it on each PR. That gives agents something objective to check before merging.

The important things are :

* GitHub issues as a shared to-do list
* Worktrees to stop agents deleting other agents' work in progress.
* Pull requests to get work back into the main project.
* The rest is to help agents recover when they lose context or get confused. 

You can share this blog post with your agent and say "init a project that works like this" and it should be able to figure it out. Ask it to write an AGENTS.md, configure worktrees, issues and pull requests, and set up tests appropriate to the project. It should then be able to coordinate with other agents without relying on anything being remembered in your conversations.

You might find that your agent app doesn't have the capability to init a project. You might need to initialise the project yourself then direct the agent to work on it. They will be able to explain how you should do this.

I also have ideas on how to setup projects with infrastructure that's easy to work with using agents. That will be a [separate post](https://bathos.org/posts/architecture-the-easy-way).

## Footgun review

I asked Sol to look for footguns in this approach and suggest defences. Here's what it came up with.

**Agents reviewing and merging their own work.** An agent can confidently approve code that doesn't work. Have a different agent review each PR, and require automated checks to pass before merging.

**Tests are optional.** If you don't know much about software engineering, automated tests are more important, not less. Set up CI to run tests, linting and type checks on every PR. Don't let agents merge failing code.

**Agents have too much freedom.** An instruction to complete an issue might lead an agent to delete data, change infrastructure or expose secrets. Give agents explicit boundaries. Require human approval for destructive operations, production credentials and anything that costs money.

**Worktrees don't isolate everything.** Agents working in separate worktrees can still interfere with each other through shared databases, ports and external services. Give them separate test environments where necessary.

**A clean merge isn't necessarily working software.** Two changes can work independently and break when combined. Run tests against the latest main branch and check that deployments actually work.

**GitHub issue claims aren't atomic.** Two agents might pick up the same issue simultaneously. For a handful of agents, checking existing claims is probably enough. At greater scale, use a dispatcher or proper locking.

**Agents can declare victory prematurely.** Completing a task isn't the same as achieving the intended outcome. Write acceptance criteria into issues and have another agent verify them.

**There's no rollback plan.** Agents can deploy broken software just as quickly as working software. Make deployments reversible and have a way to detect failures.

**More agents can mean less productivity.** Parallel work creates coordination, review and integration costs. Limit concurrent work and measure working features rather than completed issues.

Most of these can be addressed with a better `AGENTS.md`, GitHub branch protection and a few CI workflows. None requires building Gas Town.

The three I'd prioritise are independent review, mandatory automated checks and explicit limits on what agents can do without asking. The rest can wait until they become problems.

## What Sol says Agents.md should actually say

```
## This is what AGENTS.md should actually say

Taking those footguns seriously, I'd replace the original coordination instructions with something like this:

```markdown
# Agent instructions

## Before starting work

1. Read this file and the repository README.
2. Check open GitHub issues and existing claims.
3. Claim an issue by commenting on it before starting.
4. Create a dedicated branch and worktree.
5. Do not work on files another agent is actively changing without coordinating.
6. If the issue is ambiguous, ask or propose an approach before implementing it.

## Implementation

1. Work only on the claimed issue. Don't expand scope without approval.
2. Write or update tests for changed behaviour.
3. Run tests, linting and type checks before opening a PR.
4. Never commit secrets, credentials or personal data.
5. Don't change production infrastructure, authentication, permissions or database schemas without explicit approval.
6. Use isolated test resources where possible. Don't modify shared services without coordinating.

## Pull requests

1. Open a PR referencing the issue.
2. Explain what changed, how it was tested and any remaining risks.
3. Request review from an agent other than the implementer.
4. Reviewers must inspect the changes and run relevant checks, not simply approve.
5. Fix review findings before merging.
6. Never merge with failing required checks.
7. Only merge when independent review and required CI checks have passed.
8. Check that the combined changes work against the latest main branch.

## Completion

1. Verify the issue's acceptance criteria, not just that the code builds.
2. Check deployment health where applicable.
3. Close the issue only when the intended behaviour has been verified.
4. Record important decisions and unresolved problems in the repository.
5. Report anything requiring human intervention.

## Stop and ask

Get human approval before:

- Deleting or modifying production data.
- Changing production secrets or credentials.
- Making destructive or irreversible database changes.
- Changing authentication or authorisation rules.
- Exposing services or data publicly.
- Incurring new infrastructure costs.
- Performing destructive Git operations on shared branches.
- Making substantial changes outside the issue's scope.

## General principles

- Prefer simple solutions over new infrastructure.
- Use existing tools before introducing dependencies.
- Don't claim tests passed unless you ran them.
- Don't claim a feature works without evidence.
- Don't confuse completing a task with achieving its intended outcome.
- If you're uncertain, say so.
```

## What this doesn't solve

This works reasonably well when you've got a few agents working on separate issues. It starts to fall apart when you want agents to manage the whole process themselves.

Someone still needs to decide what to work on, identify dependencies between issues, notice when agents get stuck, resolve conflicts, and decide whether the work is actually finished.

In this workflow, that someone is me.

You can get agents to do some of this, but then you need to coordinate the coordinating agents. You need to know which agents are doing what, whether they're still running, whether they're making progress, and whether they're spending a fortune doing nothing useful.

At some point you start wondering whether you could automate the whole thing. This is where the software factory rabbit hole begins.

I'll write about that in [Multiple agents the hard way](/posts/multi-agent-hard/).
