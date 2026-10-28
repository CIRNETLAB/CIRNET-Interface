import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {nextTick} from 'vue'
import {useInstrumentStore} from '../src/stores/instrument'
import {useProjectStore} from '../src/stores/projects'
import {useCircuitStore} from '../src/stores/circuit'
import {loadSfc,mountSfc,dispatch,type HostNode} from './helpers/vueSfc'

// A real input's DOM value changes before its change/blur handler commits.
// Vue's actual renderer must preserve that edit through unrelated updates.
function type(node:HostNode,value:string){
 node.props.value=value
 if(typeof node.props.onInput==='function')dispatch(node,'onInput',value)
}

test('capture signal text and a trailing separator survive a neighboring-field render until change',async()=>{
 const pinia=createPinia();setActivePinia(pinia);const instrument=useInstrumentStore()
 const view=mountSfc(await loadSfc('components/windows/InstrumentConfigurationForm.vue'),pinia)
 try{
  const input=view.find('input','aria-label','Capture signals')
  type(input,'y, ');instrument.captureMaxEvents=100;await nextTick()
  assert.equal(input.props.value,'y, ')
  assert.deepEqual(instrument.captureSignals,[],'uncommitted text is a draft')
  type(input,'y, clock.OUT');instrument.captureDurationNs=40;await nextTick()
  assert.equal(input.props.value,'y, clock.OUT')
  dispatch(input,'onChange',input.props.value);await nextTick()
  assert.deepEqual(instrument.captureSignals,['y','clock.OUT'])
 }finally{view.app.unmount()}
})

test('pending numeric text survives unrelated status rendering and retains validation on change',async()=>{
 const pinia=createPinia();setActivePinia(pinia);const instrument=useInstrumentStore()
 const view=mountSfc(await loadSfc('components/windows/InstrumentConfigurationForm.vue'),pinia)
 try{
  const input=view.find('input','aria-label','Capture duration (ns)')
  type(input,'40');instrument.configurationError='Unrelated status';await nextTick()
  assert.equal(input.props.value,'40')
  assert.equal(instrument.captureDurationNs,1_000_000)
  dispatch(input,'onChange',input.props.value);await nextTick()
  assert.equal(instrument.captureDurationNs,40)
  type(input,'9007199254740993');instrument.captureMaxEvents=100;await nextTick()
  assert.equal(input.props.value,'9007199254740993')
  dispatch(input,'onChange',input.props.value);await nextTick()
  assert.equal(instrument.captureDurationNs,40)
  assert.equal(instrument.requestedInputErrors['capture.duration_ns']?.text,'9007199254740993')
 }finally{view.app.unmount()}
})

test('uncommitted instrument text is cleared when the principal changes',async()=>{
 const pinia=createPinia();setActivePinia(pinia);const instrument=useInstrumentStore()
 instrument.setPrincipal('first')
 const view=mountSfc(await loadSfc('components/windows/InstrumentConfigurationForm.vue'),pinia)
 try{
  type(view.find('input','aria-label','Capture signals'),'private.pending')
  type(view.find('input','aria-label','Capture duration (ns)'),'1234')
  type(view.find('input','aria-label','Trigger signal local draft'),'private.trigger')
  await nextTick();instrument.setPrincipal('second');await nextTick()
  assert.equal(view.find('input','aria-label','Capture signals').props.value,'')
  assert.equal(view.find('input','aria-label','Capture duration (ns)').props.value,'1000000')
  assert.equal(view.find('input','aria-label','Trigger signal local draft').props.value,instrument.triggerDraft.signal)
  assert.deepEqual(instrument.captureSignals,[])
 }finally{view.app.unmount()}
})

test('circuit rename text survives a status update and commits once to authored history on change',async()=>{
 const pinia=createPinia();setActivePinia(pinia);const circuit=useCircuitStore(),projects=useProjectStore()
 circuit.createDraft('Original')
 projects.loadProjects=async()=>true;projects.refreshRecovery=async()=>undefined
 const view=mountSfc(await loadSfc('components/windows/ProjectManagerWindow.vue'),pinia)
 try{
  const input=view.find('input','aria-label','Current circuit name'),past=circuit.past.length
  type(input,'Second');type(input,'Second local edit');projects.error='Unrelated background status';await nextTick()
  assert.equal(input.props.value,'Second local edit')
  assert.equal(circuit.current?.name,'Original')
  assert.equal(circuit.past.length,past)
  dispatch(input,'onChange',input.props.value);await nextTick()
  assert.equal(circuit.current?.name,'Second local edit')
  assert.equal(circuit.past.length,past+1)
  circuit.undo();await nextTick()
  assert.equal(circuit.current?.name,'Original');assert.equal(input.props.value,'Original')
  circuit.redo();await nextTick()
  assert.equal(circuit.current?.name,'Second local edit');assert.equal(input.props.value,'Second local edit')
  circuit.renameCurrent('External update');await nextTick()
  assert.equal(input.props.value,'External update')
  type(input,'Uncommitted old document');circuit.createDraft('Other document');await nextTick()
  assert.equal(input.props.value,'Other document')
 }finally{view.app.unmount()}
})
