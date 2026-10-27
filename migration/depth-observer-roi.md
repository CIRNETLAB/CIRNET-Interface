# Depth observer region proof — 2026-10-28

The depth observer now scissors its original and diagnostic analysis draws to the exact existing integer bounds of the tested physical pixels. Full framebuffer readbacks, buffer indexing, every polygon pixel, foreground ray and erosion mask remain unchanged. DPR, geometry, material identities/sorting, viewport, shadow state, thresholds and semantic assertions are preserved. Transmission render targets retain Three's full offscreen pass. The full restoration draw/readback remains, and `finally` restores callbacks, material state and the caller's scissor rectangle/enabled state. An already enabled caller clip is intersected rather than enlarged.

`e2e/depth-artifacts.spec.ts` is unchanged: all original loops, assertions and timeouts remain. Its canonical SHA256 is `1458fe4189552d904a83ee0f4d61661746e19fb5f0c566282f4de1e89f897f0d`.

## Verification

Local work used a physical external source/dependency candidate based on `62b20b198b23556007582abeafbe5536dd28532f` with the pending observer/probe changes, Node 24.20.0, Playwright 1.64.1 and Chromium 156.0.8078.4. The browser and all diagnostics were physically outside Git in the shared allocator session. B's `--disable-gpu-compositing` retained real SwiftShader WebGL. These results are local Windows evidence; hosted Linux, complete browser and master acceptance remain separate gates.

- RED: the real-browser smoke probe failed because the harness did not yet expose its reference/ROI equivalence entry point. The earlier hosted B diagnostic also retained its genuine original DPR 2 timeout at 360s.
- GREEN: **78/78** byte-equivalence cases: all 30 current/historical poses at both DPR 1/2, 16 glyph ON/OFF representatives and two positive controls. All 11,850,288 tested pixel positions had identical original and diagnostic RGBA bytes between full reference and ROI paths; every full restored framebuffer byte and every `tested`, `changed` and `regions` result also matched.
- The positive controls intentionally exposed a real package underlayer only inside the proof, detected 11 leaking pixels at DPR 1 and 328 at DPR 2 in both paths, then restored normal material/order state and every normal framebuffer byte. No production source state or baseline was changed.
- Four dedicated checks injected an exception after the colored GPU draw at DPR 1/2 with nondefault scissor rectangles, initially enabled and disabled. Callback/material/scissor state and the actual finally-restored framebuffer matched; the checker read that framebuffer directly without another draw. These checks cover the later enabled-caller intersection branch; the normal disabled-scissor draw path exercised by the 78-case matrix was unchanged.
- The **unchanged original DPR 2 test passed**, one test, no failures or skips, all 30 poses, 127.975s test time (166.916s runner time), within its original 360s deadline.
- Final E2E TypeScript checking, probe syntax checking and whitespace checking passed. The restored native screenshot was inspected.

Raw receipt: `C:/Users/trann/AppData/Local/Temp/netcircuit-I5PBHI/depth-roi-verification.json`. It records exact source hashes, full proof/guard paths, JUnit and captures. The full proof and guard/gate launches reused canonical allocator-owned `br-roi-*` physical copies before naming alignment; future probe launches use the literal `br-<8hex>` convention. The gate's JUnit originated outside Git in the shared reporter directory and was copied into its unique gate receipt. Existing evidence is preserved. This verification preceded the release owner's commit, push and artifact build.

## Reproduce

After the normal reviewed artifact/bootstrap setup, inherit the documented shared allocator context/session and select a complete prepared browser cache. Run from an owned physical Interface source/dependency export:

```sh
node e2e/depth-roi-equivalence.probe.mjs
```

`NETCIRCUIT_ROI_BROWSER_CACHE` can explicitly select the prepared source cache; the probe physically copies it to its own canonical external runtime before launch. It writes incremental receipts outside Git and closes its browser/Vite processes. `--smoke` checks one real pose; `--guards-only` runs only the exception/state guards. Both are explicitly partial proof modes. The expensive full proof is deliberately outside ordinary `*.spec` discovery and never substitutes for the original acceptance tests. Its full-analysis variant exists only to check byte equivalence, not to bypass an acceptance assertion.
