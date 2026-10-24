# Dependency security review — 24 October 2026

Issue: https://github.com/sighmoan1/bathos/issues/133

The website audit before this change reported four findings: two critical and one
high finding against Next.js 16.4.0, and one high finding against unused Zod
3.25.76. Counts are registry advisory matches, not demonstrated production
exploits. No findings are muted or ignored.

## Website changes

- Pin Next.js to **16.4.1**, the vendor's minimum patched release in the existing
  16.4 release line. Its matching environment and platform compiler packages
  change with it; unrelated packages retain their locked versions.
- Remove unused direct dependencies `zod` and `@hookform/resolvers`. Neither is
  imported by application, component, library, script, test or Worker source.
  This removes the vulnerable unused validator without introducing a Zod 4 API
  migration. The used `react-hook-form` dependency remains unchanged.
- Preserve the design-system archive URL and integrity, React versions, Sharp
  0.35.5, and all existing narrow transitive security overrides.

The three Next findings are GHSA-673q-mjm6-r5xr (`use cache` typed-array RCE),
GHSA-2464-fhr4-w9xw (SVG Image Optimization RCE), and GHSA-p3m5-59mp-jv5r
(Server Actions denial of service). The Zod finding is GHSA-mrhx-c7xc-m3w5
(unbounded validation issue allocation).

Bathos serves a static export on Cloudflare Pages (`output: "export"`,
`images.unoptimized: true`), with no deployed Next server, Next image optimizer,
Server Actions endpoint or runtime Cache Components. Those Next server attack
prerequisites are absent in this deployment. The dependency upgrade removes
affected versions rather than relying on that deployment constraint.

After these website changes, `pnpm audit --json` reports **zero findings**.

## Worker toolchains

Both Worker lockfiles initially resolved `undici@7.29.1` through Miniflare.
Each npm audit reported three affected package entries (Undici, Miniflare and
Wrangler), tracing back to three Undici advisories: GHSA-4qv8-2p9j-2685
(EventSource memory exhaustion), GHSA-f72v-6w45-q472 (integrity token parsing),
and GHSA-xjj6-f33q-929c (unhandled content-encoding stream error).

Both Worker manifests now narrowly override **Undici 7.30.1**, the upstream
patched 7.x release. The override crosses no major version; Wrangler 4.149.0
and Miniflare remain at their existing versions. These are local development,
test and deploy-tool dependencies, not packages bundled into the production
Worker code. The override repairs the toolchain too, without downgrading it or
ignoring audit entries.

## References

- Vendor's patched versions and prerequisites:
  https://nextjs.org/blog/nextjs-security-update-october-14-2026
- https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr
- https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw
- https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r
- https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
- https://github.com/nodejs/undici/releases/tag/v7.30.1
- https://github.com/nodejs/undici/security/advisories/GHSA-xjj6-f33q-929c

Exact release validation and independent review results are recorded in the
pull request linked to the issue.
