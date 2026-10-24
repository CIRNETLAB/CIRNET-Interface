import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'

export const BASELINE_REF='40a4cad80be76a5b08943fab51ee2218cb7d7012'
export const SOURCE_PATHS=['apps/web/src/data/componentSearch.ts','apps/web/src/three/PackageThumbnails.ts']
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')

/** Original commit IDs change during path filtering. The pinned source fixtures
 * retain exact original bytes, rather than reimplementing either baseline. */
export async function loadHistoricalSources(root,ref=BASELINE_REF,options={}) {
  const git=options.git??((...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}))
  const read=options.read??readFile
  let resolved,sources,origin
  try {
    resolved=String(await git('rev-parse',ref)).trim()
    sources=new Map(await Promise.all(SOURCE_PATHS.map(async file=>[file,String(await git('show',`${ref}:${file}`))])))
    origin='original Git history'
  } catch(error) {
    assert.equal(ref,BASELINE_REF,`No verified source fixture for unavailable historical revision ${ref}`)
    resolved=BASELINE_REF
    origin='verified source fixtures'
  }
  if(ref===BASELINE_REF) {
    const folder=resolve(root,'tests/fixtures/historical',BASELINE_REF)
    const manifest=JSON.parse(await read(resolve(folder,'manifest.json'),'utf8'))
    assert.equal(manifest.sourceRevision,BASELINE_REF)
    assert.deepEqual(manifest.files.map(entry=>entry.sourcePath),SOURCE_PATHS)
    const verified=new Map()
    for(const entry of manifest.files) {
      assert.equal(entry.file,entry.sourcePath.replace('apps/web/',''))
      const bytes=sources?Buffer.from(sources.get(entry.sourcePath)):await read(resolve(folder,entry.file))
      assert.equal(digest(bytes),entry.sha256,`Historical source hash mismatch: ${entry.sourcePath}`)
      const source=Buffer.from(bytes).toString('utf8').trimEnd()
      assert.equal(digest(source),entry.trimmedSha256)
      verified.set(entry.sourcePath,source)
    }
    sources=verified
  }
  return {ref:resolved,origin,sources:new Map([...sources].map(([file,source])=>[file,source.trimEnd()]))}
}
