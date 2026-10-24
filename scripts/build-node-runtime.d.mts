export type NodeRuntimeKind='contacts'|'sealed'|'labels'|'flexible'
export function buildNodeRuntime(options:import('esbuild').BuildOptions):Promise<import('esbuild').BuildResult>
export function loadNodeRuntime(kind:NodeRuntimeKind,filename?:string,options?:{resolveDir?:string}):Promise<unknown>
