# Native gallery recovery investigation — 2026-10-27

Status: the historical M2 sixth-ADD timeout did **not reproduce** in the fresh original-gallery run. A separate reproducible recovery scheduling defect was diagnosed, tested RED/GREEN and corrected. This record does not replace the M2 full-suite failure or establish full M6 acceptance.

## Source and environment

Interface base: `24968de2803cf69c7c5159f649f21ec0c32f8b5e`. The initial runs used unchanged production/browser source and the installed Contracts npm 1.0.1 SDK. Other M6 work concurrently changed version/build metadata toward 0.1.1; those metadata edits were not a runtime fix. The first backend was started from Remote before its version adapters changed. Later legacy-backend probes used a clean external export of Remote `40ad3a6` (`scripts`, `integration`, `services/api`, `contracts`), the existing API interpreter, and installed Contracts 1.0.1 / Simulator 0.2.0 / Hardware 0.1.1. No sibling product implementation was imported.

Local environment: Windows, Node 24.20.0, Python 3.14.4, Playwright 1.64.1, Chromium revision 1248. The copied headless executable reports Chrome for Testing 156.0.8078.4. Source and copied executable SHA256 both equal `f77d8e27c8db1e4ac0399459a00e0c97bb9417adc393474cabaffebe2314ecb0`. The launch retained the existing ANGLE/SwiftShader arguments, one worker and zero retries.

Every process retained the canonical `m6-release-20261027` context with all six absolute Git roots and the shared external allocator session. External drivers copied the complete Remote installation cache into fresh `br-<8hex>` children using Interface's existing `copyBrowserRuntime`; they used its public `PLAYWRIGHT_BROWSERS_PATH`, the actual API/RPC backend, same-origin Vite on port 14173, and external temporary files/logs/output from the start. No Interface browser cache was populated. Each completed backend shutdown reported exit 0. These diagnostic drivers are distinct from the complete Remote release gate.

## Observed behavior and cause

The unchanged original test `contact and continuous-wire gallery retains native closeups, cavity evidence and stable GPU resources across ten cycles` passed 1/1 in 6.7 minutes. All 21 file imports completed. Each removal restored 177 geometries, 9 textures and 170 draw calls; expanded graphs used 341 geometries. All original package/lead/wire measurements, closeups, cutaways, graph-export and page-error assertions passed. All 13 resulting native screenshots, the measurement JSON and diagnostic logs were inspected. No timeout, retry, assertion or baseline was changed.

A temporary focused repeat of the same ten add/remove cycles also passed (2.1-minute test, 2.8-minute outer run). A real Chromium CPU profile showed 29.259 seconds under `ProjectSaveController.checkpoint`, with 29.137 seconds in `BoundedRecoveryRepository.save`, out of 117.806 sampled wall seconds; 61.954 seconds were idle and the native render callback used 9.154 seconds. Recovery spent its time parsing and validating every retained draft, twice, including mounting/lead collision checks, before discovering that the incoming batch exceeded the existing account bound. The final real Pinia state had 22 drafts, the expected nine active module IDs and the bounded-recovery warning. Most import-to-scene-ID checks completed in tens of milliseconds; recovery work could instead delay the following poll or camera-settle task.

The repository previously applied count bounds only after decoding all incoming graphs and entering the storage transform. An incoming count above the account or global maximum can never fit, even in empty storage. The fix rejects those two cases immediately after principal validation, before graph payload reads. Existing limits, error wording, graph validation for admissible batches and the atomic merged-storage checks remain in place. No drafts are evicted and the visible recovery-failure behavior is preserved.

This profile establishes the avoidable main-thread work and its owner. It does not prove that this work alone caused the historical M2 timeout, whose exact failure did not recur in the fresh original run.

## Regression evidence

The new unit case `impossible recovery batch counts reject before inspecting graph payloads and preserve stored drafts` failed before the fix: graph-schema validation ran before the account count bound. After the two early guards, the complete recovery unit file passed 7/7.

The new browser case `an impossible recovery batch preserves stored graphs and leaves the native workspace responsive` uses the actual browser recovery repository, real IndexedDB and valid native mounted graphs. Test-only graph accessors observe whether an impossible batch's payloads are inspected; they return the real graph and do not replace parsing, validators, geometry or storage. Before the fix the browser observed 128 payload inspections where zero were required. The normal 10-second poll, preserved stored graph and resumed native camera-frame checks remain. An earlier diagnostic timing probe measured 6,644.6 ms for the rejected batch; elapsed time is attached as evidence, with no permanent microbenchmark threshold.

The temporary profiling hooks and duplicate focused cycle case were removed. The original `e2e/contacts-wires-gallery.spec.ts` is unchanged. The retained production change is four lines in `src/application/projects/recovery.ts`; regression coverage is in `tests/project-recovery.test.ts` and `e2e/recovery-responsiveness.spec.ts`.

Focused legacy-SDK unit command (with the shared session/context and external TEMP/TMP already selected):

```text
node node_modules/esbuild/bin/esbuild tests/project-recovery.test.ts --inject:tests/helpers/contractProfiles.ts --bundle --platform=node --format=esm --packages=external --outfile=.test-build/project-recovery.test.mjs
node --test .test-build/project-recovery.test.mjs
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.e2e.json
```

The focused unit command passed 7/7 and the E2E type check passed. An earlier invocation of the normal test harness stopped in its Contracts bootstrap/consumer prelude while M6 metadata referenced 0.1.1 archives that had not yet been materialized; it did not reach the recovery unit case. The final normal standalone gates must use the completed 0.1.1 bootstrap.

## Remaining acceptance and cleanup

The final browser GREEN, unchanged original-gallery rerun with the new reviewed dependency set, normal standalone gates and complete Remote M6 browser suite are pending in this work-unit record. The complete suite must retain `--forbid-only`, one worker, zero retries, real services and all original assertions. A focused pass does not establish full-suite, hosted CI, deployment, physical hardware or electrical behavior.

Initial ignored-output inventory, raw profiles, timings, traces, screenshots and logs were created outside every Git directory. `.test-build` remains the existing allowed compilation cache. Initial staged changes were empty. The shared-session owner retains cleanup responsibility after all agents finish and inspect their evidence; this browser work unit must not clean other active work. Installation caches, source assets, historical measurements and baselines were preserved. No stage, commit, merge or push was performed by this work unit.
