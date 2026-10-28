import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {nextTick} from 'vue'
import {useCircuitStore} from '../src/stores/circuit'
import {useWorkspaceStore} from '../src/stores/workspace'
import {useStationStore} from '../src/stores/station'
import {useUiStore} from '../src/stores/ui'
import {useInstrumentStore} from '../src/stores/instrument'
import {loadSfc,mountSfc,dispatch,type HostNode} from './helpers/vueSfc'

function type(node:HostNode,value:string){
 node.props.value=value
 if(typeof node.props.onInput==='function')dispatch(node,'onInput',value)
}
function labeled(view:ReturnType<typeof mountSfc>,text:string){
 const label=view.all().find(node=>node.tag==='label'&&(node.text+node.children.filter(child=>child.tag==='#text').map(child=>child.text).join('')).trim()===text)
 assert.ok(label,'Missing real Inspector label: '+text)
 const input=label.children.find(node=>node.tag==='input');assert.ok(input)
 return input
}

test('Inspector coordinate text survives unrelated renders and creates one move Undo entry on change',async()=>{
 const pinia=createPinia();setActivePinia(pinia)
 const circuit=useCircuitStore(),workspace=useWorkspaceStore(),station=useStationStore(),ui=useUiStore()
 circuit.importGraph({schema_version:'1.0',circuit_id:'inspector',modules:[{id:'LED',type:'LED',position:{x:3,y:0,z:0}}],connections:[]})
 workspace.selectModule('LED')
 const view=mountSfc(await loadSfc('components/windows/InspectorWindow.vue'),pinia)
 try{
  const input=view.find('input','aria-label','Component X'),past=circuit.past.length
  assert.ok(input)
  type(input,'4');station.error='Unrelated station status';ui.connectionState='reconnecting';await nextTick()
  assert.equal(input.props.value,'4')
  assert.equal(circuit.graph?.modules[0].position?.x,3)
  assert.equal(circuit.past.length,past,'typing must not create authored history')
  dispatch(input,'onChange',input.props.value);await nextTick()
  assert.equal(circuit.graph?.modules[0].position?.x,4)
  assert.equal(circuit.past.length,past+1,'the committed move creates exactly one history entry')
  circuit.undo();await nextTick()
  assert.equal(circuit.graph?.modules[0].id,'LED')
  assert.equal(circuit.graph?.modules[0].position?.x,3)
  assert.equal(view.find('input','aria-label','Component X').props.value,'3')
  circuit.redo();await nextTick()
  assert.equal(circuit.graph?.modules[0].position?.x,4)
  assert.equal(view.find('input','aria-label','Component X').props.value,'4')
 }finally{view.app.unmount()}
})

test('Inspector rotation, numeric property and project name drafts preserve change-time history and validation',async()=>{
 const pinia=createPinia();setActivePinia(pinia)
 const circuit=useCircuitStore(),workspace=useWorkspaceStore(),station=useStationStore()
 circuit.importGraph({schema_version:'1.2',circuit_id:'properties',modules:[{id:'R',type:'GENERIC_RESISTOR',position:{x:3,y:0,z:0},rotation:0,properties:{resistanceOhms:330}}],connections:[]})
 workspace.selectModule('R')
 const view=mountSfc(await loadSfc('components/windows/InspectorWindow.vue'),pinia)
 try{
  const rotation=labeled(view,'Rotation (degrees)'),resistance=labeled(view,'Resistance'),name=labeled(view,'Project name')
  const originalName=circuit.current!.name,past=circuit.past.length
  type(rotation,'90');type(resistance,'470.5');type(name,'Typed project')
  station.error='Unrelated station status';await nextTick()
  assert.equal(rotation.props.value,'90');assert.equal(resistance.props.value,'470.5');assert.equal(name.props.value,'Typed project')
  assert.equal(circuit.graph?.modules[0].rotation,0);assert.equal(circuit.graph?.modules[0].properties?.resistanceOhms,330)
  assert.equal(circuit.current?.name,originalName);assert.equal(circuit.past.length,past)
  dispatch(rotation,'onChange',rotation.props.value);await nextTick()
  assert.equal(circuit.graph?.modules[0].rotation,90)
  assert.equal(resistance.props.value,'470.5');assert.equal(name.props.value,'Typed project')
  dispatch(resistance,'onChange',resistance.props.value);await nextTick()
  dispatch(name,'onChange',name.props.value);await nextTick()
  assert.equal(circuit.graph?.modules[0].properties?.resistanceOhms,470.5);assert.equal(circuit.current?.name,'Typed project')
  assert.equal(circuit.past.length,past+3,'one authored entry per committed field, never per keystroke')
  circuit.undo();await nextTick();assert.equal(name.props.value,originalName)
  circuit.undo();await nextTick();assert.equal(resistance.props.value,'330')
  circuit.undo();await nextTick();assert.equal(rotation.props.value,'0')
  circuit.redo();circuit.redo();circuit.redo();await nextTick()
  assert.equal(rotation.props.value,'90');assert.equal(resistance.props.value,'470.5');assert.equal(name.props.value,'Typed project')
  const beforeInvalid=circuit.past.length
  type(resistance,'-1');station.error='Another unrelated status';await nextTick();assert.equal(resistance.props.value,'-1')
  dispatch(resistance,'onChange',resistance.props.value);await nextTick()
  assert.equal(circuit.graph?.modules[0].properties?.resistanceOhms,470.5)
  assert.equal(resistance.props.value,'470.5');assert.equal(circuit.past.length,beforeInvalid)
  assert.ok(workspace.editError)
 }finally{view.app.unmount()}
})

test('Inspector pending text resets on selection, principal and document changes',async()=>{
 const pinia=createPinia();setActivePinia(pinia)
 const circuit=useCircuitStore(),workspace=useWorkspaceStore(),instrument=useInstrumentStore()
 instrument.setPrincipal('first')
 circuit.importGraph({schema_version:'1.0',circuit_id:'scope',modules:[{id:'LED',type:'LED',position:{x:3,y:0,z:0}},{id:'OTHER',type:'LED',position:{x:7,y:0,z:0}}],connections:[]})
 const originalDocument=circuit.activeId!
 workspace.selectModule('LED')
 const view=mountSfc(await loadSfc('components/windows/InspectorWindow.vue'),pinia)
 try{
  type(view.find('input','aria-label','Component X'),'99')
  workspace.selectModule('OTHER');await nextTick()
  assert.equal(view.find('input','aria-label','Component X').props.value,'7')
  type(view.find('input','aria-label','Component X'),'88');type(labeled(view,'Project name'),'Private pending name')
  instrument.setPrincipal('second');await nextTick()
  assert.equal(view.find('input','aria-label','Component X').props.value,'7')
  assert.equal(labeled(view,'Project name').props.value,circuit.current?.name)
  type(view.find('input','aria-label','Component X'),'77')
  circuit.createDraft('Other document');await nextTick()
  assert.equal(view.find('input','aria-label','Component X'),undefined)
  assert.equal(labeled(view,'Project name').props.value,'Other document')
  circuit.openDraft(originalDocument);await nextTick()
  assert.equal(view.find('input','aria-label','Component X').props.value,'7')
  assert.equal(circuit.graph?.modules[1].position?.x,7)
 }finally{view.app.unmount()}
})
