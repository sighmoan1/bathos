# Dependency security review — 13 October 2026

Issue: https://github.com/sighmoan1/bathos/issues/60

## Changes and applicability

The registry audit of the previous website lockfile reported 75 advisory matches
(3 critical, 38 high, 30 moderate, 4 low). Its advisory dictionary contained 70
unique advisory IDs; counts include dependency paths and are not a count of
proven Bathos exploits.

The reviewed lockfile upgrades Next.js from 16.0.10 to 16.4.0 and the Tailwind
compiler packages to 4.3.3. Updating Tailwind removes its old archive-extraction
`tar` dependency. Other packages are refreshed within their existing version
ranges. The design-system 1.0.1 archive URL and SHA-512 integrity are unchanged.
Frozen-lockfile installs remain required.

Narrow transitive overrides select patched versions without changing public
APIs across major versions:

| Dependency | Selection | Compatibility and exposure |
| --- | --- | --- |
| js-yaml 3.x | 3.15.2 | Same major; preserves `safeLoad` used by gray-matter. Parses repository-controlled Markdown front matter during builds. |
| lodash 4.x | 4.18.0 | Same major used by Recharts. Removes prototype-pollution advisories; deprecated upstream package still needs future migration if charts become used. |
| PostCSS 8.x | 8.5.23 | Same major for Next/Tailwind/autoprefixer CSS compilation; fixes scanner-reported parsing advisories. |
| nanoid 3.x | 3.3.18 | Same major transitive ID generator used by PostCSS. |
| source-map-js | 1.2.2 | Patch upgrade of compiler source-map library. |

Next 16.4.0 declares optional `sharp: ^0.35.4`; the lockfile selects patched
0.35.5 within that supported range. There is no Sharp override. Do not treat a
successful static build as validation of a future image-optimizer deployment.

Production uses `output: "export"`; Cloudflare Pages serves the generated `out`
directory, with no Next server, Server Actions, or image optimizer. The previous
Next advisories were scanner findings, not verified production RCE. Upgrading
removes those affected versions rather than suppressing their advisories.

## Residual finding

After updates, `pnpm audit --json` reports **one moderate, zero high and zero
critical** findings. The publishing Worker `npm audit --json` reports **zero**.
No audit entries are ignored or suppressed.

- **GHSA-hp3w-g68c-fv3c**, `sprintf-js@1.0.3`, moderate: an attacker-controlled
  formatting template with excessive numeric precision can raise `RangeError`.
  The advisory lists no patched release.
- Dependency path: `gray-matter > js-yaml@3.15.2 > argparse@1.0.10 > sprintf-js`.
- Reachability: Bathos imports gray-matter to parse committed Markdown; js-yaml's
  library API does not import its CLI's argparse dependency. Repository source
  does not import sprintf-js or argparse. The CLI formatting path is outside
  Bathos's build/content parsing and absent from the static browser runtime.
  There is no anonymous server-side content parsing endpoint on Pages.
- **Owner: Bathos repository owner (`sighmoan1`).** Assessed as not reachable through
  the current build and runtime paths; this is not owner acceptance of risk. Re-audit on dependency update and before adding YAML
  CLI use or accepting user-provided format strings. Upgrade to an upstream fix
  when available, or replace gray-matter/js-yaml with a supported compatible
  parser as a separate migration if the dependency remains unmaintained.

## Validation

Install the reviewed lockfile with `pnpm install --frozen-lockfile` and
`npm ci --prefix workers/admin-oauth`, then run `pnpm verify:release`. Exact
results are recorded in the linked pull request. This change does not alter
repository/Cloudflare settings, merge, or deploy.

## Primary references

- Next 16.4.0: https://github.com/vercel/next.js/releases/tag/v16.4.0
- Sharp 0.35.5: https://github.com/lovell/sharp/releases/tag/v0.35.5
- js-yaml 3.15.2: https://github.com/nodeca/js-yaml/releases/tag/3.15.2
- YAML CPU fix: https://github.com/nodeca/js-yaml/security/advisories/GHSA-2883-xcg3-v3hh
- Residual sprintf issue/source: https://github.com/alexei/sprintf.js/issues/237
- Residual advisory: https://github.com/advisories/GHSA-hp3w-g68c-fv3c
