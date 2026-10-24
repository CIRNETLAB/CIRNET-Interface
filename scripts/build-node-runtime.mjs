import {build} from 'esbuild'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
import {getArtifactDirectory} from './artifact-paths.mjs'

const sources=Object.freeze({
  contacts:"export * from './src/data/partCatalog'; export {solveMounting} from './src/electrical/mounting'; export {boardContactMechanics} from './src/geometry/BreadboardMechanicalProfile'; export {defaultWireVisual} from './src/wires/wireVisual'; export {WIRE_RADIAL_SEGMENTS} from './src/wires/wireAppearance'",
  sealed:"export * from './src/data/partCatalog'; export {solveMounting} from './src/electrical/mounting'; export {solveFlexibleMount} from './src/electrical/flexibleGeometry'",
  labels:"export {getPartForType, physicalDescriptorForPart} from './src/data/partCatalog'",
  flexible:"export {solveFlexibleMount} from './src/electrical/flexibleGeometry'",
})

/** Build a Node runtime that remains executable outside this installation. */
export function buildNodeRuntime(options){
  // Node builtins remain external automatically. Package resources must travel
  // with the bundle because its external output has no product node_modules.
  return build({...options,bundle:true,platform:'node',format:'esm',packages:'bundle'})
}

/** Execute the application's real catalog/geometry from an owned Node bundle. */
export async function loadNodeRuntime(kind,filename,{resolveDir=process.cwd()}={}){
  if(!Object.hasOwn(sources,kind))throw Error('Unknown native E2E runtime.')
  filename??=resolve(getArtifactDirectory('native-node-runtimes'),`${kind}-${process.pid}.mjs`)
  await buildNodeRuntime({stdin:{contents:sources[kind],resolveDir,loader:'ts'},outfile:filename})
  return import(pathToFileURL(filename).href)
}
