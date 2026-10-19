# Scroll feed order

The browser creates a weighted random permutation on the first reader visit in a
tab session. The static export supplies the catalog, not a build-time shuffle.
The conventional `/articles/` index still sorts by publication date, newest first.

For an article aged `d` days, its weight is `1 + 3 * 2 ** (-d / 30)`:

- Published today: 4.
- Published 30 days ago: 2.5.
- Published 60 days ago: 1.75.
- Very old, missing or invalid publication dates: baseline 1 (old dates approach 1).

Future dates use age zero, so they receive no extra boost above 4. The date is the
article's publication frontmatter, never its filesystem or modification time.

Each article draws an independent uniform `u` in `[0, 1)` and receives an
exponential race score `-log(1 - u) / weight`. Sorting scores ascending samples
without replacement: each next article's probability is proportional to its
weight among the remaining articles. Every article occurs once. A fresh article
is at most four times as likely as an archive article to win a position, and even
the oldest article can appear first. Complexity is O(n log n).

The reader saves ordered slugs in `sessionStorage` under
`swipe-reader-order-v1`. Reloads and direct article visits reuse this order.
Removed slugs are dropped; newly discovered slugs are weighted-shuffled and
appended so existing posts do not move during a session. A new tab session draws
a fresh order. Browsers can copy session storage when duplicating a tab.
If session storage is unavailable, the mounted reader retains its in-memory
order, but persistence across reloads is unavailable.

Dismissals, bookmarks and topic preferences retain their existing localStorage
keys. Dismissals and topic filters operate on the ordered deck without
reshuffling. Initialization runs after hydration and before the feed is shown.

Validation is covered by `tests/feed-order.test.cjs` (weights, seeded probability
simulation, permutation integrity and storage recovery) and
`tests/e2e/feed-order.spec.ts` (reload, dismissal, filters and permalink session
continuity on desktop and Android). Existing conventional-reading browser tests
cover the chronological index.
