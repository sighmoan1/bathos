# RSS and ad-free email subscriptions

Readers open `/subscribe/` from the reader header. The RSS 2.0 feed is `https://bathos.org/rss.xml`, with summaries, categories, publication dates, and case-sensitive canonical links as stable GUIDs. Every content Markdown post is included. A successful Pages build regenerates the feed; saving a post must deploy before subscribers can see it. Updating an existing post keeps its GUID, so readers do not receive it as a new post.

The owner requires **no ads in subscriber emails**. Do not use ad-supported RSS-to-email services. Buttondown is the recommended provider. Email signup is hidden until `BATHOS_EMAIL_SUBSCRIBE_URL` is set at build time to the real hosted newsletter URL, such as `https://buttondown.com/USERNAME`. Invalid/non-Buttondown URLs fail the build. Do not configure a fictional username or claim email is operational without verification.

## Activate email

1. Create the owner's Buttondown account and newsletter. Verify the sender and, if sending from a Bathos address, complete Buttondown's domain verification. Keep confirmation/double opt-in enabled and sponsorships disabled.
2. Choose the plan: the first 100 subscribers are free; RSS-to-email is currently a $9/month add-on. Obtain the owner's agreement before enabling a paid add-on. [Pricing](https://buttondown.com/pricing).
3. For automatic delivery, add `https://bathos.org/rss.xml` in Settings → RSS-to-email. Choose sending for new posts or a digest. Enable **skip old items** when first connecting the feed to avoid mailing the existing archive. Confirm the template contains no ads and uses `item.title`, `item.description` and `item.url` (this feed carries summaries). [RSS settings and behavior](https://docs.buttondown.com/rss-to-email).
4. Set `BATHOS_EMAIL_SUBSCRIBE_URL` to the real hosted newsletter URL in the `bathos-web` Cloudflare Pages production and preview build environments. Trigger a reviewed deployment; do not point a preview signup at a test newsletter unless it is clearly identified.
5. Verify the production link opens the correct newsletter, subscribe using an authorized test inbox, complete confirmation, inspect an ad-free test email, and test unsubscribe. Verify the RSS automation against a controlled new feed item before declaring automatic delivery operational. Do not send unsolicited test messages or publish a disposable production post without authorization.

The website does not store subscriber addresses or sending credentials. Buttondown handles confirmations, delivery and unsubscribe. The free/manual option requires the owner to compose/send newsletter updates; RSS automation requires the add-on. Keep issue #30 open until the account and complete email flow are verified.
