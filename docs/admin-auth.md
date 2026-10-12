# GitHub authentication for the post manager

The installable mobile post manager lives at `/manage/`; `/admin/` redirects there. The static Pages site calls a same-origin Cloudflare Worker at `/api/*`. GitHub remains the authority for access and stores Markdown posts under `content/` on `main`. Publishing and deletion commit to GitHub and take effect after a successful Pages deployment.

## Production configuration

The existing [Bathos OAuth app](https://github.com/settings/applications/3927167) uses `https://bathos.org/api/callback`. Its homepage can be `https://bathos.org/manage/`. The Worker needs the public client ID binding `GITHUB_CLIENT_ID` and two server-only secrets: `GITHUB_CLIENT_SECRET` and `SESSION_SECRET`. `SESSION_SECRET` must be a base64-encoded cryptographically random 32-byte key. Configure the client ID as a plain-text Worker binding and each secret using `wrangler secret put` from `workers/admin-oauth`; never commit secret values or put them in chat or frontend settings. Rotating the session key invalidates existing manager sessions. Existing GitHub client credentials remain reusable.

The Worker configuration fixes `CMS_ORIGIN` and `OAUTH_ORIGIN` to `https://bathos.org`, the repository to `sighmoan1/bathos`, and the route to `bathos.org/api/*`. Localhost and preview domains cannot mutate the production repository. The manager depends on same-origin cookies and cannot use a separate API origin.

## Session and request protection

`GET /api/login` opens GitHub in the same window. OAuth uses an S256 PKCE challenge and a ten-minute Secure, HttpOnly, SameSite=Lax `__Host-bathos-oauth` state/verifier cookie. The callback validates state, exchanges the code server-side, verifies repository push permission, and retrieves the account login. It then redirects to `/manage/` with a seven-day Secure, HttpOnly, SameSite=Lax `__Host-bathos-session` cookie. That cookie contains an AES-GCM encrypted GitHub token, login and expiry, bound to the configured origin. The token never appears in manager JavaScript, browser storage or JSON responses.

Every mutation requires the exact `Origin: https://bathos.org`. Post writes additionally require JSON, have a 128 KiB request limit, validate the complete field schema, and restrict filenames to lowercase letters, numbers and hyphens under `content/*.md`. Updates and deletions require the current GitHub blob SHA; conflicts return HTTP 409 without retrying. GitHub calls have ten-second timeouts. Errors contain generic messages rather than upstream bodies or secrets. Responses use `Cache-Control: no-store` and the manager service worker excludes all API requests from caching.

`GET /api/session` reports only authentication and the account login. `POST /api/logout` clears the session cookie. Revoking the app authorization in GitHub invalidates its token. The cookie otherwise expires after seven days; user tokens are never refreshed automatically. This private repository requires GitHub OAuth's `repo` scope, which can cover other repositories available to the account, while Worker API calls target only the configured Bathos repository.

The old `/api/auth` popup endpoint remains for compatibility with legacy Decap clients. It retains the older browser-token handshake and is not used by the new manager. Invocation logging and tracing remain disabled to avoid capturing OAuth callback query strings; sanitized OAuth failure events are logged.

## Verification and deployment

Install root dependencies and run `npm ci && npm test` in `workers/admin-oauth`. Tests mock GitHub and cover OAuth/PKCE, write permission, cookie confidentiality and expiry, CSRF origin checks, UTF-8 YAML serialization, safe filenames, request limits, optimistic conflicts and deployment matching. `npx wrangler deploy --dry-run` verifies the Worker bundle. Deploy the Worker with all secret bindings preserved, then build/deploy the static Pages site.

Live acceptance requires signing in as a repository writer, creating a temporary post, editing it and deleting it, and checking the corresponding deployment status. Also verify that an account without repository push permission is denied. The manager reports failures and keeps device drafts; offline edits require connection before publishing.

References: [GitHub OAuth web flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), [GitHub repository contents API](https://docs.github.com/en/rest/repos/contents), [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/).
