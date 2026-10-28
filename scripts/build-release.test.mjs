import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync,execFileSync} from 'node:child_process'
import {getArtifactDirectory} from './artifact-paths.mjs'

const product=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const python=process.env.NETCIRCUIT_RELEASE_PYTHON??'python'
const pages=['index.html','oscilloscope-preview.html','function-generator-preview.html']

function fixture({omitPage,productVersion='0.1.2',contractsVersion='0.1.1'}={}){
  const owned=mkdtempSync(resolve(getArtifactDirectory('interface-export-regression'),'case-')),source=resolve(owned,'source')
  const sdkRoot=resolve(owned,'sdk','package'),sdistRoot=resolve(owned,'sdist','netcircuit_contracts-0.1.1')
  for(const directory of [resolve(source,'scripts'),resolve(source,'integration'),resolve(source,'dist'),sdkRoot,sdistRoot])mkdirSync(directory,{recursive:true})
  writeFileSync(resolve(sdkRoot,'package.json'),JSON.stringify({name:'@tinihi-labs/contracts',version:'0.1.1',type:'module',exports:'./index.mjs'}))
  writeFileSync(resolve(sdkRoot,'index.mjs'),"export const marker='reviewed SDK 0.1.1'\n")
  writeFileSync(resolve(sdistRoot,'PKG-INFO'),'Name: netcircuit-contracts\nVersion: 0.1.1\n')
  const sdk=resolve(owned,'sdk.tgz'),sdist=resolve(owned,'sdist.tar.gz')
  execFileSync('tar',['-czf',sdk,'-C',dirname(sdkRoot),'package'],{windowsHide:true})
  execFileSync('tar',['-czf',sdist,'-C',dirname(sdistRoot),'netcircuit_contracts-0.1.1'],{windowsHide:true})
  const lock=JSON.parse(readFileSync(resolve(product,'integration/contracts-artifacts.json'),'utf8'))
  lock.contractsVersion=contractsVersion
  lock.npm={...lock.npm,filename:'fixture-contracts.tgz',sha256:createHash('sha256').update(readFileSync(sdk)).digest('hex')}
  lock.sdist={...lock.sdist,filename:'fixture-contracts.tar.gz',sha256:createHash('sha256').update(readFileSync(sdist)).digest('hex')}
  writeFileSync(resolve(source,'integration/contracts-artifacts.json'),JSON.stringify(lock))
  for(const name of ['bootstrap-contracts.mjs','contracts-artifacts.mjs'])writeFileSync(resolve(source,'scripts',name),readFileSync(resolve(product,'scripts',name)))
  const dependency='file:.artifacts/fixture-contracts.tgz',integrity='sha512-'+createHash('sha512').update(readFileSync(sdk)).digest('base64')
  writeFileSync(resolve(source,'package.json'),JSON.stringify({name:'@net-circuit/web',version:productVersion,scripts:{build:'node scripts/build.mjs'},dependencies:{'@tinihi-labs/contracts':dependency}}))
  writeFileSync(resolve(source,'package-lock.json'),JSON.stringify({name:'@net-circuit/web',version:productVersion,lockfileVersion:3,requires:true,packages:{
    '':{name:'@net-circuit/web',version:productVersion,dependencies:{'@tinihi-labs/contracts':dependency}},
    'node_modules/@tinihi-labs/contracts':{version:'0.1.1',resolved:dependency,integrity},
  }}))
  writeFileSync(resolve(source,'.gitignore'),'dist/\nnode_modules/\n.artifacts/\n')
  writeFileSync(resolve(source,'source.txt'),'committed source\n')
  writeFileSync(resolve(source,'scripts/build.mjs'),`
import {readFileSync,writeFileSync,mkdirSync,appendFileSync,existsSync} from 'node:fs'
import {marker} from '@tinihi-labs/contracts'
const text=readFileSync('source.txt','utf8')
mkdirSync('dist',{recursive:true})
for(const page of ${JSON.stringify(pages.filter(page=>page!==omitPage))})writeFileSync('dist/'+page,'<title>'+page+'</title>\\n'+text+marker+'\\n')
appendFileSync(process.env.NETCIRCUIT_RELEASE_TEST_RECEIPT,JSON.stringify({cwd:process.cwd(),text,marker,git:existsSync('.git')})+'\\n')
`)
  for(const page of pages)writeFileSync(resolve(source,'dist',page),'stale ignored bundle')
  const manifest=resolve(owned,'inputs.json'),receipt=resolve(owned,'build-receipt.jsonl')
  writeFileSync(manifest,JSON.stringify({npm:{path:sdk,sha256:lock.npm.sha256},sdist:{path:sdist,sha256:lock.sdist.sha256},
    dev_npm:{path:resolve(product,'.artifacts',lock.dev_npm.filename),sha256:lock.dev_npm.sha256}}))
  const git=(...args)=>execFileSync('git',['-C',source,...args],{encoding:'utf8',windowsHide:true})
  git('init');git('config','core.autocrlf','true');git('config','user.email','release-test@example.invalid');git('config','user.name','Release fixture')
  git('remote','add','origin','https://github.com/example/fixture.git');git('add','.');git('commit','-m','Synthetic release fixture')
  const invoke=(directory,...args)=>spawnSync(python,['-B',resolve(product,'scripts/build_release.py'),'--source-root',source,'--output-directory',directory,...args],{
    env:{...process.env,NETCIRCUIT_CONTRACTS_ARTIFACT_MANIFEST:manifest,NETCIRCUIT_RELEASE_TEST_RECEIPT:receipt},encoding:'utf8',windowsHide:true,
  })
  return {owned,source,git,invoke,receipt}
}

test('release builds the exact committed export with locked SDK installation, ignoring stale dist, reproducibly',()=>{
  const {owned,source,git,invoke,receipt}=fixture()
  const a=invoke(resolve(owned,'one')),b=invoke(resolve(owned,'two'))
  assert.equal(a.status,0,a.stderr);assert.equal(b.status,0,b.stderr)
  const first=JSON.parse(a.stdout),second=JSON.parse(b.stdout)
  for(const kind of ['source','static'])assert.equal(first.artifacts[kind].sha256,second.artifacts[kind].sha256)
  assert.equal(first.version,'0.1.2');assert.equal(first.contractsVersion,'0.1.1')
  const archive=first.artifacts.source.path
  const metadata=JSON.parse(execFileSync('tar',['-xzOf',archive,'interface-artifact.json'],{encoding:'utf8',windowsHide:true}))
  assert.equal(metadata.source.revision,git('rev-parse','HEAD').trim())
  assert.equal(metadata.source.uncommittedMigration,false)
  assert.equal(metadata.version,'0.1.2');assert.equal(metadata.contractsVersion,'0.1.1')
  const staticMetadata=JSON.parse(execFileSync('tar',['-xzOf',first.artifacts.static.path,'interface-artifact.json'],{encoding:'utf8',windowsHide:true}))
  assert.equal(staticMetadata.version,'0.1.2');assert.equal(staticMetadata.contractsVersion,'0.1.1')
  assert.equal(execFileSync('tar',['-xzOf',archive,'source.txt'],{encoding:'utf8',windowsHide:true}),'committed source\n')
  for(const page of pages)assert.equal(execFileSync('tar',['-xzOf',first.artifacts.static.path,page],{encoding:'utf8',windowsHide:true}),`<title>${page}</title>\ncommitted source\nreviewed SDK 0.1.1\n`)
  const builds=readFileSync(receipt,'utf8').trim().split('\n').map(line=>JSON.parse(line))
  assert.equal(builds.length,2)
  assert.notEqual(builds[0].cwd,builds[1].cwd,'each build needs a fresh exported source tree')
  for(const build of builds){assert.notEqual(resolve(build.cwd),source);assert.equal(build.git,false);assert.equal(build.text,'committed source\n');assert.equal(build.marker,'reviewed SDK 0.1.1')}
  assert.equal(readFileSync(resolve(source,'dist/index.html'),'utf8'),'stale ignored bundle')
  assert.equal(existsSync(resolve(source,'node_modules')),false)
  writeFileSync(resolve(source,'source.txt'),'dirty source\n')
  const dirty=invoke(resolve(owned,'dirty'))
  assert.notEqual(dirty.status,0);assert.match(dirty.stderr,/clean committed/)
})

test('release rejects arbitrary caller-provided static roots rather than stamping them with HEAD',()=>{
  const {owned,invoke}=fixture(),arbitrary=resolve(owned,'arbitrary')
  mkdirSync(arbitrary)
  for(const page of pages)writeFileSync(resolve(arbitrary,page),'unrelated static input')
  const result=invoke(resolve(owned,'output'),'--static-root',arbitrary)
  assert.notEqual(result.status,0)
  assert.match(result.stderr,/unrecognized arguments.*--static-root/)
})

test('the freshly executed build must still produce all three production entrypoints',()=>{
  const {owned,invoke}=fixture({omitPage:'function-generator-preview.html'})
  const result=invoke(resolve(owned,'output'))
  assert.notEqual(result.status,0)
  assert.match(result.stderr,/Missing production entrypoint.*function-generator-preview\.html/)
})

test('release rejects a stale Interface product without advancing its Contracts version',()=>{
  const {owned,invoke}=fixture({productVersion:'0.1.1'})
  const result=invoke(resolve(owned,'output'))
  assert.notEqual(result.status,0)
  assert.match(result.stderr,/Committed Interface product metadata must be @net-circuit\/web==0\.1\.2/)
})

test('release rejects a bootstrap that reports the Interface patch as its Contracts version',()=>{
  const {owned,invoke}=fixture({contractsVersion:'0.1.2'})
  const result=invoke(resolve(owned,'output'))
  assert.notEqual(result.status,0)
  assert.match(result.stderr,/Committed bootstrap must select the exact Contracts version/)
})
