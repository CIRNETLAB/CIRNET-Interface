# Interface M2 verification and handoff

Status: **LOCAL_UNPUBLISHED; independent build/unit gates pass; full browser gate FAIL with a reproduced pre-existing baseline timeout.** This handoff does not grant unconditional release acceptance. No M3 work was performed.

The standalone `@net-circuit/web` / `netcircuit-interface` product is **0.1.0-m2.0**. The target matches the reviewed **554 source files**, excluding artifact metadata (the source archive has 555 regular files including metadata). Source fingerprint (`sha256-path-lines-v1`): `0cc7226388831e448864349651a7e9462114d66809801bab0e903ca1c54559b1`. Interface consumes Contracts **1.0.1** public SDK/resources; Remote owns API/RPC/Simulator startup, real restarts and shutdown. Graph 1.0/1.1/1.2 and same-origin `/api`, `/ws`, `/models` are preserved.

Remote base: `745077403f233790bdb6781c36d6502feca01642`; Interface original base: `0ac420fc4090fe27ebc497579c28d0852f3f3c62`. Approved local branches: `codex/m2-interface-consumer` and `codex/m2-interface-extract`. No commits, staging, pushes, merge, deployment or M3 work are authorized/performed by this handoff.

## Immutable local artifacts

M2 directory:
`C:\Users\trann\.codex\visualizations\2026\10\24\01a16c1e-02ba-7253-9226-6f4a43582df4\migration-release-artifacts\m2-interface-0.1.0-m2.0-20261024-gKwWRT`

| File | SHA-256 |
| --- | --- |
| `netcircuit-interface-0.1.0-m2.0-source.tar.gz` | `56d85ec4c6bea9b69e8c8dac801a5ecaf86d9c9dbe678721e2b6eaa670f0c30e` |
| `netcircuit-interface-0.1.0-m2.0-static.tar.gz` | `8ca2e539767235cc38c3b298016db9f62ddd5086e50d07fc5abb367c42f318b5` |

The exact durable M1 manifest, also recorded in Remote's `docs/verification/2026-10-24-multi-repo-migration-m1.md`, is:
`C:\Users\trann\.codex\visualizations\2026\10\24\01a16c1e-02ba-7253-9226-6f4a43582df4\migration-release-artifacts\m1-contracts-1.0.1-20261024-LiyD0Y\artifacts.json`

| M1 artifact / version | SHA-256 |
| --- | --- |
| Contracts wheel 1.0.1 | `ab865f991950fb575d86d3b6bb23646864c706b64c3d0305ba4b9ca9d0237c79` |
| Contracts sdist 1.0.1 | `d527113fcd9d41d192576b49b69bf7a7af2f329b61a696c96220b1cf10af1473` |
| `@tinihi-labs/contracts` npm 1.0.1 | `17cac7b7ec725581b2ff02078900d5a08ac0f5504df2e1fc3c3703a594c86579` |
| DEV allocator wheel 1.0.0a1 | `ff76532c69b2115338edb641660c966c5459dd40cb806f52a1e2e8c379c70a1f` |
| DEV allocator sdist 1.0.0a1 | `e437f0719d2756f1e15f04d28246089ee66f517ba14a8771297bedb5ba4afaf0` |
| `@tinihi-labs/artifact-paths` npm 1.0.0-m1.0 | `53190cceb3eee6bb92e91edf1eda0c01043e0ea095cbba1e745a0f7103e6f6df` |

Canonical DEV Node resource: `7c42c4fd171ed861b365f08501f3c765282d6bba2dcd6430c9677cddd1abe345`. Compatibility OpenAPI: `f55fbf65d4988bc122b52936e69654a1024c8ac5d30240041629620b2a524e20`; Hardware RPC 2.0. Standalone Interface CI uses Node 22 without Python; Remote integrated CI configures Python 3.12; the prepared local environment is Node 24.20.0/Python 3.14.4. Playwright remains 1.64.1 with its pinned Chromium revision 1248; installed-cache headless executable digest is `f77d8e27c8db1e4ac0399459a00e0c97bb9417adc393474cabaffebe2314ecb0`. The actual full run used an allocator-owned physical browser copy; observed rendering was Three r171/WebGL2/ANGLE Vulkan SwiftShader, depth24. Installation-cache preservation and diagnostic cleanup are recorded below.

## Local PowerShell bootstrap

Use a fresh PowerShell process. Choose a reviewed product path and external artifact parent. Set **all three Git roots and ownership before bootstrap/session allocation**. Bootstrap's Node child cannot modify the parent shell: explicitly adopt its returned environment before `npm ci`.

```powershell
$remoteRoot = 'E:\ALL_PROJECTS\LUAN_VAN_TOT_NGHIEP\REPO\net-Circuit-Remote'
$interfaceRoot = 'E:\ALL_PROJECTS\LUAN_VAN_TOT_NGHIEP\REPO\net-Circuit-Interface'
$contractsRoot = 'E:\ALL_PROJECTS\LUAN_VAN_TOT_NGHIEP\REPO\net-Circuit-Contracts'
$manifest = 'C:\Users\trann\.codex\visualizations\2026\10\24\01a16c1e-02ba-7253-9226-6f4a43582df4\migration-release-artifacts\m1-contracts-1.0.1-20261024-LiyD0Y\artifacts.json'
if ($env:NETCIRCUIT_ARTIFACTS_SESSION) { throw 'Use a fresh shell without an inherited artifact session.' }
$env:NETCIRCUIT_ARTIFACTS_CONTEXT = (@{
    owner = 'netcircuit-interface-handoff'
    roots = @($remoteRoot, $interfaceRoot, $contractsRoot)
} | ConvertTo-Json -Compress)
$env:NETCIRCUIT_ARTIFACTS_DIR = [IO.Path]::GetTempPath()
$env:NETCIRCUIT_CONTRACTS_ARTIFACT_MANIFEST = $manifest
$bootstrapJson = & node (Join-Path $interfaceRoot 'scripts/bootstrap-contracts.mjs') --manifest $manifest
if ($LASTEXITCODE -ne 0) { throw 'Reviewed artifact bootstrap failed.' }
$bootstrap = $bootstrapJson | ConvertFrom-Json
$bootstrap.environment.PSObject.Properties | ForEach-Object {
    [Environment]::SetEnvironmentVariable($_.Name, [string]$_.Value, 'Process')
}
Push-Location -LiteralPath $interfaceRoot
try {
    npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Locked Interface install failed.' }
} finally { Pop-Location }
```

A source export inside an owned session must inherit this real-Git-root context; do not treat the export as another Git root. Keep diagnostics and logs under `$bootstrap.artifactSession`. Use a new owned session for follow-up verification; never reuse or clean another active session.

## Explicit integration target

Use the prepared Remote interpreter; direct Node execution otherwise defaults to the absent `.audit-runtime` environment. The exact selected M1 wheel and three local consumer packages must already be installed in that environment.

```powershell
$env:NETCIRCUIT_E2E_PYTHON = Join-Path $remoteRoot 'services/api/.venv/Scripts/python.exe'
& node (Join-Path $remoteRoot 'scripts/e2e-interface.mjs') --interface-root $interfaceRoot --forbid-only
```

Alternatively, use the same prepared interpreter with the release runner, which sets its child interpreter automatically. Choose this instead of the direct Node gate:

```powershell
& $env:NETCIRCUIT_E2E_PYTHON (Join-Path $remoteRoot 'scripts/check_release.py') --group browser --interface-root $interfaceRoot
```

Keep one worker, zero retries and the pinned owned browser-runtime copy. The suite needs the exact Playwright cache installed by `npm run test:e2e:install`; these snippets are follow-up instructions; executed verification results are recorded below.

After inspecting evidence and confirming all owned processes exited, clean only that session with:

```powershell
& node (Join-Path $interfaceRoot 'scripts/cleanup-contracts.mjs')
```

This verified independent cleanup does not need installed node_modules, so it also works after a successful bootstrap followed by failed `npm ci`. Preserve durable release artifacts and Git bundles. **Current M2 final cleanup: COMPLETE by2026-10-24T12:10:11Z.** Both owned sessions netcircuit-gKwWRT/netcircuit-Megq3Q were guarded-cleaned after evidence inspection; physical absence was verified. Original527 Web files, developer database, nine pytest-cache files,605 browser-cache files, icons/models/licenses and all original HEADs were preserved. No owned process identity or listener remains. Durable release/history directories are retained separately.

## Review, rollback and proposed commits

Fresh verification: 1,443 unit tests PASS; 18 final tooling tests PASS; AST boundaries, E2E types and all three HTML build entrypoints PASS; fresh offline npmci installs 92 packages. Remote Contracts/API release checks pass 572 Python tests with two Windows symlink-privilege skips. Remote output/lifecycle regressions pass eight Node tests; both real default/custom lifecycle cases pass2/2 in133.69s, covering same-session repetition as well as separate output sessions. No future committed checkout was fabricated: verification uses exact fresh uncommitted source exports and extracted artifacts. Only README instructions changed after the full browser run; the other 553 reviewed source payloads and all 34 static build files remain byte-identical.

The complete browser suite records **54 PASS, 1 SKIP, 1 FAIL**, one worker/zero retries, 56.2 minutes; API shutdown exits0. The skip is absent retained pre-fix native WebGL evidence. The failure is the original10s `open()` predicate at gallery lines74/299, on the sixth expanded-graph ADD after five complete resource-release cycles. A separately prepared original-source product reproduces the same twelfth upload/cycle5 timeout with the same unmodified assertions: test140.374s, outer runner210.772s, exit1/API shutdown0. All six validators, eight catalogs and161 public names match; the old package/lock/catalogs are preserved in the comparison. The native gallery, units/DIP14/instrument screenshots and baseline failure screenshot were actually inspected. The visible bounded-recovery warning does not prove the timeout's root cause. No gallery/recovery production fix or relaxed assertion/timeout is included in M2.

The first browser invocation exposed a migration tooling regression: outside-product Node bundles retained bare SDK imports. Four native helpers and the historical/current benchmark now bundle versioned dependencies; five real subprocess regressions pass, with original Unicode selectors preserved. A later Remote-only fix consumes all four `--output`/`-o` forms before backend startup and adopts one owned session, including temporary/cache paths. Output parents in its tests are allocator-owned; ten earlier fixture sessions/verified empty parents were guarded-cleaned. These corrections do not relabel the failed full browser result.

The final local source archive has554 payload files plus metadata; this late Markdown companion is excluded to avoid self-referential artifact digests. Future committed CI includes it while excluding it from the fingerprint. Hosted CI, publication/private ACL proof, ancestry connection and deployment remain NOT RUN or separately pending. Required reviewed Interface URL/SHA variables and private artifact read-token configuration must be supplied before a hosted release gate.

History preserves 102 filtered commits at `4784ff913db83915104406e92019b3bde574ecc1`. The original Interface history remains separate; ancestry connection needs separate user approval. Three durable bundles and exact hashes are recorded in `docs/verification/2026-10-24-interface-history.md` and remain outside diagnostic cleanup.

No rollback has run. Preserve current working diffs and durable archives; review any rollback path list first. Remote's 527-file M1 Web reference remains intact, and the initial Interface/full source/filtered histories remain recoverable from their verified bundles. Select a previously accepted compatible artifact set in an isolated environment rather than resetting or deleting these checkouts.

Proposed only, after review and final gate disposition:

- Interface: `refactor: extract Interface with Contracts 1.0.1 and standalone CI`
- Remote: `refactor: integrate versioned Interface artifacts and browser lifecycle`

No commit, stage, push, ancestry merge, deployment or M3 action is implied.

## 2026-10-27 investigation follow-up

The [native gallery recovery investigation](native-gallery-investigation.md) records a fresh unchanged original-gallery PASS, the separately diagnosed synchronous recovery work, its bounded-count correction and current verification limits. The historical M2 full-suite result and measurements above remain unchanged; this follow-up does not relabel the original failure or grant full M6 acceptance.
