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

You can also ask the models to think of ways to improve your product. Get them to raise Github Issues with "suggestion" in the title, and have Agents.md explain not to pick up suggestions unless given the issue number and told to do so. Then you can approve work on the ones you like and bin off the ones you don't. Don't know what you like? Ask a model to review and rate the suggestions and provide reasoning. 

So this is the easy way – you get the AI to do everything and if you don't know what to get it to do, you ask it.  The mindset shift is that all your work should be happening in the conversation with the agent. But the project work and the memory of what is happening lives in GitHub. This allows you to change agents, models or conversations without starting again. And it means that you can run subagents that don't need a lot of context to do work on the project effectively. They can get their context from GitHub.

The things I think you should be asking your agent to write into your projects' agents.md are:

* Check what everyone else is doing before starting work. Look at the open issues and pull requests and don't start work someone else is already doing.
* Use GitHub issues to track work. Every task should have an issue describing what needs doing and how we'll know it's done.
* Claim your work. Mark an issue as in progress before starting it, so other agents know to leave it alone.
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
