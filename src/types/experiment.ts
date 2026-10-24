import type { ExperimentRecord } from '@tinihi-labs/contracts/dto'
export type { ExperimentCreateV2 as ExperimentInput } from '@tinihi-labs/contracts/dto'
export type Experiment = ExperimentRecord
export type ExperimentState = 'idle' | ExperimentRecord['state']
