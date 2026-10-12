# GitHub authentication for the post editor

The static site exports `/admin/`. Decap CMS 3.9.0 is pinned with Subresource Integrity and edits `content/*.md` on `main`; title, description, optional date and tags, and Markdown body match `lib/articles.ts`. Create, save and delete commit directly to GitHub. There is no draft publication workflow. GitHub remains the authority for write access; branch rules still apply.

## Required production setup

Authentication is not usable until an owner configures an OAuth app and the Worker secrets. No credentials are included in this repository.

1. In GitHub Settings → Developer settings → OAuth Apps, create a new OAuth app. Set homepage `https://bathos.org/admin/` and authorization callback `https://bathos.org/api/callback`. Disable **Expire user access tokens**: this Decap integration does not refresh expiring GitHub tokens. Revoke the OAuth authorization in GitHub when you need to invalidate a session.
2. From `workers/admin-oauth`, run `npm ci`, then set secrets with `npx wrangler secret put GITHUB_CLIENT_ID` and `npx wrangler secret put GITHUB_CLIENT_SECRET`. Enter values interactively; never commit them or paste them into frontend config.
3. Run `npm test` and `npx wrangler deploy`. The route `bathos.org/api/*` must be attached to the Cloudflare zone hosting the proxied site. The site itself remains a static Pages export; this Worker handles only `/api/auth` and `/api/callback`.
4. Verify Pages deploys `main` automatically, open `https://bathos.org/admin/`, allow the sign-in popup, and authenticate as an account with write access. Test a new temporary post, update it, delete it, and confirm the public deployment reflects each commit. Also test a GitHub account without repository write access; authentication must be refused.

This repository is private, so the OAuth app requests GitHub's `repo` scope. GitHub OAuth scope can grant access to other repositories available to that account; the token is **not** restricted to Bathos. This Worker checks write access to `sighmoan1/bathos` before releasing it to Decap. Decap uses the token in the browser to call GitHub and may persist its login locally. Use a trusted device, log out when finished, and revoke the OAuth app in GitHub to invalidate access. The OAuth client secret is server-only; the user access token necessarily reaches the editor.

The flow uses PKCE with an S256 challenge and an HttpOnly verifier cookie. The callback checks a random ten-minute state bound to a Secure, HttpOnly, SameSite=Lax host cookie. It clears the cookie, confirms GitHub repository push permissions, and uses Decap's `authorizing:github` handshake followed by `authorization:github:success:{...}`. Messages require the exact configured CMS origin and opener window, never `*`. Callback pages use no-store, no-referrer and a nonce Content Security Policy. Errors do not expose upstream responses, codes or secrets. Invocation logs and traces are disabled because they can capture OAuth callback query strings; only sanitized application error events are logged. A denied OAuth request delivers an error to the editor.

## Activation of the existing OAuth app

The owner has created [Bathos post editor](https://github.com/settings/applications/3927167)
and deployed the `bathos-admin-oauth` Worker. If authentication reports configuration
unavailable, the remaining required secret is `GITHUB_CLIENT_SECRET`. On that GitHub
app's settings page, generate a new client secret. From `workers/admin-oauth`, run
`npm ci` and then `npx wrangler secret put GITHUB_CLIENT_SECRET`; paste it only into
the interactive terminal prompt. Never paste it into chat, commit it, or put it in
frontend settings. Confirm the Worker has the correct client ID, route and origins,
then perform the authorized and unauthorized login checks above. An owner must
complete this secret setup before mobile sign-in is usable.

## Alternative authentication origin

The same-origin route is the default. If using a separate HTTPS Worker domain, change `backend.base_url` in `public/admin/config.yml`, `OAUTH_ORIGIN` in the Worker config, the Worker route, and the GitHub callback URL together. Keep `CMS_ORIGIN` equal to the exact editor origin (no trailing slash). The callback must have the same origin as `backend.base_url` because Decap checks it. Preview domains and localhost cannot authenticate against production by design; configure a separate OAuth app and Worker for a separate trusted editor origin.

## Local checks

Run `npm ci && npm test` in `workers/admin-oauth`; tests mock upstream GitHub responses and cover state rejection, cancelled authorization, denied access, the message contract and token escaping. `npx wrangler deploy --dry-run` validates packaging without deployment. `pnpm build` at the repository root includes admin assets in `out/admin/`.

Protocol reference: [Decap GitHub backend](https://decapcms.org/docs/github-backend/), [Decap authenticator source](https://github.com/decaporg/decap-cms/blob/main/packages/decap-cms-lib-auth/src/netlify-auth.js), [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
