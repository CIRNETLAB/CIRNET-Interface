/** Executable bootstrap entrypoint; pure resource readers never import this file. */
import {bootstrap} from './contracts-artifacts.mjs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const args=process.argv.slice(2),options={manifestPath:process.env.NETCIRCUIT_CONTRACTS_ARTIFACT_MANIFEST}
    while(args.length){const flag=args.shift();if(flag==='--manifest')options.manifestPath=args.shift();else if(flag==='--github-env')options.githubEnv=args.shift();else throw Error(`Unknown bootstrap option: ${flag}`);if(!args.length&&['--manifest','--github-env'].includes(flag)&&!(flag==='--manifest'?options.manifestPath:options.githubEnv))throw Error(`Missing value for ${flag}`)}
    console.log(JSON.stringify(await bootstrap(options)))
  }catch(error){console.error(`contracts-bootstrap: ${error.message}`);process.exitCode=1}
}
