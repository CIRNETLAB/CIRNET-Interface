import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync,execFileSync} from 'node:child_process'
import {getArtifactDirectory} from './artifact-paths.mjs'

const product=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const python=process.env.NETCIRCUIT_RELEASE_PYTHON??'python'

test('release exports committed source and static bytes reproducibly and rejects dirty provenance',()=>{
  const owned=mkdtempSync(resolve(getArtifactDirectory('interface-export-regression'),'case-')),source=resolve(owned,'source')
  mkdirSync(resolve(source,'dist'),{recursive:true})
  writeFileSync(resolve(source,'package.json'),JSON.stringify({name:'@net-circuit/web',version:'0.1.1'}))
  writeFileSync(resolve(source,'.gitignore'),'dist/\n')
  writeFileSync(resolve(source,'source.txt'),'committed source\n')
  for(const page of ['index.html','oscilloscope-preview.html','function-generator-preview.html'])writeFileSync(resolve(source,'dist',page),`<title>${page}</title>`)
  const git=(...args)=>execFileSync('git',['-C',source,...args],{encoding:'utf8',windowsHide:true})
  git('init');git('config','core.autocrlf','true');git('config','user.email','release-test@example.invalid');git('config','user.name','Release fixture')
  git('remote','add','origin','https://github.com/example/fixture.git');git('add','.');git('commit','-m','Synthetic release fixture')
  const invoke=directory=>spawnSync(python,['-B',resolve(product,'scripts/build_release.py'),'--source-root',source,'--output-directory',directory],{encoding:'utf8',windowsHide:true})
  const a=invoke(resolve(owned,'one')),b=invoke(resolve(owned,'two'))
  assert.equal(a.status,0,a.stderr);assert.equal(b.status,0,b.stderr)
  const first=JSON.parse(a.stdout),second=JSON.parse(b.stdout)
  for(const kind of ['source','static'])assert.equal(first.artifacts[kind].sha256,second.artifacts[kind].sha256)
  const archive=first.artifacts.source.path
  const metadata=JSON.parse(execFileSync('tar',['-xzOf',archive,'interface-artifact.json'],{encoding:'utf8',windowsHide:true}))
  assert.equal(metadata.source.revision,git('rev-parse','HEAD').trim())
  assert.equal(metadata.source.uncommittedMigration,false)
  assert.equal(metadata.version,'0.1.1');assert.equal(metadata.contractsVersion,'0.1.1')
  assert.equal(execFileSync('tar',['-xzOf',archive,'source.txt'],{encoding:'utf8',windowsHide:true}),'committed source\n')
  writeFileSync(resolve(source,'source.txt'),'dirty source\n')
  const dirty=invoke(resolve(owned,'dirty'))
  assert.notEqual(dirty.status,0);assert.match(dirty.stderr,/clean committed/)
})
