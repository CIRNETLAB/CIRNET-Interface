# Web Frontend — Interactive Single Workspace

Current authority: [Lab-First v3.1](https://github.com/net-Circuit-Remote/net-Circuit-Remote/blob/745077403f233790bdb6781c36d6502feca01642/docs/ARCHITECTURE.md). Vue 3, TypeScript, Pinia and Three.js share one mounted workbench and one mutable circuit document. Public REST/WebSocket boundaries use generated DTOs and runtime validators. Authentication, private projects/recovery, assignment authoring/publication, execution history/queues and virtual digital captures use the real application services. Graph 1.2 flexible assemblies and pinned free physical descriptors use additive versioned operations; legacy Graph 1.0/1.1 files retain their meaning. Historical source reports remain useful for editor interaction details; they do not override the current architecture or capability declarations.

## Run and verify

This repository is the standalone Interface product extracted at Remote revision `745077403f233790bdb6781c36d6502feca01642`. Node 22 is the CI toolchain. Production uses immutable `@tinihi-labs/contracts@0.1.1`; independent DEV allocator `@tinihi-labs/artifact-paths@1.0.0-m1.0` is not a browser runtime dependency. The current product release version is `0.1.1`; the application identity, existing third-party dependency locks and model artwork are preserved. The exact integration set is recorded in `integration/compatibility.json`. Generic Contracts generation and Python/API implementation are owned elsewhere.

Before `npm ci`, materialize the three reviewed artifacts from an explicit local release manifest or configured immutable HTTPS URLs. Bootstrap verifies the DEV archive and canonical allocator before creating diagnostic output; package caches live only in ignored `.artifacts` and are not source dependencies. Missing or mismatched releases fail rather than falling back to a sibling checkout or latest version.

Use a fresh shell without an inherited `NETCIRCUIT_ARTIFACTS_SESSION`. The examples below prepare integration across three existing Git checkouts; replace the absolute paths. Set their context **before** bootstrap allocates the session and keep it unchanged through child processes and cleanup. For standalone Interface unit/build work, use only this Interface Git checkout in `roots`; other source checkouts are not required. An exported source product inside an owned session inherits the context of the actual Git checkouts rather than becoming another Git root.

Bootstrap prints JSON from its child process; it cannot set the parent shell's environment. Adopt the returned `environment` before invoking npm so cache, temporary files and diagnostics use the selected session.

### PowerShell

```powershell
$interfaceRoot = 'C:\path\net-Circuit-Interface'
$remoteRoot = 'C:\path\net-Circuit-Remote'
$contractsRoot = 'C:\path\net-Circuit-Contracts'
$manifest = 'C:\absolute\reviewed\artifacts.json'
if ($env:NETCIRCUIT_ARTIFACTS_SESSION) { throw 'Use a fresh shell without an inherited artifact session.' }
$env:NETCIRCUIT_ARTIFACTS_CONTEXT = (@{
    owner = 'netcircuit-interface-dev'
    roots = @($remoteRoot, $interfaceRoot, $contractsRoot)
} | ConvertTo-Json -Compress)
$env:NETCIRCUIT_ARTIFACTS_DIR = [IO.Path]::GetTempPath()
$env:NETCIRCUIT_CONTRACTS_ARTIFACT_MANIFEST = $manifest
Set-Location -LiteralPath $interfaceRoot
$bootstrapJson = & node scripts/bootstrap-contracts.mjs --manifest $manifest
if ($LASTEXITCODE -ne 0) { throw 'Reviewed artifact bootstrap failed.' }
$bootstrap = $bootstrapJson | ConvertFrom-Json
$bootstrap.environment.PSObject.Properties | ForEach-Object {
    [Environment]::SetEnvironmentVariable($_.Name, [string]$_.Value, 'Process')
}
npm ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'Locked Interface install failed.' }
```

### Bash

```bash
interface_root=/absolute/net-Circuit-Interface
remote_root=/absolute/net-Circuit-Remote
contracts_root=/absolute/net-Circuit-Contracts
manifest=/absolute/reviewed/artifacts.json
if [ -n "${NETCIRCUIT_ARTIFACTS_SESSION:-}" ]; then
  printf '%s\n' 'Use a fresh shell without an inherited artifact session.' >&2
  exit 1
fi
NETCIRCUIT_ARTIFACTS_CONTEXT="$(node -e 'process.stdout.write(JSON.stringify({owner:"netcircuit-interface-dev",roots:process.argv.slice(1)}))' "$remote_root" "$interface_root" "$contracts_root")" || exit 1
export NETCIRCUIT_ARTIFACTS_CONTEXT
export NETCIRCUIT_ARTIFACTS_DIR="${TMPDIR:-/tmp}"
export NETCIRCUIT_CONTRACTS_ARTIFACT_MANIFEST="$manifest"
cd "$interface_root" || exit 1
bootstrap_json="$(node scripts/bootstrap-contracts.mjs --manifest "$manifest")" || exit 1
environment_lines="$(printf '%s' "$bootstrap_json" | node -e 'let input="";process.stdin.on("data",chunk=>input+=chunk);process.stdin.on("end",()=>{for(const [name,value] of Object.entries(JSON.parse(input).environment)){if(/[\r\n]/.test(value))throw Error("Multiline bootstrap environment value");console.log(name+"="+value)}})')" || exit 1
while IFS= read -r entry; do export "$entry"; done <<< "$environment_lines"
npm ci --no-audit --no-fund || exit 1
```

After either setup, run checks from the Interface root:

```sh
npm run check:boundaries
node --test scripts/*.test.mjs
npm test
npx tsc --noEmit -p tsconfig.e2e.json
npm run build
```

Raw logs, test/browser diagnostics, npm cache and temporary fixtures must use the shared allocator session. See [verification policy](docs/VERIFICATION.md), [M2 verification and handoff](migration/verification.md), [preserved history](migration/history.md) and the pinned artifact lock at `integration/contracts-artifacts.json`. Hosted CI supplies the reviewed release URLs and scoped read token; publication/access is not implied by local extraction. After inspecting evidence and confirming all owned processes exited, `node scripts/cleanup-contracts.mjs` cleans only the owning session using verified DEV tooling; it does not require a successful npm install.

The product's semantic validation/normalization, renderers, commands/history, historical descriptors and lifecycle remain Interface-owned. It consumes package exports instead of regenerating schemas/catalogs. The retained `deviceMetadata.json` presentation snapshot is tested against exact versioned canonical resources; test-only resource readers are outside browser source.

`npm run dev` starts the frontend only. Vite proxies `/api` and `/ws` to `127.0.0.1:8000`; keep FastAPI running using the [API startup instructions](https://github.com/net-Circuit-Remote/net-Circuit-Remote/blob/745077403f233790bdb6781c36d6502feca01642/services/api/README.md#local-run). `ECONNREFUSED 127.0.0.1:8000` means that API target is unavailable. Local graph editing remains available; remote validation, discovery and execution require the backend. `VITE_API_BASE_URL` / `VITE_WS_URL` configure explicit deployed endpoints.

On Windows, closing or reloading a page can interrupt a pending proxy write with `write ECONNABORTED`. The development-only diagnostics plugin reports this specific browser-side interruption as a short warning. It preserves Vite's socket cleanup and log-level settings; upstream errors, refused connections, read failures and unknown errors retain their original diagnostics. If the open page remains disconnected or the warning repeats without navigation, inspect the browser's Network → WS panel and API logs. `NETCIRCUIT_DEV_API_TARGET` overrides the development proxy target for both `/api` and `/ws`; restart Vite after changing its configuration.

The complete real-browser release gate uses Playwright **1.64.1** from `package-lock.json` and its exact Chromium revision. Interface owns Vite and browser runtime copying; Remote owns API/RPC/Simulator startup, persistent test state and controlled restarts. Keep the parent environment adopted above, including the three-checkout context. Install Chromium from Interface, then run the gate from Remote with this product and a prepared backend interpreter explicitly selected.

PowerShell, continuing with the variables above:

```powershell
Set-Location -LiteralPath $interfaceRoot
npm run test:e2e:install
if ($LASTEXITCODE -ne 0) { throw 'Pinned Chromium installation failed.' }
$env:NETCIRCUIT_E2E_PYTHON = Join-Path $remoteRoot 'services/api/.venv/Scripts/python.exe'
Set-Location -LiteralPath $remoteRoot
node scripts/e2e-interface.mjs --interface-root $interfaceRoot --forbid-only
```

Bash, with the prepared Linux/macOS API environment:

```bash
(cd "$interface_root" && npm run test:e2e:install) || exit 1
# Linux CI installs system libraries with: npm run test:e2e:install -- --with-deps
export NETCIRCUIT_E2E_PYTHON="$remote_root/services/api/.venv/bin/python"
(cd "$remote_root" && node scripts/e2e-interface.mjs --interface-root "$interface_root" --forbid-only)
```

Alternatively, from Remote root, use that same prepared Python to run `scripts/check_release.py --group browser --interface-root ABSOLUTE_INTERFACE_PRODUCT`; the release runner passes its interpreter to the Node harness automatically. Choose one integration entrypoint. Exact local verification and outstanding outcomes are recorded in [M2 verification](migration/verification.md).

The install command populates `.runtime/playwright`; test invocations must run
from a fresh complete copy in a unique `br-<8hex>` child of the same shared
allocator session, selected through the public `PLAYWRIGHT_BROWSERS_PATH`.
Before copying, the launcher checks that every copied Windows `.exe` destination
path is at most **259 UTF-16 characters**. Overlong paths fail with instructions
to set a shorter absolute external `NETCIRCUIT_ARTIFACTS_DIR` parent and allocate
a fresh session, without falling back to the installation cache. Copy the exact
installed cache with its binaries,
resources, installation markers, FFmpeg and platform helpers, dereferencing
links and excluding only old `debug.log`/`chrome_debug.log` files and `.links`.
The pinned browser revision and channel stay unchanged. The current Windows
cache adds approximately **718 MiB per invocation**, plus copy I/O and test
outputs. If the cache is absent, install it with the command above; missing or
unreadable cache and failed external copying must fail the test launcher without
falling back to a browser inside the repository.

Windows headless GPU logging can ignore `--log-file` and `CHROME_LOG_FILE` and
write beside the executable. Running the exact copied runtime keeps those
diagnostics outside source along with screenshots, video and traces. Direct
profiling must use the same isolation. Inspect the owned runtime's logs, ensure
browser/FFmpeg/helper processes have exited, then clean only its allocator-owned
session through the [guarded cleanup](https://github.com/net-Circuit-Remote/net-Circuit-Remote/blob/745077403f233790bdb6781c36d6502feca01642/docs/VERIFICATION.md#cleanup-and-ci).
Preserve the installation cache and all historical logs; log flags alone are
not proof of containment.

The harness starts the actual API, SQLite database, local gRPC Hardware Service, virtual digital simulator and Vite. It creates temporary accounts with a fresh generated administrator password, keeps one worker and zero retries, and owns orderly API/RPC/simulation-worker shutdown. A shutdown timeout or nonzero API exit fails the runner. The suite in `e2e/` covers imported GLB previews/fallback, native WebGL context loss/restoration with resumed draw calls and preserved canvas/document/history, real login/revocation/guest claim including socket closure before rotation acknowledgement, assignment CAS/publication/privacy, typed pre-run vectors with a real captured rising edge, history reload without Run replay, a lost Create ACK followed by safe Stop, exact project persistence across an actual API process restart, two-tab save conflicts and principal-partitioned IndexedDB recovery. Later editor cases cover physical assemblies, contact/wire tools, ribbon and camera navigation. Fault interception occurs at explicit boundaries after the corresponding real server action; it does not substitute a simulator or physical driver.

The selected Remote interpreter must already contain the exact reviewed Contracts wheel and API/Hardware Service/simulator consumer set. Direct Node execution needs explicit `NETCIRCUIT_E2E_PYTHON`; its legacy `.audit-runtime` default is not provisioned by this Interface checkout. Reserve loopback ports 14173, 15151 and 18181. Production credentials and physical equipment are not used. The [shared verification policy](docs/VERIFICATION.md) requires Playwright output, failure screenshots/traces and harness scratch outside every repository. Only Markdown verification evidence is retained in the checkout.

[Interface CI](.github/workflows/frontend.yml) uses Node 22 and Python 3.12 (standard-library archive export only): reviewed artifact bootstrap, locked npm installation, script and typed runtime tests, AST boundaries, E2E typechecking, multipage build and versioned source/static artifact export. It does not install Python application dependencies or start backend services. Remote owns integrated browser CI: select a reviewed Interface source artifact by version/digest, bootstrap its pinned resources, install the real Python consumers and exact Chromium, then run the complete real-process suite with focused tests forbidden. Remote also owns PostgreSQL and installed backend-package gates. These are the current M2 ownership boundaries; links to pre-M2 workflow snapshots elsewhere describe their recorded revision. The harness exercises real SQLite and IndexedDB. [M2 verification](migration/verification.md) distinguishes local results, final browser disposition and hosted CI/publication status; a local pass does not claim a hosted run.

Account controls open above the mounted workbench. Session bootstrap, login, logout and explicit guest transfer use server cookies; CSRF and user state stay in memory. Principal changes cancel remote requests, sockets, timers and capture caches, checkpoint prior-principal drafts and clear private documents/history synchronously. The canvas stays mounted. Rotation for the same principal preserves its document. Administrators can create accounts, change roles and disable users; API authorization remains authoritative.

Project Manager provides private server projects, immutable circuit revisions, Save/Open/Save As, bounded lists and conditional deletion. A save supplies its acknowledged base revision; HTTP 409 retains local edits and offers Keep, confirmed Reload or Save As. JSON Import/Export is separate from server Save. Versioned IndexedDB recovery is bounded and partitioned by principal, with explicit guest transfer and visible storage errors. Resource URLs open in the existing workspace; inaccessible or unknown addresses show errors without replacing the canvas.

Instructor/Admin assignment documents keep draft revisions separate from published student views. Saving does not publish. Publication uses revision CAS; students receive a redacted published view. History selection grants read access to evidence and captures; it does not become live execution control. An unresolved operation is reconciled by its existing identity and never replays Run.

## Editor controls

| Surface | Behavior |
|---|---|
| New / Projects / Save / Save As | Local drafts plus private server documents; conditional revisions preserve conflicting local changes. Ctrl+O opens Project Manager; Ctrl+S saves the bound server document or opens Save As. |
| Import / Export JSON | Graph 1.0/1.1/1.2 files use the shared 2 MB UTF-8 limit. Imports check geometry, unique IDs, module references and local memory before mutation. Export does not acknowledge a server Save. |
| Undo / Redo | Compact icon-only buttons before File use mirrored, filled U-turn arrows. Hover tooltips show Undo/Redo and their shortcuts; accessible names and keyboard focus remain available. Last 50 project/graph command snapshots. One move gesture commits one step. Failed/no-op commands preserve history. |
| Ribbon / Run | Component and Run tabs share the mounted ribbon. The selected Header tab joins the Ribbon surface with matching background, top-only rounded corners and no bottom separator; keyboard focus remains visible. Component families use SVG artwork/physical thumbnails; supported flexible parts choose two exact holes (see the placement guide). Oscilloscope and Function Generator place two-channel bench models; Signal Monitor opens a window. Unsupported entries report model unavailable. Run shows the existing execution lifecycle and controls; switching tabs does not execute a command. |
| Collapsible drawers | Components is fixed at96 px; Tools is66 px, or54 px when workbench width is560 px or less. Mounted overlays slide via200 ms transforms; floating top/left edge buttons reopen fully hidden drawers. Collapse closes the component palette and preserves canvas dimensions, camera, tool/selection/placement/graph/history/zoom. Safe areas protect floating windows and contextual controls. Rapid reversals and reduced motion are supported; short rails scroll their tool list. Expanded by default; collapse state lasts for the current session. Manual drawer resizing is removed. Actual viewport changes still update the renderer and cancel transient editor gestures or armed Zoom To Area. |
| Select | Click a module/wire to select it; left drag on a model or empty surface pans without moving the model. Explicit gizmo/contact handles manipulate selection. Ctrl/Meta-click toggles multi-selection; Marquee Select frames a selection rectangle. Inventory/Inspector provide keyboard selection. |
| Move | The only tool that permits direct model dragging, including Breadboard/Board: preview geometry and connected wires; release commits one position command. Cancel restores graph geometry. Click/jitter below 4 px creates no move/history. |
| Rotate / Delete | Rotate clicks add90°. Sidebar Delete is removed; Delete/Backspace and the selection gizmo still delete with connected edges and Undo/Redo. Retained editor delete logic also handles wires. |
| Wire | Choose a jumper color and Free/Orthogonal/Auto mode; left-click a hole or logical port, right-click for corners, then left-click the final endpoint. Repeat right-click at the same snapped position or before moving 4 px to undo the last provisional corner. Esc cancels; Backspace/Delete removes the last draft bend. Select a committed wire to drag user bends/segments, double-click a segment to add an anchor, or select a bend and Delete to remove it. Alt bypasses snap. Finished actions commit one Undo step; endpoints stay fixed while editing the route. |
| View | Left drag empty surface pans XZ; right drag orbits; middle drag pans; wheel dollies. The camera-oriented XYZ control and orientation shortcuts share the navigation authority with zoom/Fit/Area. Zoom In/Out, Marquee Select and Zoom To View Entire Circuit are at status-bar right. Fit frames models/wires and preserves heading. No Perspective box or generic tool-title hint. |
| Zoom To Area | Button immediately right of Zoom To View Entire Circuit. Click, left-drag a rectangle, release to frame its focus while retaining heading/aspect. The selected frame becomes the 100% zoom reference, like Fit. Escape/right click/button toggle cancels; switching tools, placement, graph, viewport or graphics visibility cancels too. Tiny selections retry. Camera-only: selection, graph poses, wires and Undo remain intact. |
| Component Transform Gizmo | One adjacent gizmo serves placement preview and selected models. Ghosts follow the cursor on XZ without holding a button and retain draft rotation. Preview has X/Z/free-XZ/Rotate Y; only Delete is hidden. Ghost and gizmo move together with a cached offset in the same frame. Sticky layout avoids side changes from minor score differences; camera, viewport, yaw and obstacles invalidate the cache. Spatial handle capture pauses follow during approach/hover/drag, with entry/exit hysteresis; moving away resumes. Preview gestures edit no graph/history; an outside click commits the full pose in one Undo. Right click/Escape cancels. Rotation-aware breadboard docking/anti-overlap and axis constraints remain; selected models retain all five handles and existing behavior. |
| Workspace Object Snap | Status-bar checkbox aligns placement/movement to 0.5-unit spacing, docks breadboards during free movement and rounds gizmo rotation to 90° for mechanical models or 15° for other models. Off allows fine movement/continuous rotation. No electrical nets arise from geometry. |
| Component Info | Contextual panel for selected models or placement drafts, with shared artwork/thumbnail, catalog-driven property forms, Add and Delete. Physical parts expose Pinout/Show pins and explicit Rebuild component geometry preview/apply/cancel. Label has its own text form. Add creates an independent draft; a flexible assembly needs two valid holes. Closing restores canvas focus. |
| Inspector | Edit graph properties and execution target; configure typed pre-run capture/clock/test vectors. Create receives an immutable configuration snapshot. Unsupported trigger intent fails explicitly. |
| Hex Editor | Select generic MEMORY; edit initial bytes, load/save image JSON, Apply and Undo/Redo. Memory v1.0: 8-bit words, 1–256 bytes; new instance explicitly starts with 32 zero bytes. |
| Scope / Probe tools | Scope has no confirmed analog acquisition producer and keeps acquisition keys disabled. Signal Monitor displays actual digital NCAP observations, including 0/1/X values and timestamps; its Run/Pause uses the owned execution lifecycle. |
| Power Supply / Function Generator launchers | Preserve tool/selection/pending wire. Supply edits selected source graph properties. Generator shows declared channels and requested settings; live Apply requires an owned running/leased context and server-allocated supported channel. Default production generator capability is zero. |
| Status bar / execution | The status bar holds messages and view/snap tools; the Run ribbon holds execution controls/status. Run snapshots graph/configuration once and cancels stale preflight intent; Stop can cancel a pending Create safely. History selection remains independent. |

Canvas keyboard: R rotates, Delete/Backspace removes selection, arrow keys move by snap step (0.1 with snap off). Escape cancels placement, wiring and move preview even when focus is on ribbon/DOM ports; floating-window Escape still closes the window. Ctrl/Meta+N/O/S/Z, Shift+Z/Y work outside form fields. Instrument/Inspector/Hex Editor headers support arrow movement and focus restoration; Component Info is anchored at the upper right.

Save explicitly to acknowledge a server revision; recovery checkpoints protect bounded local drafts separately. A late acknowledgement for revision N never marks a newer local edit saved. Geometry, overlap and snap never create electrical connectivity. Breadboard contacts have an explicit editor topology; component attachments require graph connections. API structural validation does not imply electrical approval or execution support.

Placement rotation follows one shared policy for cursor preview, immediate click and drag/drop. Breadboards with mechanical profiles start at world yaw 0° independently of the camera; other known models retain camera-facing initial yaw. Once a draft exists, explicit rotation survives cursor follow and camera navigation. Placement commits the complete world pose in one Undo step. See [placement rotation verification](https://github.com/net-Circuit-Remote/net-Circuit-Remote/blob/745077403f233790bdb6781c36d6502feca01642/docs/verification/2026-10-15-placement-world-policy.md).

Navigation correction: see [algorithm/source analysis](https://github.com/net-Circuit-Remote/net-Circuit-Remote/blob/745077403f233790bdb6781c36d6502feca01642/docs/SOURCE_ANALYSIS_WORKSPACE_NAVIGATION.md) and [current Move-only browser evidence](https://github.com/net-Circuit-Remote/net-Circuit-Remote/blob/745077403f233790bdb6781c36d6502feca01642/docs/verification/2026-10-09-move-tool-browser.md). With Move selected, model dragging uses a horizontal plane through the picked surface, so a visible model remains draggable near a low camera. Its stored Y elevation, rotation and named connections stay intact. Pan changes camera/target only, retains selection/pending wire while dragging and records no circuit history; a blank click clears selection. During left gestures, other camera input is locked until release/cancel. Escape, tool/graph changes, hidden tabs and context loss cancel model previews.

## Instrument windows

Power Supply600×510 reads selected POWER_SUPPLY graph properties: voltage_v/current_limit_a/power_on. Setpoint changes use document validation and Undo/Redo. No supply selected disables controls; displayed V/A are requested setpoints and W stays unknown.

Generator760×530 renders the declared channel count, independent requested CH1/CH2 settings, units and acknowledged command snapshots. The frozen configuration format supports channels 1/2; additional declared channels are explicitly disabled. Duty cycle remains local-only. Optional profile limits are enforced without inventing ratings. Live Apply requires this tab's acknowledged Run, a current owned RUNNING execution/lease and a fresh sanitized allocation response. ACCEPTED means output is unconfirmed; APPLIED requires an explicit driver acknowledgement. Lost/unknown acknowledgement retains the original operation key and blocks another Apply across disconnect/reconnect until read-only reconciliation or actual context teardown. It never resends output intent. Default production Scope/Generator channels remain zero.

Inspector holds typed pre-run capture, virtual-digital clock and test-vector drafts. Generator inclusion is explicit. Trigger drafts are local-only because current adapters expose no confirmed trigger producer; requesting one fails before Create. Invalid numeric text is retained as per-field input metadata and blocks Run/Apply until corrected, including after window remount. Drafts and invalid text clear on principal changes. All submitted values are validated, cloned and frozen; editing requested settings does not claim an output change.

Signal Monitor loads owner-authorized digital NCAP v1 bytes from the HTTP data plane and preserves observed sample ordering, timestamps and 0/1/X values. Scope keeps analog acquisition unavailable. Its reusable analog view accepts explicitly decoded NCAP v2 evidence, preserves raw typed arrays and displays calibrated min/max envelopes with units, integrity, quality/loss/clipping and an explicit relative/Unix/device clock identity. Synthetic fixtures are labelled as such. The v2 loader requires an injected payload source; no runtime analog producer or fallback samples are created. Floating-window bounds and canvas ownership remain shared with the existing workbench.

## Models and contracts

The canonical editor catalog combines retained functional/visual types (including Label) and current physical descriptors. `device-library/editor/components.json` and `device-library/parts/physical-parts.json` generate `src/data/editorCatalog.json` and `src/data/editorParts.json`; `Contracts repository catalog generation checks` reports their current counts. Normal palette choices include generic components, exact logic parts, switches, displays, breadboards and bench visuals. Placement support is separate from available simulation/hardware models. See [physical registry](https://github.com/TINIHI-Labs/net-Circuit-Contracts/blob/1f4388252a0711eae0a167b95964372453e811d2/device-library/parts/README.md) and [component placement](https://github.com/net-Circuit-Remote/net-Circuit-Remote/blob/745077403f233790bdb6781c36d6502feca01642/docs/COMPONENT_PLACEMENT.md).

**Function Generator 2 CH:** Instruments places the reference-based L1571979 silver model with a charcoal front. Its left screen contains yellow CH1 sine/cyan CH2 square previews and five parameters per channel. Six illuminated screen keys, a 3×3 function keypad, centered encoder/LED arc, arrow keys, three colored BNCs, round power key and inclined bail complete the front. The screen, controls, connectors and stand are separate named objects. Move/Rotate/gizmo/Undo-Redo use the existing lifecycle. The 3D display artwork is illustrative and has no electrical/control ports. Live UI output requires an implemented station profile and driver; default generator capability is zero. See the [GLB](public/models/function-generator-2ch/function-generator-2ch.glb) and [model/export contract](public/models/function-generator-2ch/README.md). `npm run export:generator` regenerates GLB/glTF/bin/PNG/SVG; `/function-generator-preview.html` verifies the actual GLB and CanvasTexture replacement.

**Oscilloscope 2 CH:** Instruments places a silver industrial bench model with a charcoal front, a wide independent waveform screen, seven centered knob pivots and two inclined front stands. Horizontal includes Time/Div, Position and Auto Set/Run-Stop/Single/Default; Trigger includes Level and Mode/Source/Slope/Menu; each Vertical channel has Volts/Div and Position. A separate power button/LED and three aligned BNCs (CH1, CH2, Trig Out) complete the front. It uses the same scene/graph/gizmo lifecycle as other components. Waveforms are illustrative; acquisition/control behavior is not connected. Self-contained [GLB](public/models/oscilloscope-2ch/oscilloscope-2ch.glb), [glTF](public/models/oscilloscope-2ch/oscilloscope-2ch.gltf) and [coordinate/export contract](public/models/oscilloscope-2ch/README.md) are committed. `/oscilloscope-preview.html` loads that GLB for front/angled comparison and CanvasTexture verification. The Scope tool opens the acquisition GUI described above.

Breadboard housing has a beveled footprint, recessed terminal/rail channels and real socket cavities with tapered entrances, walls and dark floors. Deck/decal perforations share coordinates with the 830/630/100 instances. Common mating keys have clearance; bevels stay within catalog docking bounds. Selection uses a **2 CSS px Medium Gold (#d4af37)** contour without tinting the body; curved silhouettes update with the camera. The adaptive technical grid has dark minor lines, major lines every five cells, distance fade and zoom-based minor suppression. Canvas caption is removed. Details: [current source analysis](https://github.com/net-Circuit-Remote/net-Circuit-Remote/blob/745077403f233790bdb6781c36d6502feca01642/docs/SOURCE_ANALYSIS_TECHNICAL_WORKBENCH.md), [browser report](https://github.com/net-Circuit-Remote/net-Circuit-Remote/blob/745077403f233790bdb6781c36d6502feca01642/docs/verification/2026-10-09-technical-workbench-browser.md). Earlier selection reports are historical.

Breadboard 830/630/100 keep no logical ports; they expose stable contact endpoints through the declared editor topology. A–E and F–J share one node per column; each power rail is continuous. The 100 model is a dual 50-hole bus strip. Board, power-supply, Oscilloscope and Function Generator visuals have no electrical ports. 74HC08 ports A1/B1/Y1 through A4/B4/Y4 represent functional gates, not package pin numbers. Generic arithmetic uses explicit 8-bit operands, without unconfirmed part numbers. Memory's local byte contract is separate from SDRAM hardware or capture. Passive/clock defaults are model configuration, not device ratings. Outputs display their housing without fabricated signal readings.

Wire interaction: choose one of ten round jumper colors, left-click the first hole/port, right-click for each corner, then left-click the final endpoint. Repeat right-click at the same snapped position or before moving 4 px to undo that provisional corner while keeping the draft. Esc cancels; Backspace/Delete removes the last corner; Alt bypasses snap. New wires default to Free for direct diagonal/custom polylines; Orthogonal constrains spans to X/Z; Auto keeps board convenience routing. Routing snap on a board uses quarter-pitch lanes; endpoints remain exact contacts. Right orbit pauses only during a draft. Selected wires expose screen-sized user handles and a thin segment line. Dragging a bare span seeds two anchors once; subsequent endpoint-adjacent drags reuse its user boundary around the fixed pin. Each completed gesture creates one command. Sixteen-sided opaque insulation keeps a constant diameter, with circular fillets or safe rounded capsule joints for tight/sub-Float32 corners. Real narrower silver tinned-copper pins extend below contacts and overlap sealed insulation; the moving preview pin remains visible. Color-only updates reuse geometry.

Parallel and same-route wires form centered lateral bundles, spaced by their adjacent radii plus a 5% diameter gap. They keep a low common base instead of forming a vertical tower. True crossings use short local bridges with bounded smooth ramps and return to the original height. Breadboard insulation descends to a fixed collar; short silver-plated conductors remain equally exposed and deeply inserted at every priority. `wireVisual.layer` v1 is an order priority: Down/Up/Top changes lane order or crossing over/under in one Undo command, preserving other wires' relative order. Select next overlapping wire cycles through the conflict group. Picking follows displayed lanes/bridges, while edits map back to semantic coordinates; derived offsets and samples are never saved as anchors. Legacy metadata and explicit user anchor heights are retained. See [compact wire routing verification](https://github.com/net-Circuit-Remote/net-Circuit-Remote/blob/745077403f233790bdb6781c36d6502feca01642/docs/verification/2026-10-15-compact-wire-routing.md); the earlier [global stacking report](https://github.com/net-Circuit-Remote/net-Circuit-Remote/blob/745077403f233790bdb6781c36d6502feca01642/docs/verification/2026-10-15-wire-visual-stacking.md) is historical.

Select navigation: left-drag a model or empty surface to pan XZ; below four pixels, release selects the model. Grab uses the surface elevation and translates camera and target together. Zoom controls and wheel share 50–1000%; inward dolly stops before model surfaces. Fit/Area establish a new 100% reference. See [workbench UX verification](https://github.com/net-Circuit-Remote/net-Circuit-Remote/blob/745077403f233790bdb6781c36d6502feca01642/docs/verification/2026-10-14-workbench-ux.md).

Wire data keeps CircuitGraph 1.0 source/destination strings. `BB.contact:terminal:A:01` resolves a declared contact; `metadata.wireVisual` v1 holds color, mode, thickness and world/module-local user anchors. Solver-generated elbows and copper terminals are renderer data only. Legacy defaults remain Auto; loading v1 retains existing saved anchors. Moving/rotating a board transforms its local bends and contact anchors; visual edits never replace endpoints. Virtual digital compilation unions intrinsic board nodes, explicit jumpers and supported component terminals. Physical routes still require observed station evidence/resources; editor contacts are not FPGA GPIO. See the [wire refactor verification](https://github.com/net-Circuit-Remote/net-Circuit-Remote/blob/745077403f233790bdb6781c36d6502feca01642/docs/verification/2026-10-14-wire-path-refactor.md) and [original CRUMB wire source analysis](https://github.com/net-Circuit-Remote/net-Circuit-Remote/blob/745077403f233790bdb6781c36d6502feca01642/docs/SOURCE_ANALYSIS_CRUMB_WIRE_TOOL.md).

Unknown imported types/properties/port names are retained and exposed via Inspector; unknown geometry uses a fallback model and unknown anchors are not invented. Active components and dual/quad physical display descriptors are placeable with explicit unsupported model status where appropriate. Notation includes Label; reserved entries such as Probe annotation still report unavailable.

## Ownership and lifecycle

Server project routes keep Save, Save As and Export unavailable through authentication, project selection and document hydration. A rendered initial local scene does not establish that the requested server document is ready. See [server route hydration verification](migration/server-route-hydration.md).

```text
App.vue -> SingleWorkspaceShell
  AppTitleBar / WorkbenchRibbon (ComponentRibbon or RunRibbonPanel)
  ToolRail / CircuitWorkspace3D / shared floating windows
  useCircuitEditor -> circuit command/history store
  SceneManager -> ComponentModel + logical wire geometry + picking + OrbitControls
```

The document core in `domain/document` owns commands, history, serialization and revisions as pure functions operating on the existing caller-owned state. The circuit Pinia facade keeps component actions and remote validation/presentation adapters. Per-draft content watchers preserve legacy direct-edit invalidation; getters use revisions instead of serializing graphs during rendering. There is one mutable graph authority. Auth, projects, workspace, station, experiment, instrument and UI state keep their own lifetimes. Experiment/instrument effects are joined by an explicit application controller using per-instance ports; neither store imports the other.

Generated core validator entrypoints cover synchronous local document, property and requested-configuration edits. API and realtime adapters prepare the remaining offline profiles at their workflow boundary; pointer moves do not fetch or compile schemas. The AST gate covers every domain/application controller and permits only the pure `lossless-json` external package in that dependency closure. Framework and I/O adapters remain outside it. The production-main bundle regression checks eager imports through actual Vue components, including property validators, rather than inspecting only the registry facade.

Scene resources stay outside Pinia. Render requests coalesce into RAF when graph/camera/gesture changes. Zero-sized/hidden/context-lost scenes pause; resize/context restore redraw. Unmount disposes observers/listeners/controls/frames/GPU geometry/material/texture/instance buffers. Floating-window layout/focus still uses the shared manager. Scene picking and pointer gesture ownership have separate tested modules. The two existing GLB preview pages consume the bounded asset provider, revision manifest and procedural fallback; the main workspace keeps its established procedural visuals. See [W5 asset provenance and lifecycle](https://github.com/net-Circuit-Remote/net-Circuit-Remote/blob/745077403f233790bdb6781c36d6502feca01642/docs/verification/2026-10-16-w5-assets.md).

Panel collapse/reopen commits width/height once and reveals content through opacity only. Shared size observers consume contentRect, coalesce latest dimensions per frame and skip duplicates before editor cancellation, projection/store/window updates. SceneManager retains unchanged drawing buffers and allocates changed buffers in their redraw frame. Cached gizmo obstacles refresh before rendering after layout/window/selected-component content changes; camera-only rendering avoids DOM scans. The 44-component/20-wire browser probe reduces individual toggle buffer allocations from11–15 to1. Evidence and changed files: `../../docs/verification/2026-10-11-panel-resize-performance.md`.

The historical 2026-10-10 stability audit covered the then-current 50–200% dolly. Current wheel/toolbar zoom uses `src/three/ViewportNavigation.ts` and `src/config/workbenchViewport.ts`: nominal 50–1000% with a geometry-dependent inward collision limit, synchronized reported bounds and explicit Fit/Home/Area calibration. Captured orbit is disabled at zero viewport size; near-horizon pan and non-finite inputs are guarded. Wires reconcile by endpoint pair and only incident edges update on a preview. Supply setting commits retain their assembly/display texture. Shared resources dispose once, labels own their geometry and pending logos cannot retain deleted models.

Combined Undo/Redo snapshots are limited to 20 MB/50 entries, retaining one immediate oversized snapshot. Cancellation and station/file/module revisions prevent stale completions; obsolete graph validation aborts. Earlier test counts in historical reports describe those dated snapshots; current release verification uses the commands and CI gates above. Algorithm details and test boundaries: [stability audit](https://github.com/net-Circuit-Remote/net-Circuit-Remote/blob/745077403f233790bdb6781c36d6502feca01642/docs/SOURCE_ANALYSIS_STABILITY_AUDIT.md), [browser evidence](https://github.com/net-Circuit-Remote/net-Circuit-Remote/blob/745077403f233790bdb6781c36d6502feca01642/docs/verification/2026-10-10-stability-audit-browser.md).

## Metadata and supplied icons

Original artwork stays in `assets/icon .svg`. Frontend uses small committed SVG/WebP derivatives with source SHA-256/size provenance in `src/assets/icons/manifest.json`; no original PNG payload is bundled. Action glyphs remain local stroke SVGs. The original derivative manifest covers 22 icons; the authored `oscilloscope_2ch.svg` and `function_generator_2ch.svg` previews are generated by their model export scripts and retained by the supplied-icon refresh script.

Original icon inputs are frozen provenance snapshots under `assets/icon .svg/`, with Remote ownership recorded in the source manifests. Delivered derivatives are preserved, not regenerated during migration. Canonical device metadata/catalog changes are released from Contracts; update the reviewed artifact pins and rerun consumer parity tests here. The historical monorepo Python regeneration commands are not Interface entrypoints.

Commit generated files. Normal npm builds need no Python/Pillow. Frontend tests compare canonical metadata snapshots and icon provenance. Artwork alone establishes no electrical pinout.

Typed API/WebSocket layers use generated contracts and runtime parsing. API requests use the shared authenticated client; imported assets use their separate bounded, integrity-checked adapter. Virtual digital execution and the HTTP NCAP data plane use the actual Hardware Service/simulator. Physical-offline selection never silently becomes simulation; current real Scope/Generator production capability remains unavailable. The AST dependency gate checks transitive imports, runtime store cycles, pure-core isolation and browser/renderer transport boundaries. Hosted CI runs after push; no hosted run is claimed for local changes. Three.js still produces Vite's existing large-chunk advisory.

## Committed release artifact export

After committing the reviewed source, run `python -B scripts/build_release.py --output-directory ABSOLUTE_OWNED_SESSION/interface-release`. Keep the reviewed `NETCIRCUIT_CONTRACTS_ARTIFACT_MANIFEST` or immutable artifact URL configuration available to its child processes. The standard-library builder requires a clean Git checkout, obtains bytes from the exact committed revision with checkout newline conversion disabled, and creates a fresh source export through the canonical Node DEV allocator. In that export it runs the committed SDK bootstrap, adopts the owned environment, runs locked `npm ci --no-audit --no-fund`, then `npm run build`. A previous CI/checkout build is not a release input; caller `dist` and arbitrary `--static-root` folders cannot establish static provenance.

Only the newly built export's three production pages and other regular static files enter the static archive. The builder rejects source/static aliases and existing output archives. It emits deterministic source/static archives, embedded exact revision/version/compatibility metadata, and an external `artifacts.json` with SHA256. Build staging and child logs remain in the owning external session for inspection and guarded cleanup. Python does not enter the browser runtime or Node dependency closure. Standalone script tests use `NETCIRCUIT_RELEASE_PYTHON` when an explicit interpreter is required. See the [build provenance verification](migration/interface-build-provenance.md).
