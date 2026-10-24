import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {spawnSync} from 'node:child_process'
import {getArtifactDirectory} from '@tinihi-labs/artifact-paths'
import {loadNodeRuntime} from './build-node-runtime.mjs'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
for(const kind of ['contacts','sealed','labels','flexible'])test(`native ${kind} helper executes catalog and geometry outside the installed product`,async()=>{
  const directory=mkdtempSync(resolve(getArtifactDirectory('native-node-runtime-regression'),kind+'-'))
  const filename=resolve(directory,'runtime.mjs')
  // This is the same builder and entrypoint used by the browser scenario.
  await loadNodeRuntime(kind,filename,{resolveDir:root})
  const probe=`
    import assert from 'node:assert/strict'
    import * as api from ${JSON.stringify(pathToFileURL(filename).href)}
    const board={id:'BB',type:'BREADBOARD',position:{x:0,y:0,z:0}}
    if(api.getPartForType){
      const part=api.getPartForType('GENERIC_RESISTOR')
      assert.equal(part.revision,7)
      assert.equal(api.physicalDescriptorForPart(part).partId,part.id)
    }
    if(api.solveMounting){
      const solution=api.solveMounting('SLIDE_SWITCH_SS12D10',{x:-2.8,y:.309,z:0},0,[board],'SLIDE')
      assert.equal(solution?.valid,true,solution?.reason)
      assert.equal(solution.mount.kind,'breadboard')
    }
    if(api.solveFlexibleMount){
      const solution=api.solveFlexibleMount('GENERIC_RESISTOR','BB','terminal:C:10','terminal:C:11',[board])
      assert.equal(solution.valid,true,solution.reason)
      assert.equal(solution.mount.kind,'breadboard-flexible')
      assert.equal(solution.mount.version,2)
    }
    if(api.boardContactMechanics){
      const contact=api.boardContactMechanics('BREADBOARD','terminal:A:04')
      assert.ok(contact.tip.y<contact.surface.y)
      assert.ok(contact.floor.y<contact.tip.y)
      assert.equal(api.WIRE_RADIAL_SEGMENTS,16)
      assert.equal(api.defaultWireVisual().version,1)
    }
  `
  const environment={...process.env};delete environment.NODE_PATH
  const result=spawnSync(process.execPath,['--input-type=module','--eval',probe],{cwd:directory,env:environment,encoding:'utf8',windowsHide:true})
  assert.equal(result.status,0,result.stdout+result.stderr)
  assert.equal(result.stderr,'')
})

test('historical and current benchmark runtimes preserve real search and cold/warm thumbnail counts outside the product',()=>{
  const directory=mkdtempSync(resolve(getArtifactDirectory('native-node-runtime-regression'),'benchmark-'))
  const result=spawnSync(process.execPath,[resolve(root,'scripts/benchmark-component-palette.mjs'),'--verify-runtime'],{cwd:directory,env:process.env,encoding:'utf8',windowsHide:true,timeout:90_000})
  assert.equal(result.status,0,result.stdout+result.stderr)
  const report=JSON.parse(result.stdout)
  assert.equal(report.kind,'runtime-conformance')
  assert.equal(report.logicCount,40)
  assert.equal(report.implementations.length,2)
  for(const implementation of report.implementations){
    assert.ok(implementation.searchMatches>0)
    assert.deepEqual(implementation.cold,{requested:2,captures:2,rendererAttempts:1,rendererDisposals:1,revisit:{requested:2,additionalCaptures:0,additionalRendererAttempts:0}})
    assert.equal(implementation.reopen.captures,2)
    assert.equal(implementation.reopen.rendererAttempts,implementation.label==='baseline'?2:1)
  }
})
