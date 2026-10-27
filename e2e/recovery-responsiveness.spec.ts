import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { loadNodeRuntime } from '../scripts/build-node-runtime.mjs'
import { getArtifactDirectory } from '../scripts/artifact-paths.mjs'
import type * as Catalog from '../src/data/partCatalog'
import type { solveMounting } from '../src/electrical/mounting'
import type { CircuitGraph, CircuitModule } from '../src/types/circuit'
import type { RecoveryInput } from '../src/application/projects/recovery'
import { nativeSceneEvidence, observeNativeScene, sceneReady } from './native-scene'

type Runtime = typeof Catalog & { solveMounting: typeof solveMounting }
interface RecoveryProbe { settled: boolean; error: string; inspectedGraphs: number; elapsedMs?: number; preserved?: CircuitGraph }

test('an impossible recovery batch preserves stored graphs and leaves the native workspace responsive', async ({ page }) => {
  test.setTimeout(120_000)
  const api = await loadNodeRuntime('contacts', resolve(getArtifactDirectory('recovery-responsiveness'), 'runtime.mjs')) as Runtime
  const boards: CircuitModule[] = [{ id: 'BB1', type: 'BREADBOARD', position: { x: 0, y: 0, z: 0 } }, { id: 'BB2', type: 'BREADBOARD', position: { x: 0, y: 0, z: 3.5 } }]
  const modules = [...boards]
  for (const [id, type, board, x] of [
    ['SLIDE', 'SLIDE_SWITCH_SS12D10', 0, -2.8], ['TACTILE', 'PUSH_BUTTON_B3F1000', 0, -1.1],
    ['DIP', 'DIP_SWITCH_A6D4100', 0, .4], ['SINGLE', 'SEGMENT_SC5611EWA', 0, 2.5],
    ['DOUBLE', 'SEGMENT_DC5611EWA', 1, -2.5], ['QUAD', 'SEGMENT_CC5612EWA', 1, .3], ['BUZZER', 'BUZZER_PS1240', 1, 3],
  ] as const) {
    const part = api.getPartForType(type)!, mounted = api.solveMounting(type, { x, y: .309, z: boards[board]!.position!.z ?? 0 }, 0, modules, id)
    expect(mounted?.valid).toBe(true)
    modules.push({ id, type, mount: mounted!.mount, properties: { ...part.editor.defaults } })
  }
  const graph: CircuitGraph = { schema_version: '1.2', circuit_id: 'recovery-responsive', modules, connections: [] }
  await observeNativeScene(page); await page.goto('/'); await sceneReady(page)
  const before = (await nativeSceneEvidence(page)).frames
  // Exercise the real browser repository and IndexedDB with native mounted
  // geometry. The isolated database avoids changing the app's recovery drafts.
  await page.evaluate(async ({ graph, databaseName }) => {
    const moduleUrl = '/src/services/recovery/indexedDb.ts'
    const { createIndexedDbRecoveryRepository } = await import(moduleUrl) as typeof import('../src/services/recovery/indexedDb')
    const repository = createIndexedDbRecoveryRepository({ databaseName })
    const original: RecoveryInput = { draftId: 'original', name: 'Preserved circuit', revision: 1, graph }
    await repository.save('recovery-owner', [original])
    const probe: RecoveryProbe = { settled: false, error: '', inspectedGraphs: 0 }
    Object.assign(window, { recoveryResponsiveness: probe })
    setTimeout(() => {
      const started = performance.now()
      // Observe access to real graph payloads without replacing parsing,
      // validation, IndexedDB or geometry with a test double.
      const oversized = Array.from({ length: 128 }, (_, index) => ({ draftId: `over-limit-${index}`, name: original.name, revision: original.revision,
        get graph() { probe.inspectedGraphs++; return graph } }))
      void repository.save('recovery-owner', oversized)
        .then(() => { probe.error = 'Unexpected oversized recovery success' }, error => { probe.error = String(error) })
        .then(async () => { probe.elapsedMs = performance.now() - started; probe.preserved = (await repository.load('recovery-owner', 'original'))?.graph; probe.settled = true })
    }, 0)
  }, { graph, databaseName: `recovery-responsive-${test.info().testId}` })
  await expect.poll(() => page.evaluate(() => (window as unknown as { recoveryResponsiveness: RecoveryProbe }).recoveryResponsiveness.settled)).toBe(true)
  const result = await page.evaluate(() => (window as unknown as { recoveryResponsiveness: RecoveryProbe }).recoveryResponsiveness)
  await test.info().attach('recovery-batch-response', { body: Buffer.from(JSON.stringify(result)), contentType: 'application/json' })
  expect(result.inspectedGraphs).toBe(0)
  expect(result.error).toContain('storage limit')
  expect(result.preserved).toEqual(JSON.parse(JSON.stringify(graph)))
  await page.getByRole('button', { name: 'View TOP', exact: true }).press('Enter')
  await expect.poll(async () => (await nativeSceneEvidence(page)).frames).toBeGreaterThan(before)
})
