import 'fake-indexeddb/auto'
import { describe } from 'vitest'
import { registerAccountImportTransactionsFixture } from './accountImportTransactionsFixture'

import { registerAccountImportTransactionsCases1 } from './accountImportTransactionsCases1'

import { registerAccountImportTransactionsCases2 } from './accountImportTransactionsCases2'

import { registerAccountImportTransactionsCases3 } from './accountImportTransactionsCases3'

import { registerAccountImportTransactionsCases4 } from './accountImportTransactionsCases4'

import { registerAccountImportTransactionsCases5 } from './accountImportTransactionsCases5'

describe('asset quick read isolated account transactions', () => {
  const fixture = registerAccountImportTransactionsFixture()
  registerAccountImportTransactionsCases1(fixture)
  registerAccountImportTransactionsCases2(fixture)
  registerAccountImportTransactionsCases3(fixture)
  registerAccountImportTransactionsCases4(fixture)
  registerAccountImportTransactionsCases5(fixture)
})
