import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { createAccount, setActiveAccount } from '../accounts/repository'
import { database } from '../db/database'
import { refreshScanBatchManifestPayloadHash } from '../domain/scanImportStaging'
import { sanitizeScanFeedbackPayload } from '../../deploy/cloudflare/scan-feedback.mjs'
import { lastScanDiagnosticKey } from '../scanner/scanFeedback'
import {
  createScannerTargetAccountBinding,
  saveScannerTargetAccountBinding,
} from '../scanner/targetAccountBinding'
import { createScannerRuntimeSnapshot } from './scannerAssistantTestFixture'
import {
  cleanupScannerPageTestDatabase,
  createReadyScannerStaging,
  createScannerRuntimeCommands,
  resetScannerPageTestDatabase,
} from './scannerAssistantPageTestSupport'

const runtime = vi.hoisted(() => ({ snapshot: {} as Record<string, unknown> }))
const commands = createScannerRuntimeCommands(vi.fn)
vi.mock('../scanner/runtime', () => ({
  useScannerAssistantRuntime: () => ({ snapshot: runtime.snapshot, commands }),
}))
vi.mock('../scanner/detailEvidenceClient', () => ({
  requestScannerDetailEvidence: vi.fn().mockRejectedValue(new Error('sample image unavailable')),
}))

describe('completed scan with rejected OCR records', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await resetScannerPageTestDatabase()
    window.history.pushState({}, '', '/system/scanner')
  })
  afterEach(async () => {
    vi.unstubAllGlobals()
    await cleanupScannerPageTestDatabase()
  })

  it.each(['missing-fields', 'invalid-only', 'missing-fields-without-native'] as const)(
    'offers useful opt-in diagnostics, retry and persistent receipt for %s without importing',
    async (kind) => {
      const user = userEvent.setup()
      const account = await createAccount('诊断回归测试', database, { id: 'account-review-test' })
      await setActiveAccount(account.id, database)
      const binding = createScannerTargetAccountBinding({ account, baselineDiscCount: 0 })
      saveScannerTargetAccountBinding(binding)
      const missingFields = kind !== 'invalid-only'
      const staging = createReadyScannerStaging(missingFields ? 12 : 1)
      const blocked = missingFields ? 11 : 1
      for (const item of staging.items.slice(0, blocked)) {
        item.candidate = structuredClone(item.candidate)
        if (missingFields) {
          item.candidate.setId = null
          item.candidate.setName = 'private-unrecognized-name'
          item.candidate.subStats[0].value = null
        } else item.candidate.mainStatValue = 98765
      }
      staging.batch.manifest = refreshScanBatchManifestPayloadHash(staging.batch, staging.items)
      runtime.snapshot = {
        ...createScannerRuntimeSnapshot('completed'),
        summary: {
          reliable: staging.items.length,
          needsReview: 0,
          unreadable: 0,
          uniqueRecords: staging.items.length,
          resultStatus: 'ready_for_review',
          resultFileHandle: 'local-staging.json',
        },
        diagnostics: {
          reportId: '54f4351c-3ef6-4fc6-9493-7073c8114287',
          outcome: 'completed',
          code: 'none',
          stage: 'result',
          versions: { helper: '2.3.9', ocr: 'PP-OCRv6' },
          counts: { processed: staging.items.length, total: staging.items.length, failed: 0 },
          durationMs: 12000,
          environment: { width: 2560, height: 1440 },
          evidence: {},
        },
      }
      if (kind === 'missing-fields-without-native') delete runtime.snapshot.diagnostics
      if (kind === 'missing-fields' && process.env.SODA_SCANNER_REVIEW_FIXTURE) {
        const path = process.env.SODA_SCANNER_REVIEW_FIXTURE
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(
          path,
          JSON.stringify({ snapshot: runtime.snapshot, staging, account, binding }),
        )
      }
      commands.requestResultStaging.mockResolvedValue(staging)
      const requests: Record<string, unknown>[] = []
      const fetcher = vi.fn(async (_input: unknown, init?: RequestInit) => {
        const report = JSON.parse(String(init?.body))
        requests.push(report)
        expect(sanitizeScanFeedbackPayload(report)).toEqual({ ok: true, record: report })
        return requests.length === 1
          ? new Response('temporary failure', { status: 503 })
          : new Response(
              JSON.stringify({
                status: 'received',
                reportId: report.reportId,
                receivedAt: '2026-10-09T12:00:00.000Z',
              }),
              { status: 201 },
            )
      })
      vi.stubGlobal('fetch', fetcher)
      const before = await database.accounts.toArray()
      const view = render(<App />)
      await user.click(
        await screen.findByRole('button', { name: '查看扫描结果' }, { timeout: 10_000 }),
      )
      await screen.findByText(new RegExp(`${blocked} 张需要校准`))
      expect(
        screen.getByLabelText('扫描与导入进度').querySelector('[aria-current="step"]'),
      ).toHaveTextContent('检查')
      expect(screen.getByLabelText('未通过检查的原因')).toHaveTextContent(
        missingFields ? '套装名称未确认：11 张' : '词条或等级校验未通过：1 张',
      )
      expect(screen.queryByRole('button', { name: '确认更新驱动盘' })).not.toBeInTheDocument()
      expect(fetcher).not.toHaveBeenCalled()
      expect(screen.getAllByRole('button', { name: '反馈此问题' })).toHaveLength(1)
      await user.click(screen.getByRole('button', { name: '反馈此问题' }))
      await screen.findByText('发送失败，请再试一次。')
      await user.click(screen.getByRole('button', { name: '反馈此问题' }))
      await screen.findByText('反馈已收到，谢谢。')
      expect(requests[1]).toMatchObject({
        code: 'scan_import_review_required',
        outcome: 'failed',
        stage: 'import',
        counts: { reviewRequired: blocked },
        versions: kind === 'missing-fields-without-native' ? {} : { helper: '2.3.9' },
      })
      expect(requests[1].versions).toEqual(
        kind === 'missing-fields-without-native' ? {} : { helper: '2.3.9', ocr: 'PP-OCRv6' },
      )
      expect(JSON.stringify(requests)).not.toMatch(
        /private-unrecognized-name|98765|account-review-test|detailPath|rawText/,
      )
      expect(JSON.parse(localStorage.getItem(lastScanDiagnosticKey)!)).toMatchObject(requests[1])
      view.unmount()
      render(<App />)
      await user.click(
        await screen.findByRole('button', { name: '查看扫描结果' }, { timeout: 10_000 }),
      )
      await waitFor(() => expect(screen.getByRole('button', { name: '已反馈' })).toBeDisabled())
      expect(requests).toHaveLength(2)
      expect(await database.accounts.toArray()).toEqual(before)
      expect(await database.accountDriveDiscs.count()).toBe(0)
      await user.click(screen.getByRole('button', { name: '返回准备，重新扫描' }))
      await screen.findByRole('heading', { name: '确认账户，然后开始本地扫描' })
      expect(
        screen.getByLabelText('扫描与导入进度').querySelector('[aria-current="step"]'),
      ).toHaveTextContent('准备')
      expect(screen.queryByRole('button', { name: '已反馈' })).not.toBeInTheDocument()
      expect(commands.startScan).not.toHaveBeenCalled()
    },
  )
})
