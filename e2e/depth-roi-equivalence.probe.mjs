// Explicit, expensive equivalence proof; deliberately outside normal *.spec discovery.
import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import {getArtifactDirectory} from '../scripts/artifact-paths.mjs'
import {copyBrowserRuntime} from '../scripts/e2e-browser-runtime.mjs'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),smoke=process.argv.includes('--smoke'),guardsOnly=process.argv.includes('--guards-only')
const directory=getArtifactDirectory(`depth-roi-equivalence/${randomUUID()}`)
await mkdir(directory,{recursive:true})
const cache=await copyBrowserRuntime(process.env.NETCIRCUIT_ROI_BROWSER_CACHE??resolve(root,'.runtime/playwright'),getArtifactDirectory(`br-${randomUUID().slice(0,8)}`))
process.env.PLAYWRIGHT_BROWSERS_PATH=cache
const args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-compositing','--enable-automation',`--log-file=${resolve(directory,'chromium-debug.log')}`]
const result={kind:'explicit ROI equivalence proof; not release acceptance',smoke,guardsOnly,directory,args,cases:[],startedAt:new Date().toISOString()}
result.sourceSha256=Object.fromEntries(await Promise.all(['e2e/depth-harness.ts','e2e/depth-artifacts.spec.ts','e2e/depth-roi-equivalence.probe.mjs'].map(async name=>[name,createHash('sha256').update(await readFile(resolve(root,name))).digest('hex')])))
let browser,server
async function persist(){await writeFile(resolve(directory,'equivalence.json'),JSON.stringify(result,null,2))}
try{
 server=await createServer({root,server:{host:'127.0.0.1',port:14173,strictPort:true}});await server.listen()
 // Load Playwright only after selecting the physically copied runtime.
 const {chromium}=await import('@playwright/test')
 assert.ok(chromium.executablePath().startsWith(cache),'Playwright must resolve its owned browser copy')
 browser=await chromium.launch({headless:true,args})
 const cdp=await browser.newBrowserCDPSession(),command=await cdp.send('Browser.getBrowserCommandLine')
 const selected=command.arguments[0];assert.ok(selected.startsWith(cache),'Chromium must execute from the owned runtime')
 result.executable=selected;result.executableSha256=createHash('sha256').update(await readFile(selected)).digest('hex');result.browserVersion=browser.version();await cdp.detach()
 for(const dpr of (smoke?[1]:[1,2])){
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:dpr}),page=await context.newPage()
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message))
  try{
   await page.goto('http://127.0.0.1:14173/e2e/depth-harness.html');await page.locator('body').waitFor({state:'attached'});await page.waitForFunction(()=>document.body.dataset.ready==='true')
   assert.equal(await page.evaluate(()=>typeof window.depthHarness.proveLeakAnalysis),'function','The real harness must expose the reference/ROI byte-equivalence probe')
   const metadata=await page.evaluate(()=>window.depthHarness.metadata())
   assert.equal(metadata.dpr,dpr);assert.match(metadata.webglVersion,/^WebGL 2/);assert.match(metadata.backend,/SwiftShader/)
   result.renderers??=[];result.renderers.push({dpr,metadata})
   async function prove(parameters){
    const proof=await page.evaluate(async parameters=>{
     const h=window.depthHarness;h.fixture(parameters.historical);h.setOn(parameters.on??false);h.pose(parameters.id,30*100/parameters.zoom,20,parameters.id==='BOARD'?90:35);await h.frame()
     return h.proveLeakAnalysis(parameters.id,parameters.glyphs??false,parameters.positiveControl??false)
    },parameters)
    result.cases.push({dpr,...parameters,...proof});await persist()
    assert.equal(proof.originalDifferingBytes,0,'Every tested original RGBA byte must match')
    assert.equal(proof.coloredDifferingBytes,0,'Every tested diagnostic RGBA byte must match')
    assert.equal(proof.restoredDifferingBytes,0,'Every full restored RGBA byte must match')
    assert.equal(proof.scissorRestored,true,'Both observer paths must restore the prior scissor state')
    assert.deepEqual(proof.reference,proof.optimized,'All tested/changed/regions must match')
    assert.ok(proof.reference.tested>10,'The equivalence comparison must inspect visible real pixels')
    if(parameters.positiveControl){assert.ok(proof.reference.changed>0,'Both paths must detect an intentional underlayer leak');assert.equal(proof.controlStateRestored,true)}
    else assert.equal(proof.reference.changed,0,'The correct native scene must retain its zero-leak assertion')
    console.log(JSON.stringify({dpr,...parameters,tested:proof.reference.tested,changed:proof.reference.changed,originalDifferingBytes:proof.originalDifferingBytes,coloredDifferingBytes:proof.coloredDifferingBytes,restoredDifferingBytes:proof.restoredDifferingBytes}))
   }
   matrix:for(const historical of (guardsOnly?[]:[false,true]))for(const id of (historical?['DISPLAY','DOUBLE','QUAD']:['DISPLAY','DOUBLE','QUAD','SCOPE','GEN','BOARD','PSU']))for(const zoom of [50,100,1000]){
    await prove({historical,id,zoom});if(smoke)break matrix
   }
   if(!smoke&&!guardsOnly){
    for(const historical of [false,true])for(const on of [false,true])for(const zoom of [100,1000])await prove({historical,on,id:'DISPLAY',zoom,glyphs:true})
    await prove({historical:false,id:'DISPLAY',zoom:100,positiveControl:true})
   }
   const failureRestoration=await page.evaluate(async()=>{
    const h=window.depthHarness,r=h.renderer,gl=r.getContext(),scissor=()=>r.getScissor({copy:v=>[v.x,v.y,v.z,v.w]})
    h.fixture(false);h.pose('DISPLAY',30,20,35);await h.frame()
    const originalRender=r.render,originalScissor=scissor(),originalTest=r.getScissorTest(),out=[]
    const read=()=>{const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels}
    const capture=()=>{originalRender.call(r,h.manager.scene,h.manager.camera);return read()}
    try{
     for(const enabled of [false,true]){
      r.setScissorTest(false);const before=capture(),callbacks=new Map(),materials=new Map()
      h.manager.scene.traverse(o=>{callbacks.set(o,o.onBeforeRender);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])materials.set(m,{color:m.color?.toArray(),emissive:m.emissive?.toArray(),intensity:m.emissiveIntensity})})
      r.setScissor(11,13,17,19);r.setScissorTest(enabled)
      let calls=0,caught=false
      r.render=function(...args){const value=originalRender.apply(this,args);if(++calls===2)throw Error('intentional analysis draw failure');return value}
      try{await h.leaks('DISPLAY')}catch(error){caught=error.message==='intentional analysis draw failure'}finally{r.render=originalRender}
      const sameScissor=JSON.stringify(scissor())===JSON.stringify([11,13,17,19])&&r.getScissorTest()===enabled
      const sameCallbacks=[...callbacks].every(([object,callback])=>object.onBeforeRender===callback)
      const sameMaterials=[...materials].every(([m,s])=>JSON.stringify(m.color?.toArray())===JSON.stringify(s.color)&&JSON.stringify(m.emissive?.toArray())===JSON.stringify(s.emissive)&&m.emissiveIntensity===s.intensity)
      // Read the finally-restored framebuffer directly: a new draw could hide damage.
      const after=read();let differing=0;for(let i=0;i<before.length;i++)if(before[i]!==after[i])differing++
      out.push({enabled,caught,sameScissor,sameCallbacks,sameMaterials,fullRestoredDifferingBytes:differing})
     }
     return out
    }finally{r.render=originalRender;r.setScissor(...originalScissor);r.setScissorTest(originalTest);capture()}
   })
   result.failureRestoration??=[];result.failureRestoration.push({dpr,checks:failureRestoration});await persist()
   for(const check of failureRestoration){assert.equal(check.caught,true);assert.equal(check.sameScissor,true);assert.equal(check.sameCallbacks,true);assert.equal(check.sameMaterials,true);assert.equal(check.fullRestoredDifferingBytes,0)}
   await page.screenshot({path:resolve(directory,`restored-dpr${dpr}.png`)})
   assert.deepEqual(pageErrors,[],'The native proof must not hide browser errors')
  }finally{await context.close()}
 }
 if(!smoke&&!guardsOnly)assert.equal(result.cases.length,78,'The full proof must include every fixed matrix, glyph and positive-control case')
 result.status='PASS';result.finishedAt=new Date().toISOString();await persist();console.log(JSON.stringify({status:result.status,cases:result.cases.length,directory,smoke,guardsOnly}))
}catch(error){result.status='FAIL';result.error=error instanceof Error?error.stack:String(error);await persist();throw error}
finally{await browser?.close();await server?.close()}
