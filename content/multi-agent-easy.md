---
title: "Multiple agents the easy way"
description: "Using GitHub issues, worktrees and an AGENTS.MD to coordinate is better than not"
date: "2026-10-12"
tags: ["AI", "git", "software factories"]
---

In another post I mention the software factory rabbit hole. Before I got there I had a workflow that was easy to use and which made building with agents more effective.

Agents.md file in the repo would tell agents how to coordinate. Essentially I get a powerful model to brainstorm with me and write GitHub issues, then I get less powerful models to create subagents of themselves. You could also just run many windows. I tell them to claim an issue when they are working on it, then they produce PRs to merge. If there are a lot at once or their are merge conflicts, then I get a powerful model in again. I encourage the use of worktrees to avoid collisions during development.

This seems to work fine, and I kinda struggle with seeing how the software factories in current form add to this, but am persevering a bit.

If you aren't sure, throw this post at your agent and see if it can suggest ways to support a multi-agent workflow on your projects. 