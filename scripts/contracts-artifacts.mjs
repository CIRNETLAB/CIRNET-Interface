/** Bootstrap immutable DEV tooling before creating any diagnostic output. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,appendFileSync,realpathSync,lstatSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {resolve,dirname,relative,isAbsolute} from 'node:path'
import {fileURLToPath} from 'node:url'

export const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
export const lock=JSON.parse(readFileSync(resolve(root,'integration/contracts-artifacts.json'),'utf8'))
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
export function checkedHttps(value){
  const url=new URL(value)
  if(url.protocol!=='https:'||url.username||url.password||url.pathname.toLowerCase().split('/').includes('latest'))throw Error('Artifact requests require an immutable HTTPS URL without credentials.')
  return url
}
export function requestHeaders(value,token=process.env.NETCIRCUIT_ARTIFACTS_TOKEN){
  const url=checkedHttps(value),headers={'User-Agent':'netcircuit-interface-consumer'}
  if(url.hostname==='api.github.com'&&(!url.port||url.port==='443')&&/^\/repos\/[^/]+\/[^/]+\/releases\/assets\/[0-9]+$/.test(url.pathname)){
    headers.Accept='application/octet-stream'
    if(token)headers.Authorization=`Bearer ${token}`
  }
  return headers
}
export async function downloadArtifact(value,expected,fetcher=fetch){
  let url=checkedHttps(value),headers=requestHeaders(value)
  for(let redirects=0;redirects<=5;redirects++){
    const response=await fetcher(url,{headers,redirect:'manual',signal:AbortSignal.timeout(60_000)})
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get('location')
      await response.body?.cancel()
      if(!location)throw Error('Artifact redirect has no location.')
      url=checkedHttps(new URL(location,url).href)
      // Authentication belongs only to the initial GitHub API request.
      headers={'User-Agent':'netcircuit-interface-consumer'}
      continue
    }
    if(!response.ok)throw Error(`Artifact download failed (HTTP ${response.status}).`)
    const chunks=[];let length=0
    for await(const chunk of response.body){length+=chunk.length;if(length>64*1024*1024)throw Error('Artifact exceeds the bootstrap size limit.');chunks.push(chunk)}
    return verifyBytes(Buffer.concat(chunks),expected)
  }
  throw Error('Artifact redirect limit exceeded.')
}
export function verifyBytes(bytes,expected){
  if(!/^[0-9a-f]{64}$/.test(expected??'')||digest(bytes)!==expected)throw Error('Artifact SHA256 does not match the reviewed release lock.')
  return bytes
}
export function archiveEntry(bytes,path){
  return execFileSync('tar',['-xzOf','-',path],{input:bytes,windowsHide:true,maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']})
}
function cachePath(entry){return resolve(root,'.artifacts',entry.filename)}
function safeCache(){
  const directory=resolve(root,'.artifacts')
  if(existsSync(directory)&&lstatSync(directory).isSymbolicLink())throw Error('Artifact cache must not be a symlink.')
  mkdirSync(directory,{recursive:true})
  const location=relative(realpathSync(root),realpathSync(directory))
  if(isAbsolute(location)||location==='..'||location.startsWith('..'+(process.platform==='win32'?'\\':'/')))throw Error('Artifact cache escaped the product root.')
}
async function selectedBytes(key,manifest){
  const entry=lock[key],cached=cachePath(entry)
  if(existsSync(cached)){
    if(lstatSync(cached).isSymbolicLink())throw Error('Artifact cache entry must not be a symlink.')
    return verifyBytes(readFileSync(cached),entry.sha256)
  }
  if(manifest){
    const selected=manifest[key]
    if(!selected||selected.sha256!==entry.sha256)throw Error(`Manifest ${key} differs from the reviewed release lock.`)
    if(!isAbsolute(selected.path??''))throw Error('Local release manifest requires absolute artifact paths.')
    return verifyBytes(readFileSync(selected.path),entry.sha256)
  }
  const url=process.env[entry.urlEnvironment]
  if(!url)throw Error(`Provide --manifest ABSOLUTE_M1_MANIFEST or ${entry.urlEnvironment}; publication/access has not been established.`)
  return downloadArtifact(url,entry.sha256)
}
export async function bootstrap({manifestPath,githubEnv}={}){
  if(manifestPath&&!isAbsolute(manifestPath))throw Error('The release manifest path must be absolute.')
  const manifest=manifestPath?JSON.parse(readFileSync(resolve(manifestPath),'utf8')):undefined
  const dev=await selectedBytes('dev_npm',manifest)
  const metadata=JSON.parse(archiveEntry(dev,'package/package.json').toString('utf8'))
  if(metadata.name!==lock.dev_npm.name||metadata.version!==lock.dev_npm.version)throw Error('DEV artifact package identity differs from its lock.')
  const canonical=verifyBytes(archiveEntry(dev,'package/netcircuit_artifact_paths/artifact-paths.mjs'),lock.dev_npm.nodeSha256)
  const context=process.env.NETCIRCUIT_ARTIFACTS_CONTEXT??JSON.stringify({owner:`git:${realpathSync(root)}`,roots:[realpathSync(root)]})
  const allocatorEnvironment={...process.env,NETCIRCUIT_ARTIFACTS_CONTEXT:context}
  const allocation=execFileSync(process.execPath,['--input-type=module'],{
    input:Buffer.concat([canonical,Buffer.from('\nconsole.log(JSON.stringify({artifactSession:getArtifactDirectory(),context:getArtifactContext()}))\n')]),
    cwd:root,env:allocatorEnvironment,encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe'],
  })
  const {artifactSession}=JSON.parse(allocation)
  const bootstrapDirectory=resolve(artifactSession,'bootstrap-dev')
  mkdirSync(bootstrapDirectory,{recursive:true})
  const bootstrapModule=resolve(bootstrapDirectory,'artifact-paths.mjs')
  if(existsSync(bootstrapModule))verifyBytes(readFileSync(bootstrapModule),lock.dev_npm.nodeSha256)
  else writeFileSync(bootstrapModule,canonical,{flag:'wx'})
  const environment={NETCIRCUIT_ARTIFACTS_CONTEXT:context,NETCIRCUIT_ARTIFACTS_SESSION:artifactSession,
    NETCIRCUIT_ARTIFACTS_BOOTSTRAP_MODULE:bootstrapModule,
    TMP:resolve(artifactSession,'tmp'),TEMP:resolve(artifactSession,'tmp'),TMPDIR:resolve(artifactSession,'tmp'),npm_config_cache:resolve(artifactSession,'npm-cache')}
  // Publish the owner and verified cleanup tooling before another download or
  // npm installation can fail. Cleanup does not depend on node_modules.
  if(githubEnv)for(const [name,value]of Object.entries(environment)){
    if(/[\r\n]/.test(value))throw Error('Bootstrap environment values must be single lines.')
    appendFileSync(githubEnv,`${name}=${value}\n`)
  }
  for(const directory of [environment.TMP,environment.npm_config_cache])mkdirSync(directory,{recursive:true})
  Object.assign(process.env,environment)
  const artifacts={dev_npm:dev,npm:await selectedBytes('npm',manifest),sdist:await selectedBytes('sdist',manifest)}
  const sdkMetadata=JSON.parse(archiveEntry(artifacts.npm,'package/package.json').toString('utf8'))
  if(sdkMetadata.name!==lock.npm.name||sdkMetadata.version!==lock.npm.version)throw Error('SDK package identity differs from its lock.')
  safeCache()
  for(const [key,bytes]of Object.entries(artifacts)){
    const destination=cachePath(lock[key])
    if(existsSync(destination))verifyBytes(readFileSync(destination),lock[key].sha256)
    else writeFileSync(destination,bytes,{flag:'wx'})
  }
  return {artifactSession,environment,contractsVersion:lock.contractsVersion,status:lock.status}
}
