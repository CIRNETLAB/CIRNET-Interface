/** The pinned DEV package owns every path and cleanup rule. */
import * as allocator from '@tinihi-labs/artifact-paths'
import {realpathSync} from 'node:fs'
import {resolve,dirname,basename} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..'))
const context=value=>value===undefined&&!process.env.NETCIRCUIT_ARTIFACTS_CONTEXT?{owner:`git:${root}`,roots:[root]}:value
export function getArtifactContext(options={}) {return allocator.getArtifactContext({...options,context:context(options.context)})}
export function getArtifactDirectory(subdirectory='',options={}) {return allocator.getArtifactDirectory(subdirectory,{...options,context:context(options.context)})}
export function validateArtifactDirectory(directory,options={}) {return allocator.validateArtifactDirectory(directory,{...options,context:context(options.context)})}
export function cleanupArtifactSession(directory,options={}) {return allocator.cleanupArtifactSession(directory,{...options,context:context(options.context)})}
export function runArtifactCli(args=process.argv.slice(2)) {
 const selected=[...args]
 if(!selected.includes('--context')&&!process.env.NETCIRCUIT_ARTIFACTS_CONTEXT)selected.push('--context',JSON.stringify(context()))
 return allocator.runArtifactCli(selected)
}
export const runCli=runArtifactCli
if(process.argv[1]&&basename(process.argv[1])==='artifact-paths.mjs'&&resolve(process.argv[1])===fileURLToPath(import.meta.url))runArtifactCli()
