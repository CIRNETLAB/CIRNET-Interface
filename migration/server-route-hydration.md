# Server route hydration and document commands — 2026-10-28

Source base: `bac9b0b41ee9b8fa4a987378b98c062fe33b20a7`. This record describes the subsequent uncommitted repair; no staging, commit or publication was performed by this work unit.

## Observed failure and boundary

The clean Windows M6 browser group completed with **55 PASS, 1 FAIL and 1 historical optional NOT_RUN** out of 57 cases. The unchanged final tactile persistence case failed after reload: Export downloaded the initial local document before the server route had replaced it. Earlier checkpoint, PUT, HTTP GET and held-input Export assertions passed. The optional historical depth baseline was skipped because its explicitly optional input was absent; it is not a passing case.

The retained trace establishes the ordering. Reload finished at monotonic time 2959674.449 ms; the scene-ready probe finished by 2959791 ms; the final Export interaction started at 2959844.755 ms. The real circuit GET started at 2959858.381 ms and took 27.802 ms. Download at 2959887.955 ms was named `Untitled_circuit_1.json`. The GET response contained revision 2 and the exact tactile module `T`, with `pressed:false`. Rendering a local scene was therefore insufficient to establish that a server document was ready for document commands. The saved server graph was intact. The complete downloaded failure body was not recovered from the trace.

## Correction

Project route navigation now exposes synchronous pending state across authentication readiness, principal transition, project selection, pagination and document hydration. Only the current navigation may complete that state; disposal clears it and invalidates late completion. Existing controller cancellation and payload ownership behavior are outside this patch's claim.

Save, Save As and Export use that state at the File command boundary, including Ctrl+S and direct Export invocation. Secondary Project Manager buttons reflect it, and the store save actions independently reject premature calls. New/Open/Import, unrelated workbench actions, Stop and Cancel retain their existing behavior. No existing browser timeout, assertion, retry, screenshot or baseline was changed.

## Focused verification

All outputs began in canonical external sessions under `C:/Users/trann/AppData/Local/Temp/netcircuit-I5PBHI/tmp/netcircuit-h1r8kE`, with owner `m6-clean-acceptance-lf`, its seven-root context and external TEMP/TMP/npm cache. A fresh physical test copy of the authenticated source product received only this patch; the original product remained untouched. This working copy is test evidence, not a new release artifact.

The initial unit run produced the intended three failures for absent pending state and enabled document commands. A separate direct-store regression failed when its forbidden save controller was reached. The final selected five-file run passed **35/35**, including auth/selection/hydration, stale completion, disposal, menu/keyboard dispatch, unrelated Open Project and store save rejection. Type checking passed. AST boundaries passed for **229 source modules**.

The subsequent full `npm test` run passed **1448/1448**, zero failures/skips/cancellations, in 126.193 seconds of test execution. Its type-check phase and separate Contracts prelude also passed. The complete log was inspected; the preceding npm update notice does not change the locked tool/dependency selection.

```text
node scripts/test.mjs audit-file-lifecycle.test.ts project-navigation.test.ts projects.test.ts project-window.test.ts header-ribbon.test.ts
node node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p tsconfig.tests.json
node scripts/check-boundaries.mjs
npm test
node run-browser.mjs e2e/labels-contact-interaction.spec.ts --grep "native held tactile input|server route hydration blocks" --forbid-only
```

The new native regression fetches the actual saved graph from the actual API, verifies module `T`, then holds fulfillment. While a scene is already rendered, File Save/Save As/Export and both Project Manager save buttons must be disabled. Releasing that same response enables Export, whose graph must contain exact `T` with `pressed:false`. Before the repair this regression failed because Export was enabled. After the repair, the unchanged original case and new case passed **2/2**; the final exact-source run took **1.2 minutes**, with zero retries and orderly backend shutdown.

Final browser evidence is in session `netcircuit-38bU9N`; focused logs, RED evidence locations and inventory are recorded by `navigation-fix-6b21a152`. The final tactile screenshot was inspected: it shows the expected named SERVER-saved revision 2 document. Its JSON independently contains schema 1.2, exact physical descriptor `OMRON-B3F-1000` revision 2 / `B3F6-FORMED-BBI3` revision 2 and `T.properties.pressed:false`. No video playback is claimed.

The final browser used a complete physical owned cache `br-7b6d37e2`. All **604 regular payload files** match the installed source cache by size and SHA256, excluding only `.links` and debug logs; no aliases were accepted. Playwright is 1.64.1 / Chromium 1248. Headless executable SHA256 is `f77d8e27c8db1e4ac0399459a00e0c97bb9417adc393474cabaffebe2314ecb0`; full Chromium SHA256 is `7f08161bbeb2853ffe1780a9ded4985087f52efb9725d7d8207aabdd42f7cfb9`. Post-run checks found no owned browser/API process or reserved-port listener. Installed API, Contracts, Simulator and Hardware versions were all 0.1.1.

## Remaining release gates

The release owner must commit the reviewed patch, build a new immutable candidate through the supported fresh-export builder, and repeat complete source/static and browser acceptance. The previous release files remain preserved. These focused passes do not turn the earlier full-group failure into a full-group pass.

Separately, the hosted Linux run was cancelled after reaching 14 of 57 cases, with four actual timeouts before cancellation (gallery selector, display screenshot and DPR1/2 depth capture). Trace analysis supports software-renderer/compositor pressure, without proving a semantic graph or depth mismatch. That investigation remains active and is not repaired or waived by this route change. Shared evidence is retained for the release owner's later guarded cleanup.
