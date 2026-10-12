# Author posts on a phone

This describes the earlier Decap editor. Use the [current installable post manager](post-manager.md) at `/manage/` instead.

Open `/admin/`, sign in with GitHub, select **Posts**, then **New Posts** or an existing post. Fill in the fields and write in **Rich Text** or **Markdown** mode. Tap **Preview** to see the rendered post; tap **Edit post** to return to the form. For a new post, tap **Publish**, then **Publish now**. For an edited post, use the publish control to save the update. **Delete entry** appears for saved posts.

The phone editor keeps its actions above the scrolling form. Returning to the collection shows the admin shell and publishing information. Changes still use Decap's standard GitHub backend and await the site deployment.

Decap protects unsaved changes when using its back link or navigating away, and registers a browser unload warning. These native handlers and draft backups remain intact. Browser unload warnings depend on browser behavior; mobile operating systems can terminate a browser without firing them. Save before closing the browser.

## Implementation contract

`public/admin/mobile.css` is scoped to `#nc-root` below 768px and uses the Emotion component labels present in the pinned **Decap 3.9.0** bundle. The editor uses one pane at a time, keeping Decap's own preview toggle and React state. `mobile.js` starts phone sessions in edit mode, adds visible preview/edit text and accessible state, and measures `visualViewport` to keep the toolbar inside the area remaining above an on-screen keyboard. It never intercepts save, publish, delete, login, or navigation.

Review the selectors and the following checks before upgrading Decap. Sources checked: [EditorInterface](https://github.com/decaporg/decap-cms/blob/decap-cms%403.9.0/packages/decap-cms-core/src/components/Editor/EditorInterface.js), [EditorToolbar](https://github.com/decaporg/decap-cms/blob/decap-cms%403.9.0/packages/decap-cms-core/src/components/Editor/EditorToolbar.js), and [Editor guards and backups](https://github.com/decaporg/decap-cms/blob/decap-cms%403.9.0/packages/decap-cms-core/src/components/Editor/Editor.js).

## Browser verification

Completed on 12 October 2026 in headless Chromium with the exact pinned bundle and Decap's in-memory `test-repo` backend. This kept verification writes out of GitHub and production content. T3 preview opened, but resizing repeatedly timed out and its automation host disconnected, so standalone temporary Playwright was used for these checks.

To rerun without adding a production dependency:

```sh
npm install --prefix /tmp/bathos-mobile-browser playwright --no-audit --no-fund
/tmp/bathos-mobile-browser/node_modules/.bin/playwright install chromium
NODE_PATH=/tmp/bathos-mobile-browser/node_modules node scripts/check-admin-mobile.cjs
```

The check serves the repository's admin shell and assets on a temporary loopback port, replacing the GitHub backend with `test-repo`. It downloads the pinned CMS bundle, makes no GitHub writes and checks publishing-panel visibility after returning to the list when that feature is installed.

At **375 × 812** and **390 × 812** CSS pixels:

- Logged in to the test backend and opened the empty collection; document scroll width equaled viewport width.
- Created a post with title, description, date, tags and Markdown body; editor scroll width equaled viewport width.
- Switched to Preview and back; preview occupied the full width and the form was hidden only while previewing.
- Attempted to leave a dirty editor, dismissed Decap's confirmation and verified the new-entry route and edits remained.
- Published the post, edited its title, published the update, then confirmed deletion and returned to the empty list.
- Shrunk viewport height to **375px** while editing and verified the action toolbar remained wholly in the visible area and publishing succeeded. This simulates reduced keyboard space; it is not an OS keyboard test.
- Observed no JavaScript page errors. Save/delete, preview, date and Markdown toolbar controls have at least 44px height; buttons have at least 44px width.

No physical iPhone Safari or Android Chrome device checks, production GitHub OAuth flow or real deployment writes were performed in this verification. After authentication is configured, perform the same create/edit/delete flow on each real device with the keyboard open, check scrolling to the final body line, test the browser back gesture and check deployment status after saving. Use a disposable post and delete it after testing.
