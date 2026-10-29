import {test} from 'node:test'
import assert from 'node:assert/strict'
import {Color,InstancedMesh,Mesh,MeshBasicMaterial,Vector3} from 'three'
import {createSceneManager,type WireEditPick} from '../src/three/SceneManager'
import type {CircuitGraph} from '../src/types/circuit'
const graph:CircuitGraph={schema_version:'1.0',circuit_id:'idle-hover',modules:[{id:'BB',type:'BREADBOARD_100',position:{x:0,y:0,z:4}},{id:'C',type:'CLOCK',position:{x:-2,y:0,z:0}},{id:'L',type:'LED',position:{x:2,y:0,z:0}}],connections:[{source:'C.OUT',destination:'L.IN'}]}
function setup(document=graph){
 let next=0,renders=0;const frames=new Map<number,FrameRequestCallback>()
 const manager=createSceneManager({renderer:{setSize(){},render(){renders++},dispose(){}},requestFrame(cb){frames.set(++next,cb);return next},cancelFrame(id){frames.delete(id)}})
 const flush=()=>{const batch=[...frames];frames.clear();for(const[,cb]of batch)cb(0)}
 manager.resize(1000,700);manager.syncGraph(document);flush()
 return{manager,frames,flush,renders:()=>renders}
}
test('idle hover and leave events do not submit twenty unchanged scene draws',()=>{
 const h=setup(),before=JSON.stringify(graph),initial=h.renders()
 try{
  for(let i=0;i<20;i++){h.manager.hoverEndpoint(null);assert.equal(h.manager.hoverGizmo(0,0),null);h.manager.hoverWire(null);h.manager.clearGizmoHover();h.manager.hoverWireEdit(null);h.flush()}
  assert.equal(JSON.stringify(graph),before)
  assert.equal(h.renders()-initial,0,'twenty idle pointer/leave events keep the existing framebuffer')
 }finally{h.manager.dispose()}
})
test('wire hover enters and exits visibly while repeated identity produces no draws',()=>{
 const h=setup(),wire=graph.connections[0],geometry=(h.manager.wires.children[0]as Mesh).geometry
 try{
  const n=h.renders();h.manager.hoverWire(wire);assert.equal(h.frames.size,1);h.flush();assert.equal(h.renders(),n+1)
  assert.equal(h.manager.scene.getObjectByName('wire-hover-outline')?.visible,true)
  const after=h.renders();for(let i=0;i<20;i++){h.manager.hoverWire({...wire});h.flush()}
  const repeated=h.renders()-after;h.manager.hoverWire(null);assert.equal(h.frames.size,1);h.flush()
  assert.equal(h.manager.scene.getObjectByName('wire-hover-outline')?.visible,false)
  assert.equal((h.manager.wires.children[0]as Mesh).geometry,geometry)
  assert.equal(repeated,0,'the same logical wire keeps its existing hover outline')
 }finally{h.manager.dispose()}
})
test('contact hover remains visible and clearing an already clear endpoint is idle',()=>{
 const h=setup()
 try{
  h.manager.hoverEndpoint('BB.contact:rail:negative:50');assert.equal(h.frames.size,1);h.flush();assert.equal(h.manager.scene.getObjectByName('contact-hover')?.visible,true)
  h.manager.hoverEndpoint(null);assert.equal(h.frames.size,1);h.flush();assert.equal(h.manager.scene.getObjectByName('contact-hover')?.visible,false)
  const after=h.renders();for(let i=0;i<20;i++){h.manager.hoverEndpoint(null);h.flush()}
  assert.equal(h.renders()-after,0,'an already hidden contact cannot invalidate pixels')
 }finally{h.manager.dispose()}
})
test('gizmo hover enters and clears visibly without repeated identical paint draws',()=>{
 const h=setup()
 try{
  h.manager.highlight('BB');h.flush();const p=h.manager.project(h.manager.gizmoHandlePosition('x')!)
  assert.equal(h.manager.hoverGizmo(p.x,p.y),'x');assert.equal(h.frames.size,1);h.flush()
  const tool=h.manager.scene.getObjectByName('component-transform-gizmo')!,face=tool.getObjectByName('x-face')as Mesh
  const materials=Array.isArray(face.material)?face.material:[face.material]
  assert.ok(materials.some(m=>(m as MeshBasicMaterial).color.getHexString()==='a6eee4'))
  const after=h.renders();for(let i=0;i<20;i++){assert.equal(h.manager.hoverGizmo(p.x,p.y),'x');h.flush()}
  const repeated=h.renders()-after;h.manager.clearGizmoHover();assert.equal(h.frames.size,1);h.flush()
  assert.ok(materials.every(m=>(m as MeshBasicMaterial).color.getHexString()!=='a6eee4'))
  assert.equal(repeated,0,'unchanged handle color does not repaint the scene')
 }finally{h.manager.dispose()}
})
test('idle hover preserves the already pending graph and camera frame',()=>{
 const h=setup()
 try{
  const before=h.renders(),camera=h.manager.camera.position.clone()
  h.manager.syncGraph({...graph,modules:graph.modules.map(m=>m.id==='C'?{...m,position:{x:-3,y:0,z:0}}:m)});h.manager.pan(.5,0)
  const ids=[...h.frames.keys()];assert.equal(ids.length,1)
  const pendingCamera=h.manager.camera.position.toArray()
  h.manager.hoverEndpoint(null);h.manager.hoverGizmo(0,0);h.manager.hoverWire(null);h.manager.clearGizmoHover();h.manager.hoverWireEdit(null)
  assert.deepEqual(h.manager.camera.position.toArray(),pendingCamera)
  assert.deepEqual([...h.frames.keys()],ids);h.flush();assert.equal(h.renders(),before+1)
  assert.notDeepEqual(h.manager.camera.position.toArray(),camera.toArray());assert.equal(h.manager.models.get('C')?.position.x,-3)
 }finally{h.manager.dispose()}
})
function wireEditSetup(){
  const document:CircuitGraph={...graph,connections:[{...graph.connections[0],metadata:{wireVisual:{version:1,color:'#71b3ce',routeMode:'FREE',thickness:.036,height:.03,controlPoints:[{space:'world',position:{x:-1,y:.36,z:1}},{space:'world',position:{x:1,y:.36,z:1}}]}}}]}
  const h=setup(document),wire=document.connections[0]
  h.manager.highlight(null,wire);h.flush()
  const route=h.manager.wireRoute(wire)!,segments=route.segments.filter(segment=>segment.editable)
  assert.equal(route.handles.length,2);assert.ok(segments.length>=2)
  const hit=(kind:WireEditPick['kind'],index:number):WireEditPick=>({kind,index,wire:{...wire},point:new Vector3()})
  const handles=()=>h.manager.scene.getObjectByName('wire-handles')as InstancedMesh
  const color=(index:number)=>{const value=new Color();handles().getColorAt(index,value);return value.getHexString()}
  const state=()=>({graph:JSON.stringify(document),camera:[...h.manager.camera.position.toArray(),...h.manager.camera.quaternion.toArray(),h.manager.camera.zoom,h.manager.camera.near,h.manager.camera.far],geometry:[...h.manager.models.values(),h.manager.wires].flatMap(root=>{const result:{mesh:Mesh;geometry:Mesh['geometry'];positions:number[]}[]=[];root.traverse(object=>{if(object instanceof Mesh)result.push({mesh:object,geometry:object.geometry,positions:Array.from(object.geometry.getAttribute('position').array)})});return result})})
  return{...h,wire,route,segments,hit,color,state}
}
test('wire bend hover paints changes and leaves repeated identities idle without changing committed state',()=>{
  const h=wireEditSetup(),before=h.state()
  try{
    const initial=h.renders();h.manager.hoverWireEdit(h.hit('bend',0));assert.equal(h.frames.size,1);h.flush()
    assert.equal(h.renders(),initial+1);assert.equal(h.color(0),'fff1bd');assert.equal(h.color(1),'d9b66f')
    const repeated=h.renders();for(let i=0;i<20;i++){h.manager.hoverWireEdit(h.hit('bend',0));h.flush()}
    assert.equal(h.renders(),repeated,'the same bend keeps its existing handle color')
    h.manager.hoverWireEdit(h.hit('bend',1));assert.equal(h.frames.size,1);h.flush()
    assert.equal(h.color(0),'d9b66f');assert.equal(h.color(1),'fff1bd')
    h.manager.hoverWireEdit(null);assert.equal(h.frames.size,1);h.flush()
    assert.equal(h.color(0),'d9b66f');assert.equal(h.color(1),'d9b66f')
    assert.equal(h.manager.scene.getObjectByName('wire-selection-outline')?.visible,true)
    const cleared=h.renders();for(let i=0;i<20;i++){h.manager.hoverWireEdit(null);h.flush()}
    assert.equal(h.renders(),cleared);assert.deepEqual(h.state(),before)
    h.manager.hoverWireEdit(h.hit('bend',0));h.flush();h.manager.highlight(null,h.wire);h.flush()
    h.manager.hoverWireEdit(h.hit('bend',0));assert.equal(h.frames.size,1);h.flush()
    assert.equal(h.color(0),'fff1bd','selection resets cannot leave a stale cached hover identity')
  }finally{h.manager.dispose()}
})
test('wire segment hover clears bend colors and paints enter change and leave without repeated draws',()=>{
  const h=wireEditSetup(),before=h.state(),first=h.segments[0].index,next=h.segments[1].index
  try{
    h.manager.hoverWireEdit(h.hit('segment',first));assert.equal(h.frames.size,1);h.flush()
    const line=h.manager.scene.getObjectByName('wire-segment-hover-line')as Mesh
    assert.equal(line.visible,true);const firstPoints=Array.from(line.geometry.getAttribute('position').array)
    const repeated=h.renders();for(let i=0;i<20;i++){h.manager.hoverWireEdit(h.hit('segment',first));h.flush()}
    assert.equal(h.renders(),repeated,'the same segment keeps its existing highlight')
    h.manager.hoverWireEdit(h.hit('segment',next));assert.equal(h.frames.size,1);h.flush()
    assert.equal(line.visible,true);assert.notDeepEqual(Array.from(line.geometry.getAttribute('position').array),firstPoints)
    h.manager.hoverWireEdit(h.hit('bend',0));assert.equal(h.frames.size,1);h.flush()
    assert.equal(line.visible,false);assert.equal(h.color(0),'fff1bd')
    h.manager.hoverWireEdit(h.hit('segment',first));assert.equal(h.frames.size,1);h.flush()
    assert.equal(line.visible,true);assert.equal(h.color(0),'d9b66f')
    h.manager.hoverWireEdit(null);assert.equal(h.frames.size,1);h.flush();assert.equal(line.visible,false)
    const cleared=h.renders();h.manager.hoverWireEdit(null);h.flush();assert.equal(h.renders(),cleared)
    assert.deepEqual(h.state(),before)
  }finally{h.manager.dispose()}
})
test('leaving a selected wire clears an existing hover even when bend and segment are already clear',()=>{
  const h=wireEditSetup(),before=h.state()
  try{
    h.manager.hoverWire(h.wire);h.flush();const hovered=h.renders()
    h.manager.hoverWireEdit(null);assert.equal(h.frames.size,1);h.flush();assert.equal(h.renders(),hovered+1)
    h.manager.hoverWireEdit(null);h.flush();assert.equal(h.renders(),hovered+1)
    assert.deepEqual(h.state(),before)
    h.manager.highlight(null,null);h.flush()
    assert.equal(h.manager.scene.getObjectByName('wire-hover-outline')?.visible??false,false)
  }finally{h.manager.dispose()}
})
test('placement hover still captures and clears input when its visible handle is null',()=>{
 const h=setup()
 try{
  h.manager.setGhost('CLOCK',new Vector3());h.flush();const p=h.manager.project(h.manager.gizmoHandlePosition('x')!)
  assert.equal(h.manager.hoverGizmo(p.x,p.y+20),null);assert.equal(h.manager.placementFollowBlocked(),true);h.flush()
  const before=h.renders();h.manager.clearGizmoHover();assert.equal(h.manager.placementFollowBlocked(),false);h.flush()
  assert.equal(h.renders(),before,'input capture clears without changing a visible hover')
 }finally{h.manager.dispose()}
})
