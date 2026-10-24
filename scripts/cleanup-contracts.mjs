/** Failure-safe cleanup using bootstrap tooling, including failed npm ci. */
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {lock,verifyBytes} from './contracts-artifacts.mjs'

try{
  const session=process.env.NETCIRCUIT_ARTIFACTS_SESSION
  if(session){
    const expected=resolve(session,'bootstrap-dev/artifact-paths.mjs')
    const selected=process.env.NETCIRCUIT_ARTIFACTS_BOOTSTRAP_MODULE
    if(!selected||resolve(selected)!==expected)throw Error('Cleanup requires the module published by the owning bootstrap.')
    verifyBytes(readFileSync(selected),lock.dev_npm.nodeSha256)
    execFileSync(process.execPath,[selected,'--cleanup',session],{env:process.env,stdio:'inherit',windowsHide:true})
  }
}catch(error){console.error(`contracts-cleanup: ${error.message}`);process.exitCode=1}
