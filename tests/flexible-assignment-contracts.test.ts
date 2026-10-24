import {test} from 'node:test'
import assert from 'node:assert/strict'
import corpus from '@tinihi-labs/contracts/fixtures/assignment-v2-conformance.json' with { type: 'json' }
import {parseLab,ContractValidationError} from '../src/contracts/validation'
import type {ContractMap} from '@tinihi-labs/contracts/dto'

for(const item of corpus.cases)test(`assignment 2.0 parity: ${item.id}`,()=>{
 if(item.valid)assert.deepEqual(parseLab(item.contract as keyof ContractMap,item.value),item.value)
 else assert.throws(()=>parseLab(item.contract as keyof ContractMap,item.value),(error:unknown)=>{
  assert.ok(error instanceof ContractValidationError)
  if('code' in item){assert.equal(error.issues[0]!.code,item.code);assert.equal(error.issues[0]!.path,item.path)}
  return true
 })
})
