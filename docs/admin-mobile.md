# Author posts on a phone

Use the [installable post manager](post-manager.md) at https://bathos.org/manage/. `/admin/` redirects there. The old Decap editor and its browser-token authentication have been retired.

The current guide covers creating, editing and deleting posts, previews, device drafts, offline writing and home-screen installation. Saving uses the protected branch-and-pull-request publishing flow; a post is live only after the merged commit deploys successfully.

For authentication and server setup, see [admin-auth.md](admin-auth.md). For mobile verification, run the repository release checks, including `scripts/check-post-manager.cjs`, and follow the real-device acceptance steps in [post-manager.md](post-manager.md). The removed `check-admin-mobile.cjs` script and Decap assets are no longer part of the release.
