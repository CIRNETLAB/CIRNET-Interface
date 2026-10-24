/** Test-only immutable package resources. Never import this module from src/. */
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {root,lock,verifyBytes,archiveEntry} from './contracts-artifacts.mjs'

const paths=Object.freeze({
  'physical-hc08-led':'contracts/circuit-schema/examples/physical-hc08-led.json',
  'capture-layout':'contracts/capture/layout.json',
  'logic-pinouts':'tests/fixtures/logic-pinouts.json',
  'legacy-hc08-metadata':'device-library/logic-ic/74hc08.json',
  'breadboard-metadata':'device-library/breadboards/generic-full-size.json',
  'canonical-editor-catalog':'device-library/editor/components.json',
  'canonical-physical-parts':'device-library/parts/physical-parts.json',
})
/** Read an exact allowlisted resource from the digest-verified 1.0.1 sdist. */
export function readContractsResource(name,{artifactPath=resolve(root,'.artifacts',lock.sdist.filename)}={}){
  if(!Object.hasOwn(paths,name))throw Error('Unknown released Contracts test resource.')
  const bytes=verifyBytes(readFileSync(artifactPath),lock.sdist.sha256)
  const path=`netcircuit_contracts-${lock.contractsVersion}/${paths[name]}`
  return JSON.parse(archiveEntry(bytes,path).toString('utf8'))
}
