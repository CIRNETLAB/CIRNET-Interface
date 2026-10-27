import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync,existsSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
function sources(directory){return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?sources(resolve(directory,entry.name)):/\.(?:ts|vue|mjs)$/.test(entry.name)?[resolve(directory,entry.name)]:[])}
test('the independent product consumes SDK entrypoints rather than generated source copies',()=>{
  assert.equal(existsSync(resolve(root,'src/contracts/generated')),false,'canonical generation belongs to Contracts')
  for(const file of sources(resolve(root,'src'))){
    const text=readFileSync(file,'utf8')
    assert.doesNotMatch(text,/["'][^"']*contracts\/generated\//,file)
    assert.doesNotMatch(text,/["'][^"']*net-Circuit-(?:Remote|Contracts)[/\\]/,file)
  }
})
test('all generic catalog projections come from the pinned public package',()=>{
  for(const name of ['breadboardMechanics','breadboardTopologies','editorCatalog','editorParts','flexibleMechanics','labContracts','physicalParts','signalPortCatalog']){
    assert.equal(existsSync(resolve(root,`src/data/${name}.json`)),false,name)
  }
  const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'))
  assert.equal(pkg.dependencies['@tinihi-labs/contracts'],'file:.artifacts/tinihi-labs-contracts-0.1.1.tgz')
})
