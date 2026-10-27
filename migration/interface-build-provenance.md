# Interface static build provenance correction — 2026-10-27

Status: focused release-builder regressions **PASS 3/3**, after observing the corresponding failures before the correction. Full production Interface export and integrated release acceptance remain with the M6 release owner after committing the reviewed source.

Source base: `81a5ba693de77a502d2f965c9ee3255773a2cc8d`. The Interface checkout had no staged changes when this work began. The release owner separately updated the Contracts lock/integrity fields; this work changes the builder, its regression tests and the affected README/work-unit documentation. No source checkout was staged or committed by this work unit. Synthetic Git fixture commits exist only inside the shared external test session.

## Defect and correction

The old exporter obtained source bytes and revision metadata from Git, but copied static files from ignored checkout `dist`, or from an arbitrary `--static-root` folder. It never executed the committed build. Consequently stale or unrelated files could receive the current commit's static provenance, and a committed build that omitted a required page went unnoticed if ignored `dist` still contained it.

The supported builder now captures the revision once and exports that exact revision with checkout newline conversion disabled. The canonical DEV allocator creates fresh external staging and validates that the requested output is a child of the current owned session. The builder writes the committed source into staging, executes that export's committed SDK bootstrap, adopts its inherited owned environment, performs locked `npm ci --no-audit --no-fund`, and runs `npm run build`. Only the resulting staging `dist` is packaged. `--static-root` is no longer accepted. Earlier checkout/CI builds remain independent verification gates and can be repeated by the release build.

The existing deterministic archive format, source fingerprint algorithm, exact revision/version metadata, immutable output-file checks and all three production entrypoint requirements remain. Source aliases are rejected during Git export; static aliases are rejected before traversing a directory. Bootstrap and npm stdout/stderr start in external owned files. Staging and logs are retained for inspection and the release owner's eventual guarded cleanup.

## Executed verification

Commands ran with the canonical `m6-release-20261027` owner, all six repository roots, shared external session, and external TEMP/TMP/TMPDIR/npm cache. Local tools were Windows, Node 24.20.0 and Python 3.14.4. Hosted CI continues to select Node 22 and Python 3.12.

```text
node --test scripts/build-release.test.mjs
actionlint -shellcheck= -pyflakes= .github/workflows/frontend.yml
git diff --check
```

Before the correction, all three new scenarios failed for the intended reasons: the static archive contained `stale ignored bundle`; arbitrary static input returned success; and the missing-page build returned success because it was never run. After correction, the final focused command passed **3/3 in 84.292 seconds**, with zero skips. An earlier corrected run passed 3/3 in 85.465 seconds. The earlier 22.07-second exporter measurement in [M6 product version work](m6-release-work.md) remains historical evidence of the initial implementation; it did not establish source-to-static build correspondence.

The fixture executes the real committed production bootstrap code with a digest-pinned minimal SDK archive and a real npm lockfile. Both repeat exports performed actual `npm ci` and `npm run build`. Build receipts prove distinct fresh source directories, no `.git` directory in either build tree, exact committed LF source bytes and the installed SDK's expected marker. Both source archive hashes and both static archive hashes matched across the independent builds. All three archived HTML entrypoints contain the expected committed-source/SDK output. The caller's stale `dist` remained unchanged and no caller `node_modules` was created. Dirty source, arbitrary static input and a freshly built missing entrypoint all reject.

Python source was parsed with `ast.parse` without generating bytecode; syntax passed. `git diff --check` passed after correcting a test-file trailing blank line. Test logs, child bootstrap/install/build logs, build receipts, fixture inputs and archive contents were inspected. This builder work generated no screenshots or other visual evidence.

Interface's CI export step now receives the same immutable artifact URL variables and scoped read token as the initial bootstrap step, because the fresh source export has no caller artifact cache. Actionlint **1.7.12** passed the complete Interface workflow with the required flags. Its Windows AMD64 archive SHA256 `6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9` matched the retained release checksums. This is local workflow validation, not hosted CI execution.

The Interface checkout was also bootstrapped using the release owner's explicit final Contracts manifest, then `npm ci --no-audit --no-fund` installed 92 packages successfully. Installed SDK version is 0.1.1, with selected npm SHA256 `3bfc8b6f84b645cd6b7864bd1391de1d5efdc6ee4ba653cb92e145a3ddd2bc83`. Local npm reported blocked install scripts for esbuild/vue-demi; this work did not change npm policy. The focused builder fixtures contain no third-party install scripts.

## Limits and retained ownership

The real full Interface release build cannot be claimed from an uncommitted checkout. The release owner must commit the reviewed builder and pins, run the supported builder against that clean commit with the selected immutable artifact manifest/URLs available, inspect its external build logs and validate the resulting source/static archives. Full standalone tests/build, browser GREEN/original-gallery rerun and complete M6 browser acceptance are separate pending gates in this work-unit record. A minimal fixture pass does not substitute for those gates, hosted CI or publication.

All new raw output began outside every source checkout and Git administration directory. The installed `.artifacts` archives and `node_modules` are dependency inputs/cache rather than diagnostic evidence. Existing source assets, golden baselines and historical measurements were preserved. Shared-session cleanup remains with the release owner while other work units are active.
