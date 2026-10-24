import {defineConfig} from '@playwright/test'
import base from './playwright.config'
// The common launcher owns Vite, external reports and the copied browser runtime.
export default defineConfig({...base,testMatch:'depth-artifacts.spec.ts',workers:1,timeout:360000,use:{...base.use,viewport:{width:1916,height:908}}})
