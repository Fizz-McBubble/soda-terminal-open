#!/usr/bin/env node
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertCurrentPlanningConsumerPolicyIdentity,
  currentPlanningConsumerPolicyGeneratedPath,
  writeCurrentPlanningConsumerPolicyIdentity,
} from '../build/communityConsumerPolicySourceHashes.mjs'

const appRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))

export function runCurrentPlanningConsumerPolicyIdentityGenerator(args = []) {
  if (args.includes('--check')) {
    const identity = assertCurrentPlanningConsumerPolicyIdentity({ root: appRoot })
    return { mode: 'check', identity, path: currentPlanningConsumerPolicyGeneratedPath(appRoot) }
  }
  const identity = writeCurrentPlanningConsumerPolicyIdentity({ root: appRoot })
  return { mode: 'write', identity, path: currentPlanningConsumerPolicyGeneratedPath(appRoot) }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = runCurrentPlanningConsumerPolicyIdentityGenerator(process.argv.slice(2))
    console.log(
      JSON.stringify({
        ok: true,
        mode: result.mode,
        path: result.path,
        sourceHashes: Object.keys(result.identity.sourceHashes).length,
      }),
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
