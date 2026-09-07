import type { SyncPayload, SyncStatus } from '../types'

/**
 * 同步适配器接口 —— 为未来云同步预留。
 * v1 仅使用 LocalAdapter；CloudAdapter 为占位实现。
 */
export interface SyncAdapter {
  readonly name: string
  pull(): Promise<SyncPayload | null>
  push(payload: SyncPayload): Promise<void>
  getStatus(): Promise<SyncStatus>
  /** 可选：订阅远端变更（云端实现时使用） */
  subscribe?(onChange: () => void): () => void
}
