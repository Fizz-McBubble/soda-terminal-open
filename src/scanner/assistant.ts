import { resolveScanBatchManifest, scanImportStagingBatchSchema } from '../domain/scanImportStaging'

export type ScannerAssistantInput =
  | { kind: 'empty' }
  | {
      kind: 'screenshot'
      name: string
      type: string
      size: number
      width?: number
      height?: number
    }
  | { kind: 'json'; name: string; text: string }

export type ScannerAssistantAssessment = {
  state: 'idle' | 'needs_manual_structuring' | 'staging_ready' | 'blocked'
  title: string
  message: string
  canHandOff: boolean
  diagnostic: Record<string, unknown>
}

export function assessScannerAssistantInput(
  input: ScannerAssistantInput,
): ScannerAssistantAssessment {
  if (input.kind === 'empty')
    return {
      state: 'idle',
      title: '等待本地输入',
      message: '选择截图进行结构检查，或选择已有的扫描暂存 JSON。不会读取账户或启动导入。',
      canHandOff: false,
      diagnostic: { input: 'none', accountAccess: false, importAccess: false },
    }
  if (input.kind === 'screenshot') {
    const supported = input.type.startsWith('image/')
    const dimensionsReady = (input.width ?? 0) >= 1280 && (input.height ?? 0) >= 720
    if (!supported || !dimensionsReady)
      return {
        state: 'blocked',
        title: '截图结构不满足识别条件',
        message: '请使用清晰的驱动盘详情截图（至少 1280×720）。当前不会生成可导入 JSON。',
        canHandOff: false,
        diagnostic: {
          input: 'screenshot',
          name: input.name,
          type: input.type || 'unknown',
          size: input.size,
          width: input.width ?? null,
          height: input.height ?? null,
          reason: !supported ? 'unsupported_file_type' : 'insufficient_resolution',
        },
      }
    return {
      state: 'needs_manual_structuring',
      title: '截图已通过结构检查',
      message:
        '当前画面扫描未捆绑 OCR 模型。请用离线识别器生成扫描暂存 JSON，或在下方选择已有 JSON；低置信截图不会生成可导入结果。',
      canHandOff: false,
      diagnostic: {
        input: 'screenshot',
        name: input.name,
        type: input.type,
        size: input.size,
        width: input.width,
        height: input.height,
        recognition: 'not_run',
        reason: 'offline_adapter_not_configured',
      },
    }
  }

  try {
    const parsed = scanImportStagingBatchSchema.parse(JSON.parse(input.text))
    const identities = new Set(parsed.items.map((item) => item.sourceIdentity))
    const { manifest } = resolveScanBatchManifest(parsed.batch, parsed.items, {
      allowLegacy343: true,
    })
    const isCompletePaddleBatch =
      manifest.expectedTotal > 0 && /paddle/i.test(parsed.batch.recognitionVersion)
    if (!isCompletePaddleBatch)
      return {
        state: 'blocked',
        title: '扫描结果文件暂不能导入',
        message:
          '文件须包含完整且不重复的本机识别结果；请使用画面扫描导出的原始文件。账户未被修改。',
        canHandOff: false,
        diagnostic: {
          input: 'json',
          name: input.name,
          format: parsed.format,
          total: parsed.batch.total,
          itemCount: parsed.items.length,
          uniqueSourceIdentities: identities.size,
          recognitionVersion: parsed.batch.recognitionVersion,
          reason: 'formal_handoff_gate_failed',
        },
      }
    return {
      state: 'staging_ready',
      title: '扫描结果文件已就绪',
      message: '继续后会在本页检查这份文件；最终确认前不会改动账户。',
      canHandOff: true,
      diagnostic: {
        input: 'json',
        name: input.name,
        format: parsed.format,
        batchId: parsed.batch.id,
        total: parsed.batch.total,
        recognitionVersion: parsed.batch.recognitionVersion,
        preflight: 'not_run',
        arm: 'not_run',
        import: 'not_run',
      },
    }
  } catch (error) {
    return {
      state: 'blocked',
      title: '无法读取扫描结果文件',
      message: '文件不是受支持的扫描暂存格式，未生成可导入结果。请检查文件后重试。',
      canHandOff: false,
      diagnostic: {
        input: 'json',
        name: input.name,
        reason: 'invalid_staging_json',
        error: error instanceof Error ? error.message : 'unknown',
      },
    }
  }
}

export function createScannerDiagnosticExport(assessment: ScannerAssistantAssessment) {
  return JSON.stringify(
    {
      format: 'soda-terminal-scanner-diagnostic',
      formatVersion: 1,
      createdAt: new Date().toISOString(),
      state: assessment.state,
      title: assessment.title,
      diagnostic: assessment.diagnostic,
      accountAccess: false,
      importAccess: false,
    },
    null,
    2,
  )
}
