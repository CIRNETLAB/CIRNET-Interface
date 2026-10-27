import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {createRenderer,reactive,nextTick} from 'vue'
import {routeLocationKey,routerKey} from 'vue-router'
import {useProjectWorkspace} from '../src/composables/useProjectWorkspace'
import {useProjectStore} from '../src/stores/projects'
import {useAuthStore} from '../src/stores/auth'
import {deferred} from './helpers/capture'
import {setImmediate as settledPromises} from 'node:timers/promises'

function mountNavigation(route:object){
 const renderer=createRenderer<object,object>({insert(){},remove(){},createElement:()=>({}),createText:()=>({}),createComment:()=>({}),setText(){},setElementText(){},parentNode:()=>null,nextSibling:()=>null,patchProp(){}})
 const app=renderer.createApp({setup(){useProjectWorkspace();return()=>null}})
 app.provide(routeLocationKey,route as never);app.provide(routerKey,{replace:async()=>undefined} as never)
 app.mount({});return()=>app.unmount()
}
const pending=(projects:ReturnType<typeof useProjectStore>)=>(projects.$state as typeof projects.$state&{navigationPending:boolean}).navigationPending

test('server route remains pending through auth, principal transition, project selection and document hydration',async()=>{
 setActivePinia(createPinia())
 const projects=useProjectStore(),auth=useAuthStore(),principal=deferred<void>(),selection=deferred<boolean>(),hydration=deferred<boolean>(),selected=deferred<void>(),opened=deferred<void>()
 projects.setPrincipal=async()=>principal.promise
 projects.selectProject=async()=>{selected.resolve();return selection.promise}
 projects.requestOpen=async()=>{opened.resolve();return hydration.promise}
 projects.circuits=[{document_id:'doc'}] as typeof projects.circuits
 const route=reactive({name:'ProjectCircuit',fullPath:'/projects/p/circuits/doc',params:{projectId:'p',documentId:'doc'}}),unmount=mountNavigation(route)
 try{
  assert.equal(pending(projects),true)
  auth.ready=true;await nextTick();assert.equal(pending(projects),true)
  principal.resolve();await selected.promise;assert.equal(pending(projects),true)
  selection.resolve(true);await opened.promise;assert.equal(pending(projects),true)
  hydration.resolve(true);await settledPromises();assert.equal(pending(projects),false)
 }finally{unmount()}
})

test('stale navigation completion cannot release a newer route and disposal clears pending state',async()=>{
 setActivePinia(createPinia())
 const projects=useProjectStore(),auth=useAuthStore(),first=deferred<boolean>(),second=deferred<boolean>(),opened=deferred<void>(),reopened=deferred<void>()
 auth.ready=true;projects.setPrincipal=async()=>undefined;projects.selectProject=async()=>true
 projects.circuits=[{document_id:'first'},{document_id:'second'}] as typeof projects.circuits
 projects.requestOpen=async id=>{if(id==='first'){opened.resolve();return first.promise}reopened.resolve();return second.promise}
 const route=reactive({name:'ProjectCircuit',fullPath:'/first',params:{projectId:'p',documentId:'first'}}),unmount=mountNavigation(route)
 await opened.promise;route.fullPath='/second';route.params.documentId='second';await reopened.promise
 first.resolve(true);await settledPromises();assert.equal(pending(projects),true)
 unmount();assert.equal(pending(projects),false)
 second.resolve(true);await settledPromises();assert.equal(pending(projects),false)
})
