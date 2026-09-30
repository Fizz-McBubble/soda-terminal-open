#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectionTests = spawnSync(
  process.execPath,
  ['--test', resolve(root, 'build/communitySourceProjection.node-test.mjs')],
  {
    cwd: root,
    stdio: 'inherit',
  },
)
if (projectionTests.status !== 0) process.exit(projectionTests.status ?? 1)
const result = spawnSync(
  process.execPath,
  [
    resolve(root, 'node_modules/vitest/vitest.mjs'),
    'run',
    '--config',
    'vite.config.ts',
    'src/testing/publicCalculationTransport.test.ts',
    'src/application/publicWarehouseActionTransport.test.ts',
    'src/application/publicDataProjection.test.ts',
    'src/assets/publicVisualAssets.test.ts',
    'src/application/browserCalculationQueryClient.test.ts',
    'src/application/accountDecisionWorld.loading.test.tsx',
    'src/pages/WarehouseDiscsPage.loading.test.tsx',
    'src/application/browserAccountDecisionWorker.test.ts',
    'src/application/localCalculationQueryClient.worker-lifecycle.test.ts',
    'src/accounts/backup.restore-validation.test.ts',
    'src/pages/HelpAndPrivacyPage.test.tsx',
    'src/warehouse/absoluteDiscRetention.test.ts',
    'src/warehouse/approvedRarityRetention.test.ts',
    'src/warehouse/reviewedRetentionActionKits.test.ts',
    'src/warehouse/absoluteDiscRetentionUseFacts.test.ts',
    'src/warehouse/absoluteDiscRetentionStages.test.ts',
    'src/warehouse/absoluteDiscRetentionFunctionalGrowth.test.ts',
    'src/warehouse/absoluteDiscRetentionCompiler.test.ts',
    'src/warehouse/discWarehouseProtection.test.tsx',
    'src/accounts/repository.protection-zero-write.test.ts',
    'src/warehouse/absoluteDiscRetentionFactsMatrix.test.ts',
    'src/pages/WarehouseRetentionEvidence.test.tsx',
    'src/pages/WarehouseActionDrawer.test.tsx',
    'src/pages/warehouseDiscFilters.retention.test.ts',
    'src/pages/warehouseDiscPresentation.test.ts',
    'src/domain/scanMainStatDisplay.test.ts',
    'src/offline/serviceWorker.test.ts',
    'scripts/prepare-community-shell.test.ts',
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      VITE_SODA_PUBLIC_BUILD: 'false',
      VITE_SODA_COMMUNITY_BUILD: 'true',
      SODA_DERIVED_ROOT: resolve(root, 'node_modules/.tmp/soda-derived'),
    },
    stdio: 'inherit',
  },
)
process.exit(result.status ?? 1)
