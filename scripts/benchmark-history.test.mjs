import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {loadHistoricalSources, BASELINE_REF, SOURCE_PATHS} from './benchmark-history.mjs'

const root=fileURLToPath(new URL('../',import.meta.url))
const unavailable=()=>{throw Error('Original Git history unavailable')}
test('standalone benchmark loads both exact pinned original source fixtures without Git ancestry',async()=>{
  const history=await loadHistoricalSources(root,BASELINE_REF,{git:unavailable})
  assert.equal(history.ref,BASELINE_REF)
  assert.equal(history.origin,'verified source fixtures')
  assert.deepEqual([...history.sources.keys()],SOURCE_PATHS)
  assert.match(history.sources.get(SOURCE_PATHS[0]),/searchComponents/)
  assert.match(history.sources.get(SOURCE_PATHS[1]),/createPackageThumbnailCache/)
})
test('available original Git history is preferred and resolves its full source revision',async()=>{
  const history=await loadHistoricalSources(root,BASELINE_REF,{git:(...args)=>{
    if(args[0]==='rev-parse')return BASELINE_REF
    const original=args[1].slice(BASELINE_REF.length+1)
    return readFile(resolve(root,'tests/fixtures/historical',BASELINE_REF,original.replace('apps/web/','')),'utf8')
  }})
  assert.equal(history.origin,'original Git history')
  assert.equal(history.ref,BASELINE_REF)
})
test('unavailable nondefault historical revision cannot silently reuse pinned source',async()=>{
  await assert.rejects(loadHistoricalSources(root,'1234567',{git:unavailable}),/No verified source fixture/)
})
test('modified fallback source bytes fail integrity validation before benchmarking',async()=>{
  await assert.rejects(loadHistoricalSources(root,BASELINE_REF,{git:unavailable,read:async(filename,...args)=>{
    const bytes=await readFile(filename,...args)
    return String(filename).endsWith('componentSearch.ts')?Buffer.concat([Buffer.from(bytes),Buffer.from(' ')]):bytes
  }}),/Historical source hash mismatch/)
})
