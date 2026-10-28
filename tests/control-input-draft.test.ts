import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {nextTick} from 'vue'
import {useInstrumentStore} from '../src/stores/instrument'
import {useStationStore} from '../src/stores/station'
import {useCircuitStore} from '../src/stores/circuit'
import {useWorkspaceStore} from '../src/stores/workspace'
import {useAssignmentStore} from '../src/stores/assignments'
import {configureApiClient} from '../src/services/api/client'
import {stationFixture} from './helpers/station'
import {loadSfc,mountSfc,dispatch,type HostNode} from './helpers/vueSfc'

// Native input changes its displayed value before change commits the edit.
// Exercise the compiled component and Vue renderer across an unrelated update.
function type(node:HostNode,value:string){
 node.props.value=value
 if(typeof node.props.onInput==='function')dispatch(node,'onInput',value)
}
const flush=async()=>{for(let n=0;n<6;n++)await new Promise(resolve=>setTimeout(resolve,0));await nextTick()}

test('generator numeric drafts survive acknowledgement rendering without applying output',async()=>{
 const pinia=createPinia();setActivePinia(pinia)
 const instrument=useInstrumentStore(),station=useStationStore(),target=stationFixture()
 target.capabilities!.instrument_capabilities.generator.channels=2;station.setStations([target])
 const view=mountSfc(await loadSfc('components/windows/GeneratorWindow.vue'),pinia)
 const edits=[['frequency (Hz)','frequency','2000'],['amplitude (Vpp)','amplitude','2.5'],['offset (V)','offset','1.25'],['phase (degrees)','phase','45.5'],['duty cycle (%)','dutyCycle','25.5']] as const
 try{
  assert.equal(view.find('fieldset','class','generator-request').props.disabled,false,'Declared channels enable requested settings without enabling live output')
  const commands=JSON.stringify(instrument.generatorControl.channels)
  for(const [label,,value] of edits)type(view.find('input','aria-label','Generator '+label),value)
  assert.deepEqual([instrument.generator.frequency,instrument.generator.amplitude,instrument.generator.offset,instrument.generator.phase,instrument.generator.dutyCycle],[1000,1,0,0,50])
  instrument.generatorControl.accessError='Unrelated acknowledgement status';await nextTick()
  assert.deepEqual(edits.map(([label])=>view.find('input','aria-label','Generator '+label).props.value),['2000','2.5','1.25','45.5','25.5'])
  assert.equal(JSON.stringify(instrument.generatorControl.channels),commands)
  assert.equal(view.find('button','aria-label','Apply generator configuration').props.disabled,true)
  for(const [label,,value] of edits)dispatch(view.find('input','aria-label','Generator '+label),'onChange',value)
  await nextTick()
  assert.deepEqual([instrument.generator.frequency,instrument.generator.amplitude,instrument.generator.offset,instrument.generator.phase,instrument.generator.dutyCycle],[2000,2.5,1.25,45.5,25.5])
  assert.equal(JSON.stringify(instrument.generatorControl.channels),commands,'Editing requested values never sends or acknowledges a live output command')
  dispatch(view.find('input','aria-label','Generator frequency (Hz)'),'onChange','9007199254740993');await nextTick()
  assert.equal(instrument.generator.frequency,2000)
  assert.equal(instrument.requestedInputErrors['generator.1.frequency']?.text,'9007199254740993')
  assert.equal(view.find('button','aria-label','Apply generator configuration').props.disabled,true)
 }finally{view.app.unmount()}
})

test('supply numeric drafts survive another local property update and commit only on change',async()=>{
 const pinia=createPinia();setActivePinia(pinia)
 const circuit=useCircuitStore(),workspace=useWorkspaceStore(),instrument=useInstrumentStore()
 circuit.createDraft();const id=circuit.placeModule('POWER_SUPPLY',{x:0,y:0,z:0});workspace.selectModule(id)
 const view=mountSfc(await loadSfc('components/windows/PowerSupplyWindow.vue'),pinia)
 try{
  const voltage=view.find('input','aria-label','Voltage setpoint'),current=view.find('input','aria-label','Current limit')
  const history=circuit.past.length,instruments=JSON.stringify(instrument.$state)
  type(voltage,'5.5');type(current,'1.25')
  assert.equal(circuit.graph!.modules[0].properties!.voltage_v,0)
  assert.equal(circuit.graph!.modules[0].properties!.current_limit_a,0)
  assert.equal(circuit.past.length,history)
  circuit.updateModuleProperties(id,{power_on:true});await nextTick()
  assert.deepEqual([voltage.props.value,current.props.value],['5.5','1.25'])
  const beforeCommit=circuit.past.length
  dispatch(voltage,'onChange',voltage.props.value);await nextTick()
  assert.equal(circuit.graph!.modules[0].properties!.voltage_v,5.5)
  assert.equal(circuit.past.length,beforeCommit+1)
  assert.equal(current.props.value,'1.25','Committing voltage must preserve unfinished current text')
  dispatch(current,'onChange',current.props.value);await nextTick()
  assert.equal(circuit.graph!.modules[0].properties!.current_limit_a,1.25)
  assert.equal(circuit.past.length,beforeCommit+2)
  const valid=circuit.snapshot(),validHistory=circuit.past.length
  dispatch(voltage,'onChange','16');await nextTick()
  assert.equal(circuit.snapshot(),valid);assert.equal(circuit.past.length,validHistory)
  assert.ok(view.find('p','role','alert'))
  assert.equal(JSON.stringify(instrument.$state),instruments,'Local supply settings do not bind physical instrument control')
 }finally{view.app.unmount()}
})

test('assignment ID text survives background author status and validates only on change',async()=>{
 const pinia=createPinia();setActivePinia(pinia);const author=useAssignmentStore()
 author.setScope('teacher','INSTRUCTOR');author.newDraft('original-assignment')
 let writes=0
 configureApiClient({fetcher:async(url,options)=>{
  if(options?.method&&options.method!=='GET'){writes++;throw new Error('No assignment write is expected while editing')}
  return Response.json(String(url).includes('assignment-documents')?{schema_version:'1.0',items:[],next_cursor:null}:[])
 }})
 const view=mountSfc(await loadSfc('components/windows/AssignmentWindow.vue'),pinia)
 try{
  await flush();const input=view.find('input','aria-label','Assignment ID'),revision=author.editRevision
  type(input,'typed-assignment');author.error='Unrelated background request status';await nextTick()
  assert.equal(input.props.value,'typed-assignment')
  assert.equal(author.draft!.assignment_id,'original-assignment');assert.equal(author.editRevision,revision)
  dispatch(input,'onChange',input.props.value);await nextTick()
  assert.equal(author.draft!.assignment_id,'typed-assignment');assert.equal(author.editRevision,revision+1)
  dispatch(input,'onChange','');await nextTick()
  assert.equal(author.draft!.assignment_id,'typed-assignment');assert.equal(author.editRevision,revision+1)
  assert.ok(view.find('p','role','alert'));assert.equal(writes,0)
 }finally{view.app.unmount();author.dispose()}
})

test('generator drafts reset across equal-valued channel, document and principal scopes',async()=>{
 const pinia=createPinia();setActivePinia(pinia)
 const instrument=useInstrumentStore(),station=useStationStore(),circuit=useCircuitStore(),target=stationFixture()
 instrument.setPrincipal('first');circuit.createDraft('First circuit')
 target.capabilities!.instrument_capabilities.generator.channels=2;station.setStations([target])
 const view=mountSfc(await loadSfc('components/windows/GeneratorWindow.vue'),pinia)
 try{
  const frequency=()=>view.find('input','aria-label','Generator frequency (Hz)'),amplitude=()=>view.find('input','aria-label','Generator amplitude (Vpp)')
  type(frequency(),'2000');dispatch(view.find('button','aria-label','Select CH2 configuration'),'onClick');await nextTick()
  assert.equal(String(frequency().props.value),'1000')
  dispatch(view.find('button','aria-label','Select CH1 configuration'),'onClick');await nextTick()
  assert.equal(String(frequency().props.value),'1000','Returning to an unchanged channel must not revive pending text')
  type(frequency(),'3000');circuit.createDraft('Second circuit');await nextTick()
  assert.equal(String(frequency().props.value),'1000')
  type(frequency(),'4000');instrument.setPrincipal('second');await nextTick()
  assert.equal(String(frequency().props.value),'1000')
  type(amplitude(),'2.5');instrument.generator.frequency=2200;await nextTick()
  assert.equal(String(frequency().props.value),'2200')
  assert.equal(amplitude().props.value,'2.5','An authoritative frequency update must preserve pending amplitude')
  assert.equal(instrument.generator.amplitude,1)
  const other=stationFixture('v2');other.capabilities!.instrument_capabilities.generator.channels=2
  type(frequency(),'4400');station.setStations([target,other]);await nextTick()
  assert.equal(frequency().props.value,'4400','Refreshing the same station list must preserve pending text')
  station.selectStation('v2');await nextTick()
  assert.equal(String(frequency().props.value),'2200');assert.equal(String(amplitude().props.value),'1')
  assert.equal(view.find('button','aria-label','Apply generator configuration').props.disabled,true)
 }finally{view.app.unmount()}
})

test('supply range drafts preserve one-action history, canonical Undo/Redo and scope resets',async()=>{
 const pinia=createPinia();setActivePinia(pinia)
 const circuit=useCircuitStore(),workspace=useWorkspaceStore(),instrument=useInstrumentStore()
 instrument.setPrincipal('first');circuit.createDraft()
 const first=circuit.placeModule('POWER_SUPPLY',{x:0,y:0,z:0}),second=circuit.placeModule('POWER_SUPPLY',{x:4,y:0,z:0})
 workspace.selectModule(first)
 const view=mountSfc(await loadSfc('components/windows/PowerSupplyWindow.vue'),pinia)
 try{
  const voltage=()=>view.find('input','aria-label','Voltage setpoint'),current=()=>view.find('input','aria-label','Current limit'),knob=()=>view.find('input','aria-label','Current knob')
  const history=circuit.past.length
  type(voltage(),'6');type(knob(),'1.75');await nextTick()
  assert.equal(current().props.value,'1.75');assert.equal(circuit.past.length,history)
  circuit.updateModuleProperties(first,{power_on:true});await nextTick()
  assert.equal(knob().props.value,'1.75');assert.equal(voltage().props.value,'6')
  const beforeCommit=circuit.past.length
  dispatch(knob(),'onChange',knob().props.value);await nextTick()
  assert.equal(circuit.past.length,beforeCommit+1)
  assert.equal(circuit.graph!.modules[0].properties!.current_limit_a,1.75)
  assert.equal(voltage().props.value,'6')
  circuit.undo();await nextTick()
  assert.equal(String(current().props.value),'0');assert.equal(voltage().props.value,'6')
  circuit.redo();await nextTick()
  assert.equal(String(current().props.value),'1.75');assert.equal(voltage().props.value,'6')
  workspace.selectModule(second);await nextTick()
  assert.equal(String(voltage().props.value),'0');assert.equal(String(current().props.value),'0')
  type(voltage(),'7');instrument.setPrincipal('second');await nextTick()
  assert.equal(String(voltage().props.value),'0')
  type(voltage(),'8');circuit.createDraft('Other document');await nextTick()
  assert.equal(voltage().props.value,'');assert.equal(view.find('fieldset','aria-label','Local supply setpoint controls').props.disabled,true)
 }finally{view.app.unmount()}
})

test('assignment ID typing preserves other private fields and resets on role, principal and binding changes',async()=>{
 const pinia=createPinia();setActivePinia(pinia);const author=useAssignmentStore()
 author.setScope('first','INSTRUCTOR');author.newDraft('canonical-id')
 const definition={schema_version:'1.0',assignment_id:'canonical-id',title:'Saved assignment',lab_endpoints:[],assessment_policy:'FUNCTIONAL_ONLY'}
 const document={schema_version:'1.0',assignment_id:'canonical-id',title:'Saved assignment',owner_id:'second',revision:1,published:false,published_revision:null,feedback_policy:'observed_only',created_at:1,updated_at:1,definition}
 configureApiClient({fetcher:async url=>Response.json(String(url).endsWith('/canonical-id')?document:String(url).includes('assignment-documents')?{schema_version:'1.0',items:[],next_cursor:null}:[])})
 const view=mountSfc(await loadSfc('components/windows/AssignmentWindow.vue'),pinia)
 try{
  await flush();const id=()=>view.find('input','aria-label','Assignment ID'),endpoint=()=>view.find('input','aria-label','Endpoint target')
  const revision=author.editRevision
  type(endpoint(),'PRIVATE.OUT');type(id(),'first-pending');type(id(),'second-pending');await nextTick()
  assert.equal(endpoint().props.value,'PRIVATE.OUT');assert.equal(author.editRevision,revision)
  dispatch(id(),'onChange',id().props.value);await nextTick()
  assert.equal(author.draft!.assignment_id,'second-pending');assert.equal(author.editRevision,revision+1)
  assert.equal(endpoint().props.value,'','Existing assignment-identity reset occurs once at commit')
  type(id(),'private-pending');author.setScope('second','INSTRUCTOR');author.newDraft('canonical-id');await nextTick()
  assert.equal(id().props.value,'canonical-id')
  type(id(),'role-pending');author.setScope('second','ADMIN');author.newDraft('canonical-id');await nextTick()
  assert.equal(id().props.value,'canonical-id')
  type(id(),'binding-pending');assert.equal(await author.openDocument('canonical-id',true),true);await nextTick()
  assert.equal(id().props.value,'canonical-id');assert.equal(id().props.disabled,true)
 }finally{view.app.unmount();author.dispose()}
})
