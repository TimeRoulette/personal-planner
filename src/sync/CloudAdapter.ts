import type { SyncPayload, SyncStatus } from '../types'
import type { SyncAdapter } from './SyncAdapter'

/**
 * 云同步占位实现 —— 后续接入真实后端时替换内部方法即可。
 * 当前所有操作抛出明确错误，不影响本地功能。
 */
export class CloudAdapter implements SyncAdapter {
  readonly name = 'cloud'
  private endpoint?: string

  constructor(endpoint?: string) {
    this.endpoint = endpoint
  }

  async pull(): Promise<SyncPayload | null> {
    if (!this.endpoint) {
      console.info('[CloudAdapter] 未配置云端地址，跳过 pull')
      return null
    }
    throw new Error('CloudAdapter.push/pull 尚未实现，请配置云端服务后启用')
  }

  async push(_payload: SyncPayload): Promise<void> {
    if (!this.endpoint) {
      console.info('[CloudAdapter] 未配置云端地址，跳过 push')
      return
    }
    throw new Error('CloudAdapter.push/pull 尚未实现，请配置云端服务后启用')
  }

  async getStatus(): Promise<SyncStatus> {
    if (!this.endpoint) return 'offline'
    return 'idle'
  }
}

export const cloudAdapter = new CloudAdapter()
