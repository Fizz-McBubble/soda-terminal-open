import { z } from 'zod'
import { AssetQuickReadUnavailableError, awaitAssetQuickReadService } from './launcher'

export const assetQuickReadBridgeUrl = 'http://127.0.0.1:50609'
const jobSchema = z.object({
  jobId: z.string().uuid(),
  targetAccountId: z.string().min(1),
  state: z.enum(['starting', 'capturing', 'received', 'timed_out', 'stopped', 'error']),
  phase: z.string(),
  code: z.string().nullable().optional(),
  startedAt: z.string(),
  readyAt: z.string().nullable(),
  deadline: z.string().nullable(),
  remainingSeconds: z.number().nonnegative().nullable(),
  counts: z.object({
    discs: z.number().int().nonnegative(),
    engines: z.number().int().nonnegative(),
    agents: z.number().int().nonnegative(),
  }),
  candidateAvailable: z.boolean(),
})
export type AssetBridgeJob = z.infer<typeof jobSchema>
const healthSchema = z.object({
  service: z.literal('soda-asset-quick-read'),
  version: z.literal('1.0.0'),
  protocolVersion: z.literal(1),
  capabilities: z.array(z.string()),
  state: z.string(),
})

const errorMessages: Record<string, string> = {
  game_running: '请先完全退出游戏客户端，再开始本次资产快读。启动器可以保留。',
  game_process_running: '请先完全退出游戏客户端，再开始本次资产快读。启动器可以保留。',
  game_must_be_closed: '请先完全退出游戏客户端，再开始本次资产快读。启动器可以保留。',
  runtime_hash_mismatch: '资产快读文件未通过完整性检查，请核对安装包。',
  runtime_identity_mismatch: '资产快读文件未通过完整性检查，请核对安装包。',
  invalid_client_directory: '游戏安装目录不可用，请选择包含 ZenlessZoneZero_Data 的目录。',
  client_resources_missing: '未找到游戏目录中的 resources.assets，请核对安装目录。',
  client_directory_rejected: '请填写有效的本地游戏安装目录。',
  client_directory_missing: '游戏安装目录不存在，请核对路径。',
  client_resource_missing: '未找到游戏目录中的 resources.assets，请核对安装目录。',
  linked_path_rejected: '游戏或工具路径包含目录链接，请使用实际安装目录。',
  elevation_denied: '本次管理员授权未完成，未继续采集。',
  job_active: '已有本次资产快读任务在运行，请先停止。',
  session_invalid: '资产快读连接已失效，请重新连接。',
  origin_not_allowed: '资产快读尚未允许当前站点连接，请核对工具版本与页面地址。',
}

function waitForResponse<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    if (signal.aborted) {
      cancel()
      return
    }
    signal.addEventListener('abort', cancel, { once: true })
    pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel))
  })
}

export class AssetQuickReadBridgeClient {
  private token: string | null = null
  private readonly fetcher: typeof fetch
  private readonly protocolLauncher?: () => void
  constructor(
    fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
    protocolLauncher?: () => void,
  ) {
    this.fetcher = fetcher
    this.protocolLauncher = protocolLauncher
  }

  private async request(
    path: string,
    method = 'GET',
    body?: unknown,
    authenticated = true,
    signal?: AbortSignal,
    timeoutMs = 10000,
  ) {
    const abort = new AbortController()
    const cancel = () => abort.abort(signal?.reason)
    signal?.addEventListener('abort', cancel, { once: true })
    if (signal?.aborted) cancel()
    const timeout = setTimeout(() => abort.abort(), timeoutMs)
    try {
      if (authenticated && !this.token) throw new Error('请先连接独立资产快读。')
      const response = await waitForResponse(
        this.fetcher(`${assetQuickReadBridgeUrl}${path}`, {
          method,
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store',
          redirect: 'error',
          signal: abort.signal,
          headers: {
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            ...(authenticated ? { Authorization: `Bearer ${this.token}` } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
        abort.signal,
      )
      const raw = await waitForResponse(response.text(), abort.signal)
      if (raw.length > 16 * 1024 * 1024) throw new Error('资产快读返回结果过大，未读取。')
      let result: unknown
      try {
        result = JSON.parse(raw)
      } catch {
        throw new Error('资产快读响应格式不可用。')
      }
      if (!response.ok) {
        const code = z.object({ error: z.object({ code: z.string() }) }).safeParse(result)
        throw new Error(
          code.success
            ? (errorMessages[code.data.error.code] ??
                '资产快读未完成本次请求，请核对准备条件后重试。')
            : '资产快读未完成本次请求。',
        )
      }
      return result
    } catch (error) {
      if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError'))
        throw new AssetQuickReadUnavailableError(
          '未能连接独立资产快读。请先安装工具，并允许本站访问本机设备后重试。',
          {
            cause: error,
          },
        )
      throw error
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', cancel)
    }
  }

  async probe(signal?: AbortSignal) {
    const parsed = healthSchema.safeParse(
      await this.request('/health', 'GET', undefined, false, signal, 1000),
    )
    if (
      !parsed.success ||
      !parsed.data.capabilities.includes('asset_snapshot') ||
      !parsed.data.capabilities.includes('cancel')
    )
      throw new Error('资产快读版本不兼容，请更新工具。')
    return parsed.data
  }

  async connect({
    launchIfMissing = false,
    signal,
  }: { launchIfMissing?: boolean; signal?: AbortSignal } = {}) {
    this.token = null
    const health = await awaitAssetQuickReadService({
      probe: () => this.probe(signal),
      launchIfMissing,
      protocolLauncher: this.protocolLauncher,
      signal,
    })
    signal?.throwIfAborted()
    const session = z
      .object({
        token: z.string().min(32).max(256),
        version: z.literal('1.0.0'),
        expiresAt: z.string(),
      })
      .parse(await this.request('/connect', 'POST', {}, false, signal))
    this.token = session.token
    return health
  }

  async start(clientDirectory: string, targetAccountId: string) {
    if (!clientDirectory.trim() || !targetAccountId)
      throw new Error('请先选择目标账户并填写游戏安装目录。')
    return jobSchema.parse(
      await this.request('/jobs', 'POST', {
        clientDirectory: clientDirectory.trim(),
        targetAccountId,
        riskAcknowledged: true,
      }),
    )
  }
  async status(jobId: string) {
    return jobSchema.parse(await this.request(`/jobs/${z.string().uuid().parse(jobId)}`))
  }
  async cancel(jobId: string) {
    return jobSchema.parse(
      await this.request(`/jobs/${z.string().uuid().parse(jobId)}/cancel`, 'POST', {}),
    )
  }
  async result(jobId: string) {
    return z
      .object({
        jobId: z.string().uuid(),
        targetAccountId: z.string(),
        snapshot: z.unknown(),
        sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
        capturedAt: z.string(),
      })
      .parse(await this.request(`/jobs/${z.string().uuid().parse(jobId)}/result`))
  }
}
