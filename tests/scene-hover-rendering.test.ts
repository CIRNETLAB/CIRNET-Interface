import {test} from 'node:test'
import assert from 'node:assert/strict'
import {Mesh,MeshBasicMaterial,Vector3} from 'three'
import {createSceneManager} from '../src/three/SceneManager'
import type {CircuitGraph} from '../src/types/circuit'
const graph:CircuitGraph={schema_version:'1.0',circuit_id:'idle-hover',modules:[{id:'BB',type:'BREADBOARD_100',position:{x:0,y:0,z:4}},{id:'C',type:'CLOCK',position:{x:-2,y:0,z:0}},{id:'L',type:'LED',position:{x:2,y:0,z:0}}],connections:[{source:'C.OUT',destination:'L.IN'}]}
function setup(){
 let next=0,renders=0;const frames=new Map<number,FrameRequestCallback>()
 const manager=createSceneManager({renderer:{setSize(){},render(){renders++},dispose(){}},requestFrame(cb){frames.set(++next,cb);return next},cancelFrame(id){frames.delete(id)}})
 const flush=()=>{const batch=[...frames];frames.clear();for(const[,cb]of batch)cb(0)}
 manager.resize(1000,700);manager.syncGraph(graph);flush()
 return{manager,frames,flush,renders:()=>renders}
}
test('idle hover and leave events do not submit twenty unchanged scene draws',()=>{
 const h=setup(),before=JSON.stringify(graph),initial=h.renders()
 try{
  for(let i=0;i<20;i++){h.manager.hoverEndpoint(null);assert.equal(h.manager.hoverGizmo(0,0),null);h.manager.hoverWire(null);h.manager.clearGizmoHover();h.flush()}
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
  h.manager.hoverEndpoint(null);h.manager.hoverGizmo(0,0);h.manager.hoverWire(null);h.manager.clearGizmoHover()
  assert.deepEqual([...h.frames.keys()],ids);h.flush();assert.equal(h.renders(),before+1)
  assert.notDeepEqual(h.manager.camera.position.toArray(),camera.toArray());assert.equal(h.manager.models.get('C')?.position.x,-3)
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
