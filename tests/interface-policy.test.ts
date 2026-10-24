import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {dirname,resolve,relative} from 'node:path'
import {fileURLToPath} from 'node:url'
import catalog from '@tinihi-labs/contracts/data/editorCatalog.json' with {type:'json'}
import physical from '@tinihi-labs/contracts/data/physicalParts.json' with {type:'json'}
import lean from '@tinihi-labs/contracts/data/editorParts.json' with {type:'json'}
import {readContractsResource,type ContractsResourceName} from '../scripts/contracts-resources.mjs'

// These assertions preserve the consumer-facing checks previously run by
// Remote tests/frontend. Generator mutation assertions remain with their
// existing owner; Interface consumes the released data and never generates it.
type Bag=Record<string,any>
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const text=(path:string)=>readFileSync(resolve(root,path),'utf8')
const json=(path:string):any=>JSON.parse(text(path))
const original=(name:ContractsResourceName):Bag=>readContractsResource(name) as Bag
const parts=(physical as Bag).parts as Bag[]
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex')

test('complete workbench shell, window ownership and explicit transport boundaries survive extraction',()=>{
  const required=['src/main.ts','src/App.vue','src/style.css','src/router/routes.ts','src/three/SceneManager.ts',
    'src/services/files/circuitFile.ts',...['circuit','workspace','station','experiment','instrument','ui'].map(name=>`src/stores/${name}.ts`),
    ...['SingleWorkspaceShell','AppTitleBar','ComponentRibbon','ToolRail','CircuitWorkspace3D','SimulationStatusBar'].map(name=>`src/components/workbench/${name}.vue`),
    ...['FloatingWindow','FloatingWindowManager','OscilloscopeWindow','GeneratorWindow','SignalMonitorWindow','ComponentInfoWindow','InspectorWindow','HexEditorWindow'].map(name=>`src/components/windows/${name}.vue`)]
  for(const path of required)assert.ok(text(path).length,path)
  assert.match(text('src/App.vue'),/SingleWorkspaceShell/)
  assert.doesNotMatch(text('src/App.vue'),/RouterLink|RouterView/)
  assert.match(text('src/components/workbench/AppTitleBar.vue'),/net\*CIRCUIT Remote/)
  assert.match(text('src/components/HardwareStatus.vue'),/Simulation/)
  assert.match(text('src/stores/station.ts'),/mode: 'simulation'/)
  const callers:string[]=[]
  function walk(directory:string){
    for(const entry of readdirSync(directory,{withFileTypes:true})){
      const path=resolve(directory,entry.name)
      if(entry.isDirectory())walk(path)
      else if(/\.(ts|vue)$/.test(entry.name)){
        const source=readFileSync(path,'utf8')
        assert.doesNotMatch(source.toLowerCase(),/\/dev\/spidev|fpga_register|register_map|raw_mux|mux_address/,path)
        if(/\bfetch\b/.test(source))callers.push(relative(root,path).replaceAll('\\','/'))
      }
    }
  }
  walk(resolve(root,'src'))
  assert.deepEqual(callers.sort(),['src/services/api/client.ts','src/services/assets/gltfAssets.ts'])
})

test('delivered icon bytes and their frozen original artwork retain provenance',()=>{
  const manifest=json('src/assets/icons/manifest.json') as Bag[]
  assert.equal(new Set(manifest.map(item=>item.file)).size,manifest.length)
  const delivered=readdirSync(resolve(root,'src/assets/icons')).filter(name=>name.endsWith('.svg')).sort()
  assert.deepEqual(manifest.map(item=>item.file).sort(),delivered)
  let total=0
  for(const entry of manifest){
    const bytes=readFileSync(resolve(root,'src/assets/icons',entry.file))
    assert.match(bytes.toString('utf8').trimStart(),/^<svg/)
    assert.equal(bytes.length,entry.output_bytes,entry.file)
    total+=bytes.length
    assert.equal(sha(readFileSync(resolve(root,entry.source))),entry.sha256,entry.source)
  }
  assert.ok(total<256_000)
})

test('legacy product metadata agrees with independently versioned canonical resources',()=>{
  const metadata=json('src/data/deviceMetadata.json')
  for(const key of ['legacy-hc08-metadata','breadboard-metadata'] as const){
    const device=original(key)
    assert.deepEqual(metadata[device.id],device)
  }
})

test('released catalog preserves legacy logical ports and exact physical projection',()=>{
  const canonical=original('canonical-editor-catalog')
  const components=(catalog as Bag).components as Bag[]
  assert.deepEqual(components.slice(0,canonical.components.length),canonical.components)
  assert.deepEqual(physical,original('canonical-physical-parts'))
  assert.equal(new Set(components.map(item=>item.type)).size,components.length)
  for(const item of components){
    assert.equal(new Set(item.ports.map((port:Bag)=>port.id)).size,item.ports.length,item.type)
    for(const port of item.ports){assert.ok(!port.id.includes('.'));assert.ok(['input','output','inout'].includes(port.direction))}
    if(item.visualOnly)assert.equal(item.ports.length,0)
    if(item.family==='arithmetic')assert.equal(item.partNumber,undefined)
  }
  const logical=components.find(item=>item.type==='74HC08')!
  assert.equal(logical.ports.length,12)
  assert.ok(logical.ports.every((port:Bag)=>!('pin' in port)))
  assert.equal(components.find(item=>item.type==='BREADBOARD_100')!.name,'Power Breadboard')
  assert.equal(components.find(item=>item.type==='POWER_SUPPLY')!.name,'Power Supply')
  const hc08=components.find(item=>item.type==='SN74HC08N')!
  assert.deepEqual(hc08.ports.map((pin:Bag)=>pin.id),Array.from({length:14},(_,i)=>String(i+1)))
  assert.deepEqual(hc08.ports[6],{id:'7',direction:'inout',domain:'GROUND'})
  assert.equal(hc08.mode,'physical')
  assert.equal((lean as Bag).parts.length,parts.length)
  for(const part of (lean as Bag).parts){
    for(const key of ['simulation','manufacturer','partNumber','datasheet','provenance'])assert.ok(!(key in part),key)
    assert.ok(part.package.pins.length)
  }
})

test('all requested logic pinouts and independent manufacturer semantics stay available',()=>{
  const fixtures=original('logic-pinouts')
  const wanted='7400 7401 7402 7403 7404 7405 7408 7409 7410 7411 7412 7413 7414 7415 7420 7421 7427 7430 7432 7437 7438 7440 7486 74136 74266 CD4001 CD4011 CD4012 CD4013 CD4030 CD4069 CD4070 CD4071 CD4072 CD4077 CD4081 CD4093'.split(' ')
  assert.deepEqual(Object.keys(fixtures),wanted)
  const byCode=new Map(parts.filter(part=>part.logic).map(part=>[part.logic.code,part]))
  for(const code of wanted){
    const expected=fixtures[code],part=byCode.get(code)!,pins=part.package.pins as Bag[]
    assert.equal(part.editorType,expected.editorType,code)
    assert.equal(part.logic.family,expected.family,code)
    assert.deepEqual(pins.map(pin=>pin.name),expected.pins,code)
    assert.deepEqual(pins.map(pin=>pin.number),Array.from({length:14},(_,i)=>String(i+1)),code)
    assert.deepEqual(Object.fromEntries(pins.filter(pin=>pin.role==='output').map(pin=>[pin.number,pin.outputType])),expected.outputs,code)
    assert.deepEqual(pins.filter(pin=>pin.role==='nc').map(pin=>pin.number),expected.nc,code)
    assert.equal(pins[6].role,'ground');assert.equal(pins[13].role,'power')
    for(const pin of pins)if(!['7','14',...Object.keys(expected.outputs),...expected.nc].includes(pin.number))assert.equal(pin.role,'input',code)
    assert.equal(part.package.footprint.mountable,true)
    assert.match(part.provenance.sources[0].url,/^https:\/\//)
    assert.equal(part.provenance.pinoutView,'top');assert.ok(part.aliases.includes(code))
  }
  const ff=byCode.get('CD4013')!,pins=new Map<string,Bag>(ff.package.pins.map((pin:Bag)=>[pin.number,pin]))
  for(const pin of ['3','11']){assert.equal(pins.get(pin)!.signal,'clock');assert.equal(pins.get(pin)!.edge,'rising')}
  for(const pin of ['4','10']){assert.equal(pins.get(pin)!.signal,'reset');assert.equal(pins.get(pin)!.polarity,'active-high')}
  for(const pin of ['6','8']){assert.equal(pins.get(pin)!.signal,'set');assert.equal(pins.get(pin)!.polarity,'active-high')}
  for(const pin of ['2','12'])assert.equal(pins.get(pin)!.polarity,'active-low')
  for(const code of ['7413','7414','CD4093']){
    const inputs=byCode.get(code)!.package.pins.filter((pin:Bag)=>pin.role==='input')
    assert.ok(inputs.length);assert.ok(inputs.every((pin:Bag)=>pin.inputCharacteristics==='schmitt-trigger'))
  }
})
