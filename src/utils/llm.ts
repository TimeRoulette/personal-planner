import type { LlmConfig, ChatMessage } from '../types'

export async function chatCompletion(
  config: LlmConfig,
  messages: { role: string; content: string }[],
  signal?: AbortSignal,
): Promise<string> {
  if (!config.apiKey?.trim()) {
    throw new Error('请先在设置中配置 API Key')
  }
  if (!config.baseUrl?.trim()) {
    throw new Error('请先配置 API Base URL')
  }

  const base = config.baseUrl.replace(/\/$/, '')
  const url = `${base}/chat/completions`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4o-mini',
      messages,
      temperature: 0.7,
    }),
    signal,
  })

  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      detail = j?.error?.message || JSON.stringify(j)
    } catch {
      detail = await res.text()
    }
    throw new Error(`API 错误 (${res.status}): ${detail || res.statusText}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('API 返回为空')
  return content as string
}

export function toApiMessages(msgs: ChatMessage[], system?: string) {
  const list: { role: string; content: string }[] = []
  if (system) list.push({ role: 'system', content: system })
  for (const m of msgs) {
    if (m.role === 'system') continue
    list.push({ role: m.role, content: m.content })
  }
  return list
}
