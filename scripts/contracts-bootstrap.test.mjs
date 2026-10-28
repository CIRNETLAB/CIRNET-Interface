import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,mkdtempSync} from 'node:fs'
import {resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
import {build} from 'esbuild'
import {getArtifactDirectory,cleanupArtifactSession} from '@tinihi-labs/artifact-paths'
import {checkedHttps,requestHeaders,downloadArtifact,verifyBytes,archiveEntry,root,lock,digest} from './contracts-artifacts.mjs'
import {readContractsResource} from './contracts-resources.mjs'

test('release transport rejects mutable or credential-bearing destinations',()=>{
  for(const value of ['http://example.com/v1.tgz','https://user:secret@example.com/v1.tgz','https://example.com/releases/latest/file.tgz'])assert.throws(()=>checkedHttps(value))
  assert.equal(checkedHttps('https://example.com/releases/0.1.1/contracts.tgz').protocol,'https:')
})
test('download authentication is confined to the initial GitHub API asset request',async()=>{
  assert.equal(requestHeaders('https://example.com/asset','secret').Authorization,undefined)
  assert.equal(requestHeaders('https://api.github.com/repos/o/r/releases/assets/123','secret').Authorization,'Bearer secret')
  const calls=[],bytes=Buffer.from('immutable test bytes')
  const fetcher=async(url,options)=>{
    calls.push({url:String(url),headers:options.headers,redirect:options.redirect})
    return calls.length===1?new Response(null,{status:302,headers:{location:'https://assets.example.com/exact.tgz'}}):new Response(bytes)
  }
  const before=process.env.NETCIRCUIT_ARTIFACTS_TOKEN
  process.env.NETCIRCUIT_ARTIFACTS_TOKEN='fixture-token'
  try{assert.deepEqual(await downloadArtifact('https://api.github.com/repos/o/r/releases/assets/123',digest(bytes),fetcher),bytes)}
  finally{if(before===undefined)delete process.env.NETCIRCUIT_ARTIFACTS_TOKEN;else process.env.NETCIRCUIT_ARTIFACTS_TOKEN=before}
  assert.equal(calls[0].headers.Authorization,'Bearer fixture-token')
  assert.equal(calls[1].headers.Authorization,undefined)
  assert.ok(calls.every(call=>call.redirect==='manual'))
  await assert.rejects(downloadArtifact('https://example.com/exact.tgz','0'.repeat(64),async()=>new Response(bytes)),/SHA256/)
})

test('renamed GitHub API assets retain binary negotiation across API redirects without forwarding credentials',async()=>{
  const bytes=Buffer.from('versioned Contracts archive'),calls=[]
  const stable='https://api.github.com/repositories/1430422737/releases/assets/682226359'
  const fetcher=async(url,options)=>{
    calls.push({url:String(url),headers:options.headers})
    if(calls.length===1)return new Response(null,{status:301,headers:{location:stable}})
    if(calls.length===2){
      if(options.headers.Accept!=='application/octet-stream')return new Response(JSON.stringify({id:682226359,name:'tinihi-labs-contracts-0.1.1.tgz'}))
      return new Response(null,{status:302,headers:{location:'https://release-assets.githubusercontent.com/exact/contracts.tgz'}})
    }
    return new Response(bytes)
  }
  const before=process.env.NETCIRCUIT_ARTIFACTS_TOKEN
  process.env.NETCIRCUIT_ARTIFACTS_TOKEN='fixture-token'
  try{assert.deepEqual(await downloadArtifact('https://api.github.com/repos/TINIHI-Labs/net-Circuit-Contracts/releases/assets/682226359',digest(bytes),fetcher),bytes)}
  finally{if(before===undefined)delete process.env.NETCIRCUIT_ARTIFACTS_TOKEN;else process.env.NETCIRCUIT_ARTIFACTS_TOKEN=before}
  assert.equal(calls[0].headers.Authorization,'Bearer fixture-token')
  assert.equal(calls[1].url,stable)
  assert.equal(calls[1].headers.Accept,'application/octet-stream')
  assert.equal(calls[1].headers.Authorization,undefined)
  assert.equal(calls[2].headers.Authorization,undefined)
  assert.equal(calls[2].headers.Accept,undefined)
  assert.equal(requestHeaders(stable,'fixture-token').Accept,'application/octet-stream')
  for(const url of ['https://api.github.com/repositories/not-an-id/releases/assets/682226359','https://api.github.com:444/repositories/1430422737/releases/assets/682226359','https://api.github.com.evil.example/repositories/1430422737/releases/assets/682226359']){
    assert.equal(requestHeaders(url,'fixture-token').Authorization,undefined)
  }
})
test('resource consumers reject unapproved member names and altered release bytes',()=>{
  assert.throws(()=>readContractsResource('../contracts/private-schema'),/Unknown released/)
  assert.throws(()=>verifyBytes(Buffer.from('altered'),lock.sdist.sha256),/SHA256/)
  assert.throws(()=>verifyBytes(Buffer.from('altered'),'not-a-digest'),/SHA256/)
})
test('bundled resource readers have no bootstrap CLI side effects',async()=>{
  const outfile=resolve(root,'.test-build/resources-only.mjs')
  await build({stdin:{contents:"import {readContractsResource} from './scripts/contracts-resources.mjs';readContractsResource('physical-hc08-led');console.log('RESOURCE_ONLY')",resolveDir:root,loader:'js'},outfile,bundle:true,platform:'node',format:'esm',packages:'external'})
  const result=spawnSync(process.execPath,[outfile,'--resource-only-probe'],{encoding:'utf8',cwd:root,windowsHide:true})
  assert.equal(result.status,0,result.stderr+result.stdout)
  assert.equal(result.stdout.trim(),'RESOURCE_ONLY')
  assert.equal(result.stderr,'')
})
test('a release failure publishes ownership and supports cleanup before npm installation',()=>{
  const fixture=mkdtempSync(resolve(getArtifactDirectory('bootstrap-failure-regression'),'case-'))
  mkdirSync(resolve(fixture,'scripts'));mkdirSync(resolve(fixture,'integration'))
  for(const name of ['bootstrap-contracts.mjs','contracts-artifacts.mjs'])writeFileSync(resolve(fixture,'scripts',name),readFileSync(resolve(root,'scripts',name)))
  writeFileSync(resolve(fixture,'integration/contracts-artifacts.json'),JSON.stringify(lock))
  const manifestPath=resolve(fixture,'manifest.json'),githubEnv=resolve(fixture,'github-env')
  writeFileSync(manifestPath,JSON.stringify({dev_npm:{path:resolve(root,'.artifacts',lock.dev_npm.filename),sha256:lock.dev_npm.sha256},npm:{path:resolve(fixture,'missing.tgz'),sha256:'0'.repeat(64)}}))
  const sessions=resolve(fixture,'sessions'),environment={...process.env,NETCIRCUIT_ARTIFACTS_DIR:sessions}
  delete environment.NETCIRCUIT_ARTIFACTS_SESSION
  try{
    const failed=spawnSync(process.execPath,[resolve(fixture,'scripts/bootstrap-contracts.mjs'),'--manifest',manifestPath,'--github-env',githubEnv],{env:environment,encoding:'utf8',windowsHide:true})
    assert.equal(failed.status,1,failed.stdout+failed.stderr)
    assert.match(failed.stderr,/Manifest npm differs/)
    assert.equal(existsSync(githubEnv),true,'ownership must be published before a later artifact fails')
    const published=Object.fromEntries(readFileSync(githubEnv,'utf8').trim().split(/\r?\n/).map(line=>{const split=line.indexOf('=');return [line.slice(0,split),line.slice(split+1)]}))
    assert.equal(published.TMPDIR,published.TMP,'Linux child temporary output must use the owned runtime too')
    const child=spawnSync(process.execPath,['-e',"const fs=require('node:fs'),os=require('node:os'),path=require('node:path');console.log(fs.mkdtempSync(path.join(os.tmpdir(),'bootstrap-child-')))"],{env:{...environment,...published},encoding:'utf8',windowsHide:true})
    assert.equal(child.status,0,child.stderr)
    assert.equal(child.stdout.trim().startsWith(published.TMPDIR),true)
    assert.equal(existsSync(resolve(fixture,'node_modules')),false)
    const cleanup=spawnSync(process.execPath,[resolve(root,'scripts/cleanup-contracts.mjs')],{env:{...environment,...published},encoding:'utf8',windowsHide:true})
    assert.equal(cleanup.status,0,cleanup.stdout+cleanup.stderr)
    assert.equal(existsSync(published.NETCIRCUIT_ARTIFACTS_SESSION),false)
  }finally{
    if(existsSync(sessions))for(const name of readdirSync(sessions))if(name.startsWith('netcircuit-'))cleanupArtifactSession(resolve(sessions,name))
  }
})
test('the canonical NCAP layout and E2E graph come from the exact pinned resource release',()=>{
  assert.equal(readContractsResource('physical-hc08-led').schema_version,'1.1')
  assert.equal(readContractsResource('capture-layout').prefix.magic_hex,'4e434150')
  assert.equal(Object.keys(readContractsResource('logic-pinouts')).length,37)
})
test('the SDK tarball carries public resources and excludes private contract descendants',()=>{
  const bytes=verifyBytes(readFileSync(resolve(root,'.artifacts',lock.npm.filename)),lock.npm.sha256)
  const metadata=JSON.parse(archiveEntry(bytes,'package/package.json'))
  assert.equal(metadata.version,lock.contractsVersion)
  const schema=JSON.parse(archiveEntry(bytes,'package/dist/schemas/transport.json'))
  for(const name of ['InstrumentationExecutionPlan','StationCapabilities','FpgaControlScaffold'])assert.doesNotMatch(JSON.stringify(schema,(key,value)=>['description','$comment'].includes(key)?undefined:value),new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`))
})
